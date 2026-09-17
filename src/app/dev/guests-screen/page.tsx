"use client";

/* The real Gæster screen against a fixture wedding, for the Overblik tab and
   the need filters. `?tab=overblik` opens on the overview. */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Guests from '@/kalas/screens/Guests';
import { FixtureWedding, guest } from '../_fixture/wedding';

const GUESTS = [
  guest('Mette Holm', { side: 'Emma', dietary_tags: ['vegan'], overnight: true }),
  guest('Jonas Krag', { side: 'Frederik', dietary_tags: ['vegan', 'gluten_free'], no_alcohol: true, meal: 'Fisk' }),
  guest('Asta Holm', { side: 'Emma', age_group: 'child', dietary: 'nøddeallergi' }),
  guest('Ida Sønderby', { rsvp: 'afventer', dietary_tags: ['halal'] }),
  guest('Per Lund', { rsvp: 'nej', overnight: true }),
  guest('Sofie Lund', { dietary: 'vegetar, ingen svampe', overnight: true, meal: 'fisk' }),
  guest('Mads Berg', { side: 'Frederik', dietary_tags: ['shellfish_free'], meal: 'Kød' }),
  guest('Oscar Berg', { age_group: 'baby' }),
];

const SEATING = {
  version: 2,
  tables: [
    { id: 't1', name: 'Bord 1', shape: 'round', seats: 6, x: 260, y: 260, seated: [GUESTS[0].id, GUESTS[1].id, GUESTS[2].id, null, null, null] },
    { id: 't2', name: 'Bord 2', shape: 'round', seats: 6, x: 620, y: 260, seated: [GUESTS[5].id, GUESTS[6].id, null, null, null, null] },
  ],
};

function Screen() {
  const tab = useSearchParams().get('tab') === 'overblik' ? 'overblik' : 'gæsteliste';
  return <Guests initialTab={tab} />;
}

export default function DevGuestsScreenPage() {
  return (
    <LanguageProvider initialLang="da">
      <FixtureWedding guests={GUESTS} seating={SEATING}>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Suspense><Screen /></Suspense>
        </div>
      </FixtureWedding>
    </LanguageProvider>
  );
}
