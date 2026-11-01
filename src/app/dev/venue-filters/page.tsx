"use client";

/* VenueFilterBar against fixtures — the real bar needs a signed-in couple, a
   wedding and a finished venue search before a single pill appears, which makes
   it the most awkward part of Explore to look at while changing it. Here every
   pill is one click away. Sibling of /dev/chips, /dev/templates and
   /dev/timeline. */
import { useState } from 'react';
import VenueFilterBar, { type RegionOption } from '@/kalas/screens/venues/VenueFilterBar';
import VenuePanel from '@/kalas/screens/venues/VenuePanel';
import type { VenueBadge, VenueFilters, VenueSort } from '@/lib/venue/filter';
import { EMPTY_FACTS } from '@/lib/venue/facts';
import { EMPTY_AMENITIES } from '@/lib/venue/amenities';
import type { VenueSuggestion } from '@/lib/venue/search';

const REGIONS: RegionOption[] = [
  { id: 'hovedstaden', label: 'Hovedstaden' },
  { id: 'nordsjaelland', label: 'Nordsjælland' },
  { id: 'vestsjaelland', label: 'Vestsjælland' },
  { id: 'sydsjaelland', label: 'Sydsjælland' },
  { id: 'fyn', label: 'Fyn' },
  { id: 'sonderjylland', label: 'Sønderjylland' },
  { id: 'midtjylland', label: 'Midtjylland' },
  { id: 'nordjylland', label: 'Nordjylland' },
  { id: 'bornholm', label: 'Bornholm' },
];

/* A flat sage rectangle stands in for a photo — the real ones come from Google
   and this page has no session to fetch them with. */
const SWATCH = (n: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#${['dce3d3', 'c9d3c4', 'e0dccf', 'eef1e6', 'd8d4c7'][n]}"/></svg>`
  )}`;

const VENUE: VenueSuggestion = {
  id: 'dev-1',
  name: 'Hvedholm Slot',
  description:
    'Et barokslot på Sydfyn med egen kirke, park og 24 værelser i hovedbygningen. Selskabslokalerne ligger i stueetagen med udgang til haven.',
  why_fit: 'Barokhaven og den egne kirke gør, at hele dagen kan ligge ét sted, og der er senge nok til jeres tilrejsende.',
  address: 'Hvedholm 5, 5600 Faaborg',
  capacity: 'op til 180 gæster',
  price_hint: 'fra 78.000 kr.',
  photo: SWATCH(0),
  photos: [SWATCH(0), SWATCH(1), SWATCH(2), SWATCH(3), SWATCH(4)],
  rating: 4.6,
  review_count: 212,
  place_id: 'dev-place',
  website: 'https://example.com',
  lat: 55.09,
  lng: 10.24,
  area: 'Fyn',
  facts: { ...EMPTY_FACTS, capacity_seated: 180, catering: 'in_house', accommodation: 'on_site' },
  amenities: EMPTY_AMENITIES,
  distance_km: 42,
};

const BADGES: VenueBadge[] = [
  { id: 'capacity', text: 'Plads til 180 gæster', tone: 'good' },
  { id: 'catering', text: 'Catering i huset', tone: 'good' },
  { id: 'stay', text: '24 værelser på stedet', tone: 'good' },
  { id: 'price', text: 'Pris ukendt', tone: 'neutral' },
];

export default function DevVenueFiltersPage() {
  const [filters, setFilters] = useState<VenueFilters>({
    min_capacity: 175,
    budget_max: 120000,
    catering: 'any',
    accommodation: 'any',
    settings: [],
    require: [],
  });
  const [sort, setSort] = useState<VenueSort>('relevance');
  const [regionIds, setRegionIds] = useState<string[]>(['fyn']);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(true);

  return (
    <div className="theme-kalas min-h-screen bg-canvas p-10 font-sans text-ink">
      <div className="mx-auto max-w-5xl">
        <VenueFilterBar
          filters={filters}
          onChange={setFilters}
          onGuestsCommit={() => {}}
          regions={REGIONS}
          activeRegionIds={regionIds}
          onRegionToggle={(id) =>
            setRegionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
          }
          sort={sort}
          onSortChange={setSort}
          counts={{ total: 27, shown: 24, withCatering: 8, withStay: 11, hiddenCapacity: 3 }}
          hasDistances
          allocatedBudget={120000}
          loading={false}
          savedCount={12}
          onOpenSaved={() => {}}
        />

        {/* The venue modal a card in the results grid opens. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-8 h-44 w-full cursor-pointer rounded-2xl border border-line bg-card text-meta text-muted sm:w-1/3"
        >
          {VENUE.name}
        </button>
        <VenuePanel
          v={open ? VENUE : null}
          badges={BADGES}
          saved={saved}
          saving={false}
          onSave={() => setSaved(true)}
          onClose={() => setOpen(false)}
          onPhoto={() => {}}
        />

        <pre className="mt-10 overflow-x-auto rounded-2xl border border-line bg-card p-5 text-[0.72rem] leading-relaxed text-muted">
          {JSON.stringify({ filters, sort, regionIds }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
