// Geography between "country" and "city".
//
// The globe gave couples a country and then jumped straight to a city, so a
// Danish couple could not say "Sjælland" or "Jylland" — the two words they
// actually use when talking about where to get married. Denmark gets a
// hand-built taxonomy here; every other country falls back to the `region`
// string the destinations endpoint already asks Gemini for.
//
// `areas` is doing double duty: it labels the region for the couple, and it
// is the list the search fans out over. One request per area keeps every
// function call inside the platform's ~10s budget while still returning
// ~50 venues for the region as a whole.

export interface VenueRegion {
  slug: string;
  country: string;
  /** Full name — titles the results ("Sydsjælland, Møn & Lolland"). */
  label: { da: string; en: string };
  /**
   * Chip name. The picker lives in a ~370px column, where a full label puts
   * one chip on a row and ten regions eight rows deep, burying the city list
   * below it. The short name fits two to a row.
   */
  short: { da: string; en: string };
  /** Search shards. Order matters — the first is the anchor the couple named. */
  areas: string[];
}

/**
 * Danish wedding regions.
 *
 * Deliberately NOT the five administrative regions. Couples say
 * "Nordsjælland", "Møn" and "Djursland"; nobody says "Region Sjælland" when
 * describing where they want to marry. Split by how the wedding market
 * actually clusters, which also keeps each region's area list short enough
 * to search in parallel.
 */
export const DK_REGIONS: VenueRegion[] = [
  {
    slug: "hovedstaden",
    country: "Denmark",
    label: { da: "København & omegn", en: "Copenhagen & around" },
    short: { da: "Hovedstaden", en: "Capital region" },
    areas: ["København", "Frederiksberg", "Amager", "Nordhavn", "Gentofte"],
  },
  {
    slug: "nordsjaelland",
    country: "Denmark",
    label: { da: "Nordsjælland", en: "North Zealand" },
    short: { da: "Nordsjælland", en: "North Zealand" },
    areas: ["Helsingør", "Hillerød", "Fredensborg", "Gilleleje", "Hornbæk"],
  },
  {
    slug: "vestsjaelland",
    country: "Denmark",
    label: { da: "Vest- & Midtsjælland", en: "West & Central Zealand" },
    short: { da: "Vestsjælland", en: "West Zealand" },
    areas: ["Roskilde", "Holbæk", "Sorø", "Slagelse", "Kalundborg"],
  },
  {
    slug: "sydsjaelland",
    country: "Denmark",
    label: { da: "Sydsjælland, Møn & Lolland", en: "South Zealand, Møn & Lolland" },
    short: { da: "Sydsjælland", en: "South Zealand" },
    areas: ["Næstved", "Vordingborg", "Møn", "Lolland-Falster", "Stevns"],
  },
  {
    slug: "fyn",
    country: "Denmark",
    label: { da: "Fyn & øerne", en: "Funen & the islands" },
    short: { da: "Fyn", en: "Funen" },
    areas: ["Odense", "Svendborg", "Fåborg", "Langeland", "Ærø"],
  },
  {
    slug: "sonderjylland",
    country: "Denmark",
    label: { da: "Syd- & Sønderjylland", en: "South Jutland" },
    short: { da: "Sønderjylland", en: "South Jutland" },
    areas: ["Kolding", "Haderslev", "Sønderborg", "Tønder", "Ribe"],
  },
  {
    slug: "vestjylland",
    country: "Denmark",
    label: { da: "Vestjylland", en: "West Jutland" },
    short: { da: "Vestjylland", en: "West Jutland" },
    areas: ["Esbjerg", "Varde", "Ringkøbing", "Holstebro"],
  },
  {
    slug: "midtjylland",
    country: "Denmark",
    label: { da: "Midtjylland & Aarhus", en: "Central Jutland & Aarhus" },
    short: { da: "Midtjylland", en: "Central Jutland" },
    areas: ["Aarhus", "Silkeborg", "Skanderborg", "Djursland", "Herning"],
  },
  {
    slug: "nordjylland",
    country: "Denmark",
    label: { da: "Nordjylland", en: "North Jutland" },
    short: { da: "Nordjylland", en: "North Jutland" },
    areas: ["Aalborg", "Skagen", "Hjørring", "Thy"],
  },
  {
    slug: "bornholm",
    country: "Denmark",
    label: { da: "Bornholm", en: "Bornholm" },
    short: { da: "Bornholm", en: "Bornholm" },
    areas: ["Rønne", "Gudhjem", "Svaneke", "Allinge"],
  },
];

/** Every country with a curated taxonomy. Others use AI-grouped regions. */
const CURATED: Record<string, VenueRegion[]> = {
  denmark: DK_REGIONS,
  danmark: DK_REGIONS,
};

/** Curated regions for a country, or [] when we have none. */
export function regionsForCountry(country: string | null | undefined): VenueRegion[] {
  if (!country) return [];
  return CURATED[country.trim().toLowerCase()] ?? [];
}

export function findRegion(slug: string | null | undefined): VenueRegion | null {
  if (!slug) return null;
  const needle = slug.trim().toLowerCase();
  for (const list of Object.values(CURATED)) {
    const hit = list.find((r) => r.slug === needle);
    if (hit) return hit;
  }
  return null;
}

export function regionLabel(region: VenueRegion, lang: string): string {
  return lang === "en" ? region.label.en : region.label.da;
}

/** The chip name — see `short` on VenueRegion for why it exists. */
export function regionShortLabel(region: VenueRegion, lang: string): string {
  return lang === "en" ? region.short.en : region.short.da;
}

/**
 * The country at the end of a free-text location, IF we have curated regions
 * for it. "Kokkedal, Danmark" → "Denmark"; "Siena, Italy" → null, because
 * there is no Italian taxonomy to preselect.
 *
 * Only the final comma-segment is considered, and the match is exact. That is
 * the same rule `languageForPlace` uses in venue/language.ts, for the same
 * reason: a Danish street name ("Danmarksgade 5") must never be read as a
 * country. Returns null rather than guessing, so the caller decides the
 * fallback.
 */
export function curatedCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const segments = location.split(",");
  const last = segments[segments.length - 1]
    .trim()
    .replace(/[.\s]+$/, "")
    .toLowerCase();
  // A curated country answers in its own canonical spelling, so "Danmark"
  // and "Denmark" both resolve to the one regionsForCountry() expects.
  return CURATED[last]?.[0]?.country ?? null;
}

/**
 * One area as a search destination, qualified with its country: "Møn" and
 * "Ribe" are not unambiguous to Google Places on their own, and an
 * unqualified area is how a Danish search quietly returns Dutch venues.
 */
export function areaDestination(area: string, region: VenueRegion): string {
  return `${area}, ${region.country}`;
}

/**
 * How many areas one search may fan out over, however many regions are picked.
 *
 * A region is 4–5 areas and each area is its own request, so two regions is
 * ten parallel searches — fine, and roughly what "Nordsjælland og Fyn" should
 * cost. Ten regions would be forty-seven, which is a lot of Gemini for one
 * click. The budget keeps one or two regions at full depth and trades depth
 * for breadth beyond that.
 */
export const MAX_SHARDS = 12;

export interface Shard {
  /** Region slug, so the route can qualify the area with its country. */
  region: string;
  area: string;
}

/**
 * The areas a multi-region search should cover.
 *
 * Round-robin rather than region-by-region: with a budget of 12 and three
 * regions, taking them in order would spend the whole budget on the first two
 * and never look at the third. Interleaving gives every chosen region its
 * turn before any region gets a second area, so a region the couple picked
 * always contributes something.
 */
export function shardsFor(regions: VenueRegion[], budget = MAX_SHARDS): Shard[] {
  const shards: Shard[] = [];
  if (regions.length === 0) return shards;
  const deepest = Math.max(...regions.map((r) => r.areas.length));
  for (let depth = 0; depth < deepest && shards.length < budget; depth++) {
    for (const region of regions) {
      if (shards.length >= budget) break;
      const area = region.areas[depth];
      if (area) shards.push({ region: region.slug, area });
    }
  }
  return shards;
}

/** How many area names a heading spells out before it just counts them. */
const NAMES_IN_LABEL = 3;

/**
 * The regions' names, for a results heading.
 *
 * One region gets its full name; two or three are worth reading. Beyond that
 * the list stops being a title and becomes a paragraph — ten regions ran to
 * three lines — so it becomes a count instead.
 */
export function regionsLabel(regions: VenueRegion[], lang: string): string {
  if (regions.length === 0) return "";
  if (regions.length === 1) return regionLabel(regions[0], lang);
  if (regions.length > NAMES_IN_LABEL) {
    return lang === "en" ? `${regions.length} areas` : `${regions.length} områder`;
  }
  const names = regions.map((r) => regionShortLabel(r, lang));
  const last = names.pop()!;
  return `${names.join(", ")} ${lang === "en" ? "and" : "og"} ${last}`;
}

/**
 * Group AI-suggested destinations into region buckets for countries we have
 * no taxonomy for. Destinations with no region of their own are collected
 * under a single fallback bucket rather than dropped — for a small country
 * that bucket IS the region list.
 */
export function groupByRegion<T extends { name: string; region: string | null }>(
  destinations: T[],
  fallbackLabel: string
): { label: string; destinations: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const dest of destinations) {
    const key = dest.region?.trim() || fallbackLabel;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(dest);
    else buckets.set(key, [dest]);
  }
  // A bucket of one is not a region, it is a city — fold those back into the
  // fallback so the couple sees a handful of real choices, not fifteen chips.
  const grouped: { label: string; destinations: T[] }[] = [];
  const orphans: T[] = [];
  for (const [label, list] of buckets) {
    if (label !== fallbackLabel && list.length < 2) orphans.push(...list);
    else grouped.push({ label, destinations: list });
  }
  if (orphans.length > 0) {
    const fallback = grouped.find((g) => g.label === fallbackLabel);
    if (fallback) fallback.destinations.push(...orphans);
    else grouped.push({ label: fallbackLabel, destinations: orphans });
  }
  return grouped;
}
