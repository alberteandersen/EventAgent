"use client";

import { Check, MapPin, Star, Loader2, Plus, X, Expand } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueSuggestion } from '@/lib/venue/search';
import type { VenueBadge } from '@/lib/venue/filter';

/* Picture-rich venue card for the discovery list — click the image to browse
   photos, or add it straight to the couple's list. No swipe. */
export default function VenueCard({ v, badges, saved, saving, highlighted = false, onOpen, onSave, onDismiss, onExpand, onHover }: {
  v: VenueSuggestion; badges: VenueBadge[]; saved: boolean; saving: boolean;
  /** Its pin on the map is under the pointer. */
  highlighted?: boolean;
  onOpen: () => void;
  onSave: () => void; onDismiss: () => void; onExpand?: () => void;
  /** So the map can pick out this venue's pin while the card is hovered. */
  onHover?: (hovered: boolean) => void;
}) {
  const { t, tn } = useLang();
  return (
    <div
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-[0_10px_28px_rgba(18,51,43,0.10)]',
        highlighted ? 'border-ink shadow-[0_10px_28px_rgba(18,51,43,0.14)]' : 'border-line-soft',
      )}
    >
      {/* The picture opens the venue; the corner button opens the photos.
          Siblings, not nested, a button inside a button is invalid HTML and
          the inner one stops working. */}
      <div className="relative h-44 w-full overflow-hidden bg-sage-wash">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={t('Åbn {name}', { name: v.name })}
          className="block h-full w-full cursor-pointer"
        >
          {v.photo ? (
            <img src={v.photo} alt={v.name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin size={22} className="text-ink opacity-40" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </button>
        {v.rating != null && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm">
            <Star size={11} fill="currentColor" className="text-amber" />
            {v.rating.toFixed(1)}
            {v.review_count ? <span className="font-normal text-muted">({v.review_count})</span> : null}
          </span>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={t('Se billeder af {name}', { name: v.name })}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink-deep/40 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Expand size={14} />
          </button>
        )}
        {v.photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] font-semibold text-white backdrop-blur-sm">
            {tn(v.photos.length, '{n} billede', '{n} billeder')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-serif text-[1.05rem] leading-tight text-ink hover:underline underline-offset-4 cursor-pointer"
        >
          {v.name}
        </button>
        {v.address && (
          <p className="mt-1 flex items-start gap-1 text-[0.72rem] text-muted">
            <MapPin size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-1">{v.address}</span>
          </p>
        )}
        {v.why_fit && <p className="mt-2 line-clamp-2 text-[0.78rem] leading-snug text-ink-soft">{v.why_fit}</p>}
        {/* The facts the couple filtered on, stated plainly, including the
            ones we do not know, so a blank is never mistaken for a "no". */}
        {badges.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b.id}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[0.64rem] font-semibold',
                  b.tone === 'good' && 'bg-sage-wash text-ink',
                  b.tone === 'warn' && 'bg-clay-tint text-clay-ink',
                  b.tone === 'neutral' && 'bg-shell text-muted',
                )}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saved || saving}
            onClick={onSave}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[0.74rem] font-bold transition-colors',
              saved ? 'bg-sage-wash text-ink cursor-default' : 'bg-ink text-white hover:opacity-90 cursor-pointer',
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Plus size={13} />}
            {saved ? t('På listen') : t('Tilføj til liste')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('Afvis {name}', { name: v.name })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
