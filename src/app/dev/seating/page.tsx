"use client";

/* The seating canvas against fixtures — the real screen needs a signed-in
   couple with a guest list, so this is where the table geometry can be looked
   at while it is being changed: chairs around all three shapes, name labels,
   dietary dots, the held-guest state and a click-to-seat loop driven by the
   same model functions the screen uses. Sibling of /dev/globe. */
import { useState } from 'react';
import { TableNode } from '@/kalas/screens/seating/TableNode';
import { ElementNode } from '@/kalas/screens/seating/ElementNode';
import {
  seatGuest, unseatGuest, seatedIds, initials,
  type PlanGuest, type SeatingPlan,
} from '@/kalas/screens/seating/model';

const GUESTS: PlanGuest[] = [
  { id: 'g1', name: 'Margaret Whitfield', group: 'Brudens familie', dietary: 'Vegetar', attending: true },
  { id: 'g2', name: 'Chidi Okafor', group: 'Brudens familie', dietary: null, attending: true },
  { id: 'g3', name: 'Grandma', group: 'Brudens familie', dietary: 'Nøddeallergi', attending: true },
  { id: 'g4', name: 'Anne-Marie Bo', group: 'Gommens familie', dietary: null, attending: true },
  { id: 'g5', name: 'Bartholomew Jones', group: 'Gommens familie', dietary: null, attending: false },
  { id: 'g6', name: 'Yaa Mensah', group: 'Venner', dietary: null, attending: true },
  { id: 'g7', name: 'Kwame Asante', group: 'Venner', dietary: 'Glutenfri', attending: true },
  { id: 'g8', name: 'Isla Petersen', group: 'Venner', dietary: null, attending: true },
];

const INITIAL: SeatingPlan = {
  version: 2,
  tables: [
    {
      id: 'head', name: 'Bordplan', shape: 'head', seats: 6, x: 480, y: 150,
      seated: ['g1', 'g2', null, null, null, null],
    },
    {
      id: 't1', name: 'Bord 1', shape: 'round', seats: 8, x: 300, y: 470,
      seated: ['g3', null, 'g4', null, null, 'g5', null, null],
    },
    {
      id: 't2', name: 'Bord 2', shape: 'rect', seats: 10, x: 720, y: 470,
      seated: [null, 'g6', null, null, null, 'g7', null, null, null, null],
    },
  ],
  // The rest of the room: a dance floor, the DJ at its edge, and the buffet.
  elements: [
    { id: 'e1', kind: 'dansegulv', label: 'Dansegulv', x: 190, y: 250, w: 260, h: 200 },
    { id: 'e2', kind: 'dj', label: 'DJ / band', x: 190, y: 405, w: 180, h: 90 },
    { id: 'e3', kind: 'buffet', label: 'Madbord', x: 650, y: 330, w: 260, h: 80 },
  ],
};

export default function DevSeatingPage() {
  const [plan, setPlan] = useState<SeatingPlan>(INITIAL);
  const [held, setHeld] = useState<string | null>(null);
  const byId = new Map(GUESTS.map((g) => [g.id, g]));
  const seated = seatedIds(plan);

  const onSeatClick = (tableId: string, index: number) => {
    const sitting = plan.tables.find((t) => t.id === tableId)?.seated[index] ?? null;
    if (held) { setPlan((p) => seatGuest(p, held, tableId, index)); setHeld(null); return; }
    setHeld(sitting);
  };

  return (
    <div className="theme-kalas min-h-screen bg-canvas p-8 font-sans text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
        <div
          className="relative h-[clamp(20rem,50vh,36rem)] min-w-0 flex-[3_1_28rem] overflow-auto rounded-[28px] border border-line bg-[#f7f5ef]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(196,191,174,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="relative h-[640px] w-[900px]">
            {(plan.elements ?? []).map((el) => (
              <ElementNode key={el.id} element={el} selected={el.id === 'e3'} onSelect={() => {}} onPointerDown={() => {}} />
            ))}
            {plan.tables.map((tb) => (
              <TableNode
                key={tb.id}
                table={tb}
                guests={byId}
                held={held}
                selected={false}
                onSelect={() => {}}
                onSeatClick={(i) => onSeatClick(tb.id, i)}
                onSeatPointerDown={() => {}}
                onTablePointerDown={() => {}}
                onRename={() => {}}
              />
            ))}
          </div>
        </div>

        <aside className="min-w-0 flex-[1_1_16rem] rounded-[28px] border border-line bg-card p-4">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sage">Gæster</p>
          <p className="mt-1 text-[0.72rem] text-muted">
            {held ? `${byId.get(held)?.name} i hånden` : 'Tryk en gæst, så en stol'}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {GUESTS.map((g) => (
              <div
                key={g.id}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                  held === g.id ? 'border-ink bg-[#eef1e6]' : 'border-transparent hover:bg-shell'
                } ${g.attending ? '' : 'opacity-55'}`}
              >
                <button
                  type="button"
                  onClick={() => setHeld(held === g.id ? null : g.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-tint text-[0.6rem] font-bold text-ink">
                    {initials(g.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8rem] text-ink">{g.name}</span>
                </button>
                {seated.has(g.id) && (
                  <button
                    type="button"
                    onClick={() => setPlan((p) => unseatGuest(p, g.id))}
                    className="shrink-0 text-[0.65rem] text-terracotta cursor-pointer"
                  >
                    ryd
                  </button>
                )}
                {g.dietary && <span className="h-2 w-2 shrink-0 rounded-full bg-terracotta" />}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
