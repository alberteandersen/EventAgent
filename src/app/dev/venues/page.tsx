"use client";

/* The venue search against fixtures. The real one needs a signed-in couple, a
   wedding and a live Gemini + Places search before anything shows, and the
   parts worth looking at while changing it are the ones in between: the
   search bar's places, the area explorer, the mood cards, and the list next
   to the map. Sibling of /dev/venue-filters.

     ?place=Toscana, Italy   the wedding's location (default Fyn)
     ?named=Italy|France     the countries named in onboarding
     ?map=keyless            the map without a key (Google serves it watermarked)
     ?map=0                  no map, as when the key is not set
                             (otherwise the map uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
     ?fail=1                 every search fails

   The search answers are made up here: a handful of venues around wherever
   was asked for, inside the rectangle when one is sent, echoing the wish. */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import { DiscoverView } from '@/kalas/screens/venues/DiscoverView';
import { KEYLESS } from '@/kalas/screens/venues/googleMaps';
import { FIXTURE_COUPLE, FixtureWedding } from '../_fixture/wedding';
import { EMPTY_FACTS, VENUE_SETTINGS, type VenueSetting } from '@/lib/venue/facts';
import { EMPTY_AMENITIES } from '@/lib/venue/amenities';
import type { VenueSuggestion } from '@/lib/venue/search';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import type { MapBounds } from '@/lib/venue/mapArea';

const TINTS = ['b9c8a4', 'd9c3a5', 'a9bfc4', 'c8b3c9', 'cfd3b0', 'e0b9a3', 'b0c4b1'];
/* A flat tint with the name on it stands in for a photo: the real ones come
   from Google and this page has no session to fetch them with. */
const swatch = (label: string, n: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#${TINTS[n % TINTS.length]}"/><text x="24" y="296" font-family="Georgia" font-size="26" fill="#24413a" opacity="0.55">${label}</text></svg>`
  )}`;

/** Roughly where a searched place is, so its venues land on the right bit of map. */
const WHERE: [RegExp, { lat: number; lng: number }][] = [
  [/toscana|tuscany|firenze|chianti/i, { lat: 43.45, lng: 11.3 }],
  [/como/i, { lat: 45.99, lng: 9.26 }],
  [/amalfi/i, { lat: 40.63, lng: 14.6 }],
  [/puglia/i, { lat: 40.8, lng: 17.1 }],
  [/rom/i, { lat: 41.9, lng: 12.5 }],
  [/provence/i, { lat: 43.9, lng: 5.2 }],
  [/paris/i, { lat: 48.85, lng: 2.35 }],
  [/france|frankrig/i, { lat: 46.6, lng: 2.4 }],
  [/italy|italien/i, { lat: 42.8, lng: 12.5 }],
  [/svendborg/i, { lat: 55.06, lng: 10.61 }],
  [/faaborg/i, { lat: 55.1, lng: 10.24 }],
  [/odense|fyn/i, { lat: 55.4, lng: 10.39 }],
  [/denmark|danmark/i, { lat: 55.7, lng: 10.6 }],
];
const NAMES = ['Slot', 'Gods', 'Lade', 'Orangeri', 'Strandhotel', 'Vingård', 'Kro'];
const KINDS: VenueSetting[] = ['castle', 'manor', 'barn', 'garden', 'coastal', 'vineyard', 'restaurant'];

interface Ask {
  destination?: string; area?: string; region?: string; wish?: string;
  bounds?: MapBounds; exclude?: string[]; filters?: { settings?: string[] };
}

function venuesFor(ask: Ask): VenueSuggestion[] {
  const where = ask.area ?? ask.destination ?? 'Fyn';
  const short = where.split(',')[0];
  const base = ask.bounds
    ? { lat: (ask.bounds.south + ask.bounds.north) / 2, lng: (ask.bounds.west + ask.bounds.east) / 2 }
    : WHERE.find(([re]) => re.test(where))?.[1] ?? { lat: 55.4, lng: 10.39 };
  const spread = ask.bounds ? (ask.bounds.north - ask.bounds.south) * 0.35 : 0.22;
  const page = ask.exclude?.length ? ' II' : '';
  const wanted = (ask.filters?.settings ?? []).filter((s): s is VenueSetting =>
    (VENUE_SETTINGS as readonly string[]).includes(s));
  return NAMES.map((name, i) => {
    // The second page of a mood search is that mood: it is what was asked for.
    const setting = page && wanted.length > 0 ? wanted[i % wanted.length] : KINDS[i];
    const full = `${short} ${name}${page}`;
    const angle = (i / NAMES.length) * Math.PI * 2;
    return {
      id: `dev-${full}`.replace(/\s+/g, '-').toLowerCase(),
      name: full,
      description: `Et sted nær ${short} der holder bryllupper året rundt.`,
      why_fit: ask.wish
        ? `Passer til "${ask.wish}": udsigt over dalen og værelser i hovedhuset.`
        : `Ligger smukt ved ${short}, med plads til både vielse og middag.`,
      address: `Hovedgaden ${i + 1}, ${short}`,
      capacity: `op til ${90 + i * 15} gæster`,
      price_hint: `fra ${45 + i * 8}.000 kr.`,
      photo: swatch(full, i),
      photos: [swatch(full, i), swatch(`${full}, haven`, i + 1), swatch(`${full}, salen`, i + 2)],
      rating: 4.2 + (i % 4) * 0.2,
      review_count: 40 + i * 31,
      place_id: `dev-place-${full}`,
      website: 'https://example.com',
      lat: base.lat + Math.sin(angle) * spread,
      lng: base.lng + Math.cos(angle) * spread * 1.6,
      area: short,
      facts: {
        ...EMPTY_FACTS,
        capacity_seated: 90 + i * 15,
        setting,
        catering: i % 2 ? 'in_house' : 'unknown',
        accommodation: i % 3 === 0 ? 'on_site' : 'unknown',
        price_from: (45 + i * 8) * 1000,
        price_unit: 'total',
      },
      amenities: EMPTY_AMENITIES,
      distance_km: 12 + i * 9,
    };
  });
}

const DESTINATIONS: Record<string, DestinationSuggestion[]> = {
  Italy: [
    ['Toscana', 'wedding', 'Vingårde og villaer mellem Firenze og Siena.', 43.45, 11.3],
    ['Comosøen', 'wedding', 'Villaer ved vandet under Alperne.', 45.99, 9.26],
    ['Amalfikysten', 'wedding', 'Terrasser højt over Middelhavet.', 40.63, 14.6],
    ['Puglia', 'wedding', 'Hvide masserier mellem oliventræer.', 40.8, 17.1],
    ['Rom', 'city', 'Paladser og tagterrasser midt i byen.', 41.9, 12.5],
    ['Firenze', 'city', 'Renæssancevillaer med udsigt til kuplen.', 43.77, 11.25],
  ].map(([name, kind, blurb, lat, lng], i) => ({
    name: name as string, region: null, kind: kind as 'city' | 'wedding', blurb: blurb as string,
    photo: swatch(name as string, i + 2), rating: 4.6, lat: lat as number, lng: lng as number,
  })),
  France: [
    ['Provence', 'wedding', 'Lavendelmarker og stenhuse.', 43.9, 5.2],
    ['Paris', 'city', 'Saloner og haver i byen.', 48.85, 2.35],
  ].map(([name, kind, blurb, lat, lng], i) => ({
    name: name as string, region: null, kind: kind as 'city' | 'wedding', blurb: blurb as string,
    photo: swatch(name as string, i + 4), rating: 4.5, lat: lat as number, lng: lng as number,
  })),
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const later = <T,>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const real = window.fetch.bind(window);
  const fail = new URLSearchParams(window.location.search).get('fail') === '1';
  const asked: Ask[] = [];
  // So a check can read back exactly what the page sent.
  (window as unknown as { __venueAsks: Ask[] }).__venueAsks = asked;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/onboarding/venues')) {
      const ask = JSON.parse(String(init?.body ?? '{}')) as Ask;
      asked.push(ask);
      if (fail) return later(json({ error: 'dev: failing on purpose' }, 500), 400);
      return later(json({ venues: venuesFor(ask), area: ask.area ?? null, hidden: { capacity: 1 } }), 500 + asked.length * 120);
    }
    if (url.includes('/api/onboarding/destinations')) {
      const country = new URL(url, window.location.origin).searchParams.get('country') ?? '';
      return later(json({ suggestions: DESTINATIONS[country] ?? [] }), 500);
    }
    if (url.includes('/api/')) return later(json({ ok: true }), 200);
    return real(input, init);
  };
}

function Harness() {
  const params = useSearchParams();
  // Before the first effect: the search starts in one, as the page mounts.
  useState(patchFetch);
  const place = params.get('place') ?? FIXTURE_COUPLE.region;
  const named = (params.get('named') ?? '').split('|').filter(Boolean);
  const [saved, setSaved] = useState(0);

  return (
    <LanguageProvider initialLang={params.get('lang') === 'en' ? 'en' : 'da'}>
      <FixtureWedding
        couple={{ region: place === 'none' ? '' : place }}
        event={{ requirements: named.length > 0 ? { loved_destinations: named } : {} }}
      >
        <div className="theme-kalas min-h-screen bg-canvas px-6 py-8 font-sans text-ink sm:px-10">
          <DiscoverView
            couple={{ ...FIXTURE_COUPLE, region: place === 'none' ? '' : place }}
            savedPlaceIds={new Set()}
            similarNames={null}
            onSaved={async () => setSaved((n) => n + 1)}
            onViewList={() => {}}
            savedCount={saved}
            embedded
            mapsKey={params.get('map') === 'keyless' ? KEYLESS : params.get('map') === '0' ? '' : undefined}
          />
        </div>
      </FixtureWedding>
    </LanguageProvider>
  );
}

export default function DevVenuesPage() {
  return <Suspense><Harness /></Suspense>;
}
