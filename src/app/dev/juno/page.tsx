'use client';

/* Juno, the character, on the grounds she has to live on: the landing page's
   laurel, cream and pistachio, and the app's canvas. Sizes, moods, and where
   she looks. The first one follows the pointer. */

import { Juno } from '@/components/juno/Juno';

const GROUNDS = [
  { name: 'Laurel', bg: '#3a4f37', fg: '#f6f0e8' },
  { name: 'Cream', bg: '#f6f0e8', fg: '#4a4e3c' },
  { name: 'Pistachio', bg: '#dfe6cf', fg: '#4a4e3c' },
  { name: 'App canvas', bg: '#f4f5f3', fg: '#24413a' },
];

export default function Page() {
  return (
    <main className="min-h-screen">
      {GROUNDS.map((g) => (
        <section key={g.name} style={{ background: g.bg, color: g.fg }} className="px-10 py-10">
          <p className="text-sm">{g.name}</p>
          <div className="mt-5 flex flex-wrap items-end gap-12">
            <Juno size={220} follow bow label="Juno" />
            <Juno size={150} look={{ x: -0.8, y: 0.8 }} />
            <Juno size={150} mood="glad" bow />
            <Juno size={96} look={{ x: 0.8, y: 0.2 }} />
            <Juno size={56} look={{ x: -0.6, y: 0.8 }} shadow={false} />
            <Juno size={32} shadow={false} />
          </div>
        </section>
      ))}
    </main>
  );
}
