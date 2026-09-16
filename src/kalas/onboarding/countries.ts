/* The globe's countries, as data a screen can use before the globe exists:
   which names it knows, and where to point the camera for one.

   The venue search seeded its globe from a hand-written table that only knew
   Denmark, so a couple who picked France in onboarding opened Venues on
   Denmark anyway. Every country the globe can draw now has a camera target,
   worked out from the same bundled Natural Earth shapes the globe draws. */

import { feature } from 'topojson-client';
import countriesTopo from './countries-110m.json';
import type { GlobeFocus } from './DestinationGlobe';

type Ring = [number, number][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };
type Country = { properties: { name: string }; geometry: Geometry | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = countriesTopo as any;
const COUNTRIES = (feature(topo, topo.objects.countries) as unknown as { features: Country[] }).features;

const BY_NAME = new Map(COUNTRIES.map((c) => [c.properties.name.toLowerCase(), c]));

/* What a Danish couple types or reads for the same place. Only the ones that
   differ from the globe's English names, and only where a wedding plausibly
   goes: the rest match as written. */
const ALIASES: Record<string, string> = {
  danmark: 'Denmark',
  frankrig: 'France',
  italien: 'Italy',
  spanien: 'Spain',
  grækenland: 'Greece',
  sverige: 'Sweden',
  norge: 'Norway',
  tyskland: 'Germany',
  storbritannien: 'United Kingdom',
  england: 'United Kingdom',
  skotland: 'United Kingdom',
  uk: 'United Kingdom',
  kroatien: 'Croatia',
  island: 'Iceland',
  irland: 'Ireland',
  østrig: 'Austria',
  schweiz: 'Switzerland',
  holland: 'Netherlands',
  nederlandene: 'Netherlands',
  tjekkiet: 'Czechia',
  usa: 'United States of America',
  'united states': 'United States of America',
  marokko: 'Morocco',
};

/** The globe's own spelling of a country name, or null when it is not one. */
export function globeCountry(name: string | null | undefined): string | null {
  const key = (name ?? '').trim().replace(/[.\s]+$/, '').toLowerCase();
  if (!key) return null;
  const aliased = ALIASES[key];
  if (aliased) return aliased;
  return BY_NAME.get(key)?.properties.name ?? null;
}

/**
 * The country a stored location is in. Onboarding saves either the country
 * ("France") or a place in it ("Provence, France"), so the last segment is the
 * one to read. A bare town ("Odense") names no country and gives null.
 */
export function countryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const segments = location.split(',');
  return globeCountry(segments[segments.length - 1]);
}

/**
 * Where to point the camera for a country: the middle of its largest landmass,
 * pulled back far enough to see all of it.
 *
 * The largest part, not all of it, because Natural Earth draws France with
 * French Guiana and Norway with Svalbard, and the middle of everything would
 * put the camera over the Atlantic.
 */
export function countryFocus(name: string | null | undefined): GlobeFocus | null {
  const country = globeCountry(name);
  const geometry = country ? BY_NAME.get(country.toLowerCase())?.geometry : null;
  if (!geometry) return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  let best: { minLng: number; maxLng: number; minLat: number; maxLat: number; area: number } | null = null;
  for (const polygon of polygons) {
    const outer = polygon[0] ?? [];
    if (outer.length === 0) continue;
    const lngs = outer.map((p) => p[0]);
    const lats = outer.map((p) => p[1]);
    const box = {
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      area: 0,
    };
    box.area = (box.maxLng - box.minLng) * (box.maxLat - box.minLat);
    if (!best || box.area > best.area) best = box;
  }
  if (!best) return null;

  const span = Math.max(best.maxLng - best.minLng, best.maxLat - best.minLat);
  return {
    lat: (best.minLat + best.maxLat) / 2,
    lng: (best.minLng + best.maxLng) / 2,
    // Denmark's hand-tuned view is 0.5 for a span of about 7°.
    altitude: Math.min(1.8, Math.max(0.4, span / 14)),
  };
}
