"use client";

/* Harness for the Bryllupsdagen tab. The real screen sits behind
   useWedding()/Supabase, but DayProgram takes plain props, so the whole thing
   can be driven here: seeding the classic day, editing, durations, gaps and
   overlaps, the ripple shift, and the live "Nu" marker at a parked clock. */

import { useState } from 'react';
import { LanguageProvider } from '@/kalas/i18n';
import { DayProgram } from '@/kalas/screens/planning/DayProgramTab';
import type { DayProgramItemRow } from '@/lib/db/types';

const now = new Date().toISOString();
let seq = 0;
const row = (r: Partial<DayProgramItemRow> & { time: string; title: string }): DayProgramItemRow => ({
  id: `d${++seq}`, event_id: 'dev', user_id: 'dev',
  subtitle: null, duration_min: 0, owner: null, notes: null, sort: seq, created_at: now,
  ...r,
});

export default function DevDayProgramPage() {
  const [items, setItems] = useState<DayProgramItemRow[]>([
    row({ time: '14:00', title: 'Gæsternes ankomst', subtitle: 'Havens indgang · Velkomstdrinks', duration_min: 45, owner: 'Toastmaster' }),
    row({ time: '15:00', title: 'Ceremoni', subtitle: 'Oliventræshaven', duration_min: 45, owner: 'Præst' }),
    row({ time: '16:00', title: 'Champagne & portrætter', subtitle: 'Øvre terrasse', duration_min: 90, owner: 'Fotograf' }),
    row({ time: '17:00', title: 'Middag', subtitle: 'Gårdhave · Taler efter hovedretten', duration_min: 150 }),
    row({ time: '20:30', title: 'Første dans', subtitle: 'Dansegulvet i gårdhaven', duration_min: 30 }),
    row({ time: '00:30', title: 'Natmad', subtitle: 'Terrasse', duration_min: 45, owner: 'Catering' }),
  ]);
  const [clock, setClock] = useState('15:32');
  const [today, setToday] = useState(true);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-[#f4f5f3] px-6 py-8">
        <p className="eyebrow mb-3">Dev · Bryllupsdagen</p>
        <div className="mb-6 flex flex-wrap items-center gap-3 text-[0.78rem]">
          <label className="flex items-center gap-1.5">
            Klokken
            <input type="time" value={clock} onChange={(e) => setClock(e.target.value)}
              className="rounded-lg border border-line bg-card px-2 py-1" />
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} />
            Det er bryllupsdagen
          </label>
          <button type="button" onClick={() => setItems([])}
            className="rounded-full border border-line px-3 py-1 cursor-pointer">Tøm</button>
        </div>

        <div className="mx-auto max-w-3xl">
          <DayProgram
            items={items}
            isToday={today}
            clockOverride={clock}
            onAdd={(item) => setItems((rows) => [...rows, row({ ...item, time: item.time, title: item.title })])}
            onUpdate={(id, patch) => setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
            onDelete={(id) => setItems((rows) => rows.filter((r) => r.id !== id))}
            onSeed={(seed) => setItems(seed.map((s) => row({ ...s, time: s.time, title: s.title })))}
          />
        </div>
      </div>
    </LanguageProvider>
  );
}
