"use client";

/* The couple's team, one card per category.
 *
 * The five categories on this board used to be a constant, which is fine for
 * the wedding the constant was written for and wrong for everyone else — a
 * couple with a food truck and a fyrværker had nowhere to put them, and a
 * couple doing their own flowers had a dashed card nagging them forever. The
 * list is now theirs: add any category the app knows, name one it does not,
 * and remove the ones that are not part of their day.
 *
 * It lives in events.requirements, which is already jsonb, so this needs no
 * table. An empty list is not the same as an unset one — a couple who removed
 * every card gets an empty board, not the defaults back. */

import { useMemo, useState } from 'react';
import {
  Camera, Flower2, Home, Music, UtensilsCrossed, Plus, X, BedDouble,
  Video, Wine, Cake, Scissors, Tag, Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import { HUB_CATS, isHubCat, type HubCat, type HubTab } from './shared';
import type { VendorCategory, VenueRow } from '@/lib/db/types';

/** What the app knows about a category it can actually go and find. */
type Catalogue = {
  icon: LucideIcon;
  backend: VendorCategory;
  leadTime: string;
};

const CATALOGUE: Record<HubCat, Catalogue> = {
  venue: { icon: Home, backend: 'venue', leadTime: 'Book 12+ måneder inden. De fleste par vælger dette først.' },
  overnatning: { icon: BedDouble, backend: 'accommodation', leadTime: 'Book når venuet er på plads.' },
  fotografi: { icon: Camera, backend: 'photographer', leadTime: 'Book 9–12 måneder inden.' },
  video: { icon: Video, backend: 'photographer', leadTime: 'Book 9–12 måneder inden.' },
  blomster: { icon: Flower2, backend: 'florist', leadTime: 'Book 6–9 måneder inden.' },
  catering: { icon: UtensilsCrossed, backend: 'caterer', leadTime: 'Book 6–9 måneder inden.' },
  bar: { icon: Wine, backend: 'other', leadTime: 'Book 4–6 måneder inden.' },
  kage: { icon: Cake, backend: 'other', leadTime: 'Book 3–6 måneder inden.' },
  musik: { icon: Music, backend: 'musician', leadTime: 'Book 6–12 måneder inden.' },
  beauty: { icon: Scissors, backend: 'other', leadTime: 'Book 3–6 måneder inden.' },
};

/** The board a couple gets before they have touched it. */
const DEFAULT_SLOTS: HubCat[] = ['venue', 'fotografi', 'blomster', 'catering', 'musik'];

const SLOTS_KEY = 'booked_slots';
const MANUAL_KEY = 'booked_manual';
const CUSTOM = 'custom:';

/** A card on the board: one of the app's categories, or one they named. */
export interface BookedSlot {
  /** A HubCat id, or `custom:<label>`. */
  id: string;
  label: string;
}

function readSlots(requirements: Record<string, unknown> | undefined): BookedSlot[] {
  const raw = requirements?.[SLOTS_KEY];
  if (!Array.isArray(raw)) {
    return DEFAULT_SLOTS.map((id) => ({ id, label: labelOf(id) }));
  }
  return raw.filter((x): x is BookedSlot =>
    Boolean(x) && typeof x === 'object'
    && typeof (x as BookedSlot).id === 'string'
    && typeof (x as BookedSlot).label === 'string'
  );
}

function readManual(requirements: Record<string, unknown> | undefined): string[] {
  const raw = requirements?.[MANUAL_KEY];
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function labelOf(cat: HubCat): string {
  return HUB_CATS.find((c) => c.id === cat)?.label ?? cat;
}

export default function BookedPanel({
  onSwitchTab,
}: {
  onSwitchTab: (tab: HubTab, cat?: HubCat) => void;
}) {
  const { event, venues, updateEvent } = useWedding();
  const { t } = useLang();
  const chosenVenueId = event?.chosen_venue_id ?? null;

  const slots = useMemo(() => readSlots(event?.requirements), [event?.requirements]);
  const manual = useMemo(() => readManual(event?.requirements), [event?.requirements]);
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState('');

  const save = (next: Partial<Record<string, unknown>>) =>
    void updateEvent({ requirements: { ...(event?.requirements ?? {}), ...next } });

  const addSlot = (slot: BookedSlot) => {
    if (slots.some((s) => s.id === slot.id)) return;
    save({ [SLOTS_KEY]: [...slots, slot] });
    setAdding(false);
    setCustomName('');
  };

  const removeSlot = (id: string) => {
    save({
      [SLOTS_KEY]: slots.filter((s) => s.id !== id),
      [MANUAL_KEY]: manual.filter((m) => m !== id),
    });
  };

  const toggleManual = (id: string) => {
    save({
      [MANUAL_KEY]: manual.includes(id) ? manual.filter((m) => m !== id) : [...manual, id],
    });
  };

  /* Which booked vendor sits in which card.
   *
   * Several categories share one backend column — a bar, a cake and a beauty
   * team are all "other" to the database — so a booked row is handed to the
   * first card still waiting for one rather than appearing in all three. */
  const filled = useMemo(() => {
    const booked = venues.filter((v) => v.booked_at || v.id === chosenVenueId);
    const taken = new Set<string>();
    const out = new Map<string, VenueRow>();
    for (const slot of slots) {
      if (slot.id.startsWith(CUSTOM) || !isHubCat(slot.id)) continue;
      const backend = CATALOGUE[slot.id].backend;
      const hit = booked.find((v) => v.category === backend && !taken.has(v.id));
      if (hit) {
        taken.add(hit.id);
        out.set(slot.id, hit);
      }
    }
    return out;
  }, [venues, chosenVenueId, slots]);

  const bookedCount = filled.size + manual.filter((m) => slots.some((s) => s.id === m)).length;
  const unused = HUB_CATS.filter((c) => !slots.some((s) => s.id === c.id));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage">
        {t('Jeres team · {n} booket', { n: bookedCount })}
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted">
        {t('Hold styr på hele holdet ét sted, I bestemmer selv hvilke kategorier der hører til jeres dag.')}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => {
          const custom = slot.id.startsWith(CUSTOM) || !isHubCat(slot.id);
          const entry = custom ? null : CATALOGUE[slot.id as HubCat];
          const booked = custom ? null : filled.get(slot.id) ?? null;
          const done = Boolean(booked) || (custom && manual.includes(slot.id));
          // A category the app has never heard of gets a neutral label icon.
          const Icon = entry?.icon ?? Tag;

          return (
            <div
              key={slot.id}
              className={cn(
                'group relative flex min-h-[200px] flex-col rounded-[18px] border p-5 transition-colors',
                done
                  ? 'border-sage-tint bg-sage-wash'
                  : 'border-dashed border-line bg-white',
              )}
            >
              <button
                type="button"
                onClick={() => removeSlot(slot.id)}
                aria-label={t('Fjern {name} fra tavlen', { name: slot.label })}
                className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-sage opacity-0 transition-opacity hover:bg-shell hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-3 pr-8">
                <span className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  done ? 'bg-ink text-paper' : 'bg-shell text-muted',
                )}>
                  <Icon size={20} strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif text-[1.15rem] leading-tight text-ink">
                    {custom ? slot.label : t(slot.label)}
                  </h3>
                  {done && <p className="text-[0.72rem] font-medium text-sage-strong">{t('Booket ✓')}</p>}
                </div>
              </div>

              {booked ? (
                <div className="mt-4 flex-1">
                  <p className="font-serif text-[1.05rem] text-ink">{booked.name}</p>
                  {booked.price_hint && (
                    <p className="mt-1 text-[0.82rem] text-muted">{booked.price_hint}</p>
                  )}
                  {booked.address && (
                    <p className="mt-1 text-[0.78rem] text-muted">{booked.address}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onSwitchTab('shortlist', slot.id as HubCat)}
                    className="mt-4 text-[0.78rem] font-medium text-ink underline-offset-2 hover:underline cursor-pointer"
                  >
                    {t('Se detaljer')}
                  </button>
                </div>
              ) : custom ? (
                /* Kalas has no search for a category it has never heard of, so
                   a custom card is the couple's own tick-box. */
                <div className="mt-4 flex flex-1 flex-col">
                  <p className="text-[0.82rem] leading-relaxed text-muted">
                    {t('Jeres egen kategori, kryds af, når den er på plads.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleManual(slot.id)}
                    aria-pressed={manual.includes(slot.id)}
                    className={cn(
                      'mt-auto inline-flex h-8 items-center gap-1.5 self-start rounded-full border px-3 text-xs font-semibold transition-colors cursor-pointer',
                      manual.includes(slot.id)
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink text-ink hover:bg-paper',
                    )}
                  >
                    <Check size={13} />
                    {manual.includes(slot.id) ? t('Booket') : t('Marker som booket')}
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-1 flex-col">
                  <p className="text-[0.82rem] leading-relaxed text-muted">{t(entry!.leadTime)}</p>
                  <button
                    type="button"
                    onClick={() => onSwitchTab('explore', slot.id as HubCat)}
                    className="mt-auto inline-flex h-8 items-center gap-1.5 self-start rounded-full border border-ink px-3 text-xs font-semibold text-ink hover:bg-paper transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    {t('Booket? Tilføj her')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add a category */}
        <div className="flex min-h-[200px] flex-col rounded-[18px] border border-dashed border-line-strong bg-paper p-5">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 text-muted transition-colors hover:text-ink"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush">
                <Plus size={20} strokeWidth={1.6} />
              </span>
              <span className="text-[0.85rem] font-semibold">{t('Tilføj kategori')}</span>
            </button>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sage">
                  {t('Tilføj kategori')}
                </p>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setCustomName(''); }}
                  aria-label={t('Luk')}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-sage hover:text-ink"
                >
                  <X size={13} />
                </button>
              </div>

              {unused.length > 0 && (
                <div className="flex flex-wrap gap-1.5 overflow-y-auto">
                  {unused.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addSlot({ id: c.id, label: c.label })}
                      className="inline-flex h-8 cursor-pointer items-center rounded-full border border-line bg-white px-3 text-[0.76rem] font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      {t(c.label)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2">
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customName.trim()) {
                      addSlot({ id: `${CUSTOM}${customName.trim()}`, label: customName.trim() });
                    }
                  }}
                  placeholder={t('f.eks. Fyrværkeri')}
                  aria-label={t('Egen kategori')}
                  className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[0.8rem] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!customName.trim()}
                  onClick={() => addSlot({ id: `${CUSTOM}${customName.trim()}`, label: customName.trim() })}
                  className="flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-ink px-3.5 text-[0.76rem] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t('Tilføj')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {slots.length === 0 && (
        <p className="mt-6 text-[0.85rem] text-muted">
          {t('Tavlen er tom, tilføj de kategorier jeres dag har brug for.')}
        </p>
      )}
    </div>
  );
}
