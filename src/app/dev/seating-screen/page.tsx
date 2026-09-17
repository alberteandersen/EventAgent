"use client";

/* The real Bordplan screen against a fixture wedding: the seat-count box on a
   new table, and the zoom stepping out when a table or element lands beyond
   what the canvas shows. */

import { LanguageProvider } from '@/kalas/i18n';
import Seating from '@/kalas/screens/Seating';
import { FixtureWedding, guest } from '../_fixture/wedding';

const GUESTS = ['Mette Holm', 'Jonas Krag', 'Ida Sønderby', 'Anna Berg', 'Mads Holm', 'Sofie Lund'].map((n) => guest(n));

export default function DevSeatingScreenPage() {
  return (
    <LanguageProvider initialLang="da">
      <FixtureWedding
        guests={GUESTS}
        seating={{
          version: 2,
          tables: [
            { id: 't1', name: 'Bord 1', shape: 'round', seats: 8, x: 260, y: 260, seated: Array(8).fill(null) },
            { id: 't2', name: 'Bord 2', shape: 'round', seats: 8, x: 620, y: 260, seated: Array(8).fill(null) },
            { id: 't3', name: 'Bord 3', shape: 'round', seats: 8, x: 980, y: 260, seated: Array(8).fill(null) },
          ],
        }}
      >
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Seating />
        </div>
      </FixtureWedding>
    </LanguageProvider>
  );
}
