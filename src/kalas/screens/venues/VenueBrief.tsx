"use client";

/* The search, said in two lines: where, and what they are dreaming of.
 *
 * This replaces a globe and a side panel that had to be worked through,
 * Earth, country, region, town, before a single venue showed. Most couples
 * told us where in onboarding, so the places are already filled in when the
 * page opens and the venues are already under it. What is left to do here is
 * change the answer, or say more. */

import { useState } from 'react';
import { ChevronDown, Compass, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { placeKey, placeLabel, type SearchPlace } from '@/lib/venue/searchPlan';

export default function VenueBrief({
  places, onAdd, onRemove, wish, onWish, exploring, onToggleExplore, searching,
}: {
  places: SearchPlace[];
  /** Whatever they typed: a country, one of our regions, or a place as written. */
  onAdd: (text: string) => void;
  onRemove: (key: string) => void;
  /** The description the current results were searched with. */
  wish: string;
  onWish: (wish: string) => void;
  exploring: boolean;
  onToggleExplore: () => void;
  searching: boolean;
}) {
  const { t, lang } = useLang();
  const [place, setPlace] = useState('');
  const [draft, setDraft] = useState(wish);
  /* When the search's own wish changes from outside (cleared, or a new
     search), the box follows it. Compared during render rather than in an
     effect, so there is no frame showing the old text. */
  const [seen, setSeen] = useState(wish);
  if (seen !== wish) { setSeen(wish); setDraft(wish); }

  const addPlace = () => {
    const text = place.trim();
    if (!text) return;
    onAdd(text);
    setPlace('');
  };
  const submitWish = () => {
    const next = draft.trim();
    if (next !== wish) onWish(next);
  };
  const dirty = draft.trim() !== wish;

  return (
    <div className="rounded-[24px] border border-line bg-white">
      {/* ── Where ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <MapPin size={17} className="shrink-0 text-sage-strong" aria-hidden />
        {places.map((p) => {
          const label = placeLabel(p, lang);
          return (
            <span key={placeKey(p)} className="inline-flex items-center gap-1 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 text-[0.82rem] font-medium text-paper">
              {label}
              <button
                type="button"
                onClick={() => onRemove(placeKey(p))}
                aria-label={t('Fjern {name}', { name: label })}
                className="flex h-6 w-6 items-center justify-center rounded-full text-sage-tint transition-colors hover:bg-white/15 hover:text-paper cursor-pointer"
              >
                <X size={13} />
              </button>
            </span>
          );
        })}
        {/* focus-shell: the ring goes round the pill, not as a hard box on the bare input. */}
        <span className="focus-shell flex min-w-[9rem] flex-1 rounded-full px-1">
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addPlace(); }
            // As in any tag field: backspace in the empty box takes the last one back.
            else if (e.key === 'Backspace' && !place && places.length > 0) onRemove(placeKey(places[places.length - 1]));
          }}
          onBlur={addPlace}
          maxLength={80}
          placeholder={places.length > 0 ? t('Tilføj et sted') : t('Hvor vil I lede? F.eks. Toscana, Fyn eller Italien')}
          aria-label={t('Hvor vil I lede?')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[0.9rem] text-ink placeholder:text-muted focus:outline-none"
        />
        </span>
        <button
          type="button"
          onClick={onToggleExplore}
          aria-expanded={exploring}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.78rem] font-semibold transition-colors cursor-pointer',
            exploring ? 'border-ink bg-sage-wash text-ink' : 'border-line text-muted hover:border-ink hover:text-ink',
          )}
        >
          <Compass size={14} aria-hidden /> {t('Udforsk områder')}
          <ChevronDown size={14} className={cn('transition-transform', exploring && 'rotate-180')} aria-hidden />
        </button>
      </div>

      {/* ── What ──────────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); submitWish(); }}
        className="flex items-center gap-2 border-t border-line-soft px-4 py-3 sm:px-5"
      >
        <Sparkles size={17} className="shrink-0 text-sage-strong" aria-hidden />
        <span className="focus-shell flex min-w-0 flex-1 rounded-full px-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder={t('Beskriv jeres drømmested, f.eks. vingård med udsigt og plads til at overnatte')}
          aria-label={t('Beskriv jeres drømmested')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[0.9rem] text-ink placeholder:text-muted focus:outline-none"
        />
        </span>
        {wish && !dirty && (
          <button
            type="button"
            onClick={() => onWish('')}
            aria-label={t('Ryd')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
        <button
          type="submit"
          disabled={!dirty || places.length === 0}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.78rem] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} {t('Søg')}
        </button>
      </form>
    </div>
  );
}
