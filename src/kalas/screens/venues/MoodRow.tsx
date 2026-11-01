"use client";

/* What kind of place: a row of pictures instead of a menu of words.
 *
 * "Stemning" used to be one of seven pills, a list of thirteen nouns that had
 * to be opened to be read. A couple who has never planned a wedding does not
 * know they want an orangery until they see one, so the choice is drawn with
 * photographs of the venues the search actually found, and each card says how
 * many of them there are. */

import {
  Castle, Landmark, Warehouse, Flower2, Waves, Grape, Hotel, Factory, Building2,
  Droplets, Church, UtensilsCrossed, Tent, Check, type LucideIcon,
} from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueSuggestion } from '@/lib/venue/search';
import type { VenueSetting } from '@/lib/venue/facts';
import { SETTING_LABELS } from './VenueFilterBar';

/* Their own order, most asked-for first, and it never changes: cards that
   reshuffled as each area's results landed would move under the pointer. */
const MOODS: { id: VenueSetting; icon: LucideIcon }[] = [
  { id: 'castle', icon: Castle },
  { id: 'manor', icon: Landmark },
  { id: 'barn', icon: Warehouse },
  { id: 'garden', icon: Flower2 },
  { id: 'coastal', icon: Waves },
  { id: 'vineyard', icon: Grape },
  { id: 'lakeside', icon: Droplets },
  { id: 'hotel', icon: Hotel },
  { id: 'restaurant', icon: UtensilsCrossed },
  { id: 'industrial', icon: Factory },
  { id: 'museum', icon: Building2 },
  { id: 'chapel', icon: Church },
  { id: 'tented', icon: Tent },
];

export default function MoodRow({ venues, selected, onToggle }: {
  /** Everything found so far, before the filters: a mood they have not
   *  picked yet still needs its picture and its count. */
  venues: VenueSuggestion[];
  selected: VenueSetting[];
  onToggle: (setting: VenueSetting) => void;
}) {
  const { t, tn } = useLang();

  const found = new Map<VenueSetting, { count: number; photo: string | null }>();
  for (const v of venues) {
    const setting = v.facts.setting;
    if (!setting) continue;
    const entry = found.get(setting) ?? { count: 0, photo: null };
    entry.count += 1;
    entry.photo ??= v.photo;
    found.set(setting, entry);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted">{t('Hvilken slags sted?')}</p>
      {/* -mx / px so the row can scroll under the page gutter on a phone
          without its first card sitting flush against the edge. */}
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]">
        {MOODS.map(({ id, icon: Icon }) => {
          const hit = found.get(id);
          const on = selected.includes(id);
          const label = t(SETTING_LABELS[id]);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              aria-label={hit ? `${label}, ${tn(hit.count, '{n} sted', '{n} steder')}` : label}
              className={cn(
                'group relative h-[5.25rem] w-[7.75rem] shrink-0 overflow-hidden rounded-2xl border text-left transition-shadow cursor-pointer',
                on ? 'border-ink shadow-[0_0_0_2px_var(--color-ink)]' : 'border-line-soft hover:border-ink/50',
                !hit?.photo && (on ? 'bg-sage-tint' : 'bg-shell'),
              )}
            >
              {hit?.photo ? (
                <>
                  <img src={hit.photo} alt="" loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                </>
              ) : (
                <Icon size={20} className="absolute left-3 top-3 text-ink opacity-45" aria-hidden />
              )}
              <span className={cn(
                'absolute inset-x-3 bottom-2 text-[0.8rem] font-semibold leading-tight',
                hit?.photo ? 'text-white' : 'text-ink',
              )}>
                {label}
              </span>
              {on ? (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
                  <Check size={12} aria-hidden />
                </span>
              ) : hit ? (
                <span className={cn(
                  'absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold',
                  hit.photo ? 'bg-black/45 text-white backdrop-blur-sm' : 'bg-card text-muted',
                )}>
                  {hit.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
