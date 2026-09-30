"use client";

import { useEffect, useRef, useState } from 'react';
import { MapPin, PenLine, Check, Building2 } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import { chosenVenueArea, effectiveLocation } from '../../lib/location';

/**
 * The shared location control, pinned top-right of the venue explore. It shows
 * (and edits) the couple's location — set by hand, or taken from the venue they
 * chose — which every non-venue page uses to find local vendors.
 */
export default function LocationChip({ className }: { className?: string }) {
  const { event, venues, updateEvent } = useWedding();
  const { t } = useLang();

  const location = effectiveLocation(event, venues);
  const venueArea = chosenVenueArea(event, venues);
  const canUseVenue = Boolean(venueArea) && venueArea !== (event?.location ?? '').trim();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(location);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openEditor = () => {
    setValue(location);
    setOpen(true);
  };

  // Focus the input when the editor opens (DOM side effect only, no setState).
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commit = async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateEvent({ location: trimmed });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openEditor())}
        aria-expanded={open}
        className={cn(
          'flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors cursor-pointer',
          location
            ? 'border-line bg-white text-ink hover:border-ink'
            : 'border-ink bg-sage-wash text-ink',
        )}
      >
        <MapPin size={13} className="shrink-0" />
        <span className="truncate">{location || t('Vælg lokation')}</span>
        <PenLine size={12} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-2xl border border-line bg-white p-3 shadow-[0_16px_40px_rgba(18,51,43,0.16)]">
            <p className="px-1 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-sage-strong">
              {t('Jeres lokation')}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commit(value);
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={t('f.eks. København, Danmark')}
                className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[0.82rem] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void commit(value)}
                disabled={!value.trim() || saving}
                aria-label={t('Gem lokation')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Check size={15} />
              </button>
            </div>

            {canUseVenue && (
              <button
                type="button"
                onClick={() => void commit(venueArea)}
                className="mt-2 flex w-full items-center gap-2 rounded-xl border border-line-soft bg-white px-3 py-2 text-left text-[0.76rem] text-ink transition-colors hover:bg-paper cursor-pointer"
              >
                <Building2 size={13} className="shrink-0 text-sage" />
                <span className="min-w-0 flex-1 truncate">{t('Brug jeres venue: {area}', { area: venueArea })}</span>
              </button>
            )}

            <p className="px-1 pt-2 text-[0.68rem] leading-snug text-muted">
              {t('Leverandører på de andre faner findes nær dette sted.')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
