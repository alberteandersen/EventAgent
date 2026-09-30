"use client";

/* One table on the canvas: its body, its chairs, and a guest in each chair.
 *
 * Every chair is a real <button> carrying `data-seat="tableId:index"`. That
 * one attribute is the whole drop target system — a pointer release does an
 * elementFromPoint and reads it, so hit-testing survives zooming and panning
 * without a single bounding-box calculation. It also means the plan is
 * operable from the keyboard for free: tab to a guest, Enter to pick them up,
 * tab to a chair, Enter to sit them down. */

import { memo } from 'react';
import { GripVertical, Pencil } from 'lucide-react';
import { cn } from '../../ui';
import {
  SEAT_R, initials, seatLabel, seatPoints, tableSize,
  type PlanGuest, type SeatingTable,
} from './model';

export interface TableNodeProps {
  table: SeatingTable;
  guests: Map<string, PlanGuest>;
  /** The guest currently in hand — their chair is dimmed, empty chairs invite. */
  held: string | null;
  selected: boolean;
  onSelect: () => void;
  onSeatClick: (index: number) => void;
  /** Starts a drag (or a tap) on the guest sitting in this chair. */
  onSeatPointerDown: (guestId: string, e: React.PointerEvent) => void;
  onTablePointerDown: (e: React.PointerEvent) => void;
  onRename: () => void;
}

function TableNodeInner({
  table, guests, held, selected, onSelect, onSeatClick, onSeatPointerDown,
  onTablePointerDown, onRename,
}: TableNodeProps) {
  const points = seatPoints(table.shape, table.seats);
  const { w, h } = tableSize(table.shape, table.seats);
  const taken = table.seated.filter(Boolean).length;

  return (
    <div
      className="absolute"
      style={{ left: table.x, top: table.y, transform: 'translate(-50%, -50%)' }}
    >
      {/* The table body. Dragging it moves the table; clicking selects it. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${table.name}, ${taken} af ${table.seats} pladser`}
        onPointerDown={onTablePointerDown}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        className={cn(
          'group absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 cursor-grab',
          'flex-col items-center justify-center border bg-white transition-colors active:cursor-grabbing',
          table.shape === 'round' ? 'rounded-full' : 'rounded-2xl',
          selected ? 'border-ink shadow-[0_6px_20px_rgba(18,51,43,0.12)]' : 'border-line',
        )}
        style={{ width: w, height: h }}
      >
        <span className="pointer-events-none font-serif text-[1.35rem] leading-none text-ink">
          {table.name}
        </span>
        <span className="pointer-events-none mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sage-strong">
          {taken}/{table.seats}
        </span>
        <span className="pointer-events-none absolute left-2 top-2 text-line-strong opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical size={13} />
        </span>
        {selected && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Omdøb ${table.name}`}
            className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-sage hover:bg-shell hover:text-ink"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {/* Chairs */}
      {points.map((p, i) => {
        const guestId = table.seated[i] ?? null;
        const guest = guestId ? guests.get(guestId) ?? null : null;
        const isHeld = guestId !== null && guestId === held;
        const below = p.y >= 0;

        return (
          <div
            key={i}
            className="absolute"
            style={{ left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)` }}
          >
            <button
              type="button"
              data-seat={`${table.id}:${i}`}
              onClick={() => onSeatClick(i)}
              onPointerDown={(e) => { if (guestId) onSeatPointerDown(guestId, e); }}
              aria-label={guest
                ? `${guest.name}, plads ${i + 1} ved ${table.name}`
                : `Ledig plads ${i + 1} ved ${table.name}`}
              className={cn(
                'relative flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
                'text-[0.62rem] font-bold transition-colors cursor-pointer',
                guest
                  ? 'border border-sage bg-sage-tint text-ink hover:border-ink'
                  : 'border border-dashed border-line-strong bg-white text-transparent hover:border-ink hover:bg-sage-wash',
                // A guest in hand makes every free chair a target worth seeing.
                held && !guest && 'border-solid border-ink bg-sage-wash',
                isHeld && 'opacity-40',
                guest && !guest.attending && 'opacity-55',
              )}
              style={{ width: SEAT_R * 2, height: SEAT_R * 2 }}
            >
              {guest ? initials(guest.name) : ''}
              {guest?.dietary && (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-terracotta"
                />
              )}
            </button>

            {guest && (
              <span
                className={cn(
                  // Never wider than the chair pitch, or two neighbours collide.
                  'pointer-events-none absolute left-1/2 w-[3.4rem] -translate-x-1/2 truncate text-center text-[0.62rem] leading-tight text-ink-soft',
                  below ? 'top-3' : 'bottom-3',
                )}
              >
                {seatLabel(guest.name)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* A plan can hold thirty tables and three hundred chairs; without this every
   pointer move during a drag would re-render all of them. */
export const TableNode = memo(TableNodeInner);
