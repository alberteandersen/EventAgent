// What a venue search covers, and how it is cut into requests.
//
// The explore page used to keep this in four separate pieces of state (a
// country, an open region, selected curated regions, selected AI regions)
// with a search function for each. They are all the same thing: a list of
// places, each of which knows how to become one or more area searches.

import { countryLabel, globeCountry } from "@/kalas/onboarding/countries";
import { boundsCentre, type MapBounds } from "./mapArea";
import {
  MAX_SHARDS, findRegion, regionShortLabel, regionsForCountry, shardsFor, type VenueRegion,
} from "./regions";

export type SearchPlace =
  /** One of our own regions, e.g. Nordsjælland. Searched area by area. */
  | { kind: "region"; slug: string }
  /** A whole country, in the globe's spelling. */
  | { kind: "country"; country: string }
  /** Anything they typed or picked that is neither: "Toscana", "Odense". */
  | { kind: "text"; query: string }
  /** The piece of map on screen. `near` names it for the search. */
  | { kind: "map"; bounds: MapBounds; near: string | null };

export function placeKey(place: SearchPlace): string {
  switch (place.kind) {
    case "region": return `region:${place.slug}`;
    case "country": return `country:${place.country}`;
    case "text": return `text:${place.query.toLowerCase()}`;
    case "map": return "map";
  }
}

/** Every curated region, to recognise one when it is typed. */
function regionNamed(text: string): VenueRegion | null {
  const needle = text.trim().toLowerCase();
  if (!needle) return null;
  const bySlug = findRegion(needle);
  if (bySlug) return bySlug;
  for (const country of ["Denmark"]) {
    const hit = regionsForCountry(country).find((r) =>
      [r.label.da, r.label.en, r.short.da, r.short.en].some((l) => l.toLowerCase() === needle)
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * A typed or stored place as a search place. "Fyn" is our region, "Italien"
 * is a country, and everything else is searched as written.
 */
export function placeFromText(text: string | null | undefined): SearchPlace | null {
  const query = (text ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!query) return null;
  const region = regionNamed(query);
  if (region) return { kind: "region", slug: region.slug };
  const country = globeCountry(query);
  if (country) return { kind: "country", country };
  return { kind: "text", query };
}

/** The country a place is in, when it says. Used to pick what to explore. */
export function placeCountry(place: SearchPlace): string | null {
  switch (place.kind) {
    case "region": return findRegion(place.slug)?.country ?? null;
    case "country": return place.country;
    case "text": {
      const segments = place.query.split(",");
      return segments.length > 1 ? globeCountry(segments[segments.length - 1]) : null;
    }
    case "map": return null;
  }
}

export function placeLabel(place: SearchPlace, lang: string): string {
  switch (place.kind) {
    case "region": {
      const region = findRegion(place.slug);
      return region ? regionShortLabel(region, lang) : place.slug;
    }
    case "country": return countryLabel(place.country, lang);
    case "text": {
      // "Toscana, Italy" reads "Toscana, Italien" to a Danish couple.
      const segments = place.query.split(",").map((s) => s.trim());
      const country = segments.length > 1 ? globeCountry(segments[segments.length - 1]) : null;
      return country ? [...segments.slice(0, -1), countryLabel(country, lang)].join(", ") : place.query;
    }
    case "map": return lang === "en" ? "Map area" : "Kortudsnit";
  }
}

/** How many names a heading spells out before it counts them instead. */
const NAMES_IN_TITLE = 3;

export function placesTitle(places: SearchPlace[], lang: string): string {
  if (places.length === 0) return "";
  if (places.length > NAMES_IN_TITLE) return lang === "en" ? `${places.length} places` : `${places.length} steder`;
  const names = places.map((p) => placeLabel(p, lang));
  if (names.length === 1) return names[0];
  const last = names.pop()!;
  return `${names.join(", ")} ${lang === "en" ? "and" : "og"} ${last}`;
}

/** One request to the venue search: a region's area, or a named place. */
export interface ShardBody {
  region?: string;
  area?: string;
  destination?: string;
  bounds?: MapBounds;
}

/** How many of a country's destinations one search fans out over. */
export const COUNTRY_SHARDS = 4;

/**
 * The requests one place turns into, most useful first.
 *
 * A bare country is the wide case. Where we know its wedding destinations
 * the search spreads over the first few, which is what shows a couple who
 * only said "Italy" that Italy is Tuscany and the lakes and the Amalfi coast.
 * Where we do not, or where the country has regions of ours to narrow by
 * instead, it is one search of the country as a whole.
 */
function shardsOf(place: SearchPlace, destinations: Record<string, { name: string }[]>): ShardBody[] {
  switch (place.kind) {
    case "region": {
      const region = findRegion(place.slug);
      return region ? shardsFor([region]) : [];
    }
    case "country": {
      const known = regionsForCountry(place.country).length > 0 ? [] : destinations[place.country] ?? [];
      if (known.length === 0) return [{ destination: place.country }];
      return known.slice(0, COUNTRY_SHARDS).map((d) => ({ destination: `${d.name}, ${place.country}` }));
    }
    case "text": return [{ destination: place.query }];
    case "map": {
      const centre = boundsCentre(place.bounds);
      return [{
        destination: place.near ?? `${centre.lat.toFixed(2)}, ${centre.lng.toFixed(2)}`,
        bounds: place.bounds,
      }];
    }
  }
}

/**
 * Every request a search makes, inside one budget.
 *
 * Round-robin across the places, for the reason `shardsFor` gives for
 * regions: taken in order, the first place would spend the whole budget and
 * a second one the couple also picked would never be looked at.
 */
export function planShards(
  places: SearchPlace[],
  destinations: Record<string, { name: string }[]> = {},
  budget = MAX_SHARDS,
): ShardBody[] {
  const queues = places.map((p) => shardsOf(p, destinations));
  const planned: ShardBody[] = [];
  const seen = new Set<string>();
  const deepest = Math.max(0, ...queues.map((q) => q.length));
  for (let depth = 0; depth < deepest && planned.length < budget; depth++) {
    for (const queue of queues) {
      if (planned.length >= budget) break;
      const shard = queue[depth];
      if (!shard) continue;
      const key = `${shard.region ?? ""}|${shard.area ?? ""}|${(shard.destination ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      planned.push(shard);
    }
  }
  return planned;
}
