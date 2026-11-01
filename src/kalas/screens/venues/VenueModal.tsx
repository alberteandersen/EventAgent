"use client";

import { MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dialog, cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueBadge } from '@/lib/venue/filter';

/* One venue, in a modal over the list it was opened from. Udforsk fills it
   from a search result (VenuePanel) and Favoritter from a saved row
   (VenueDetail); the frame, the pictures and the facts are the same, so a
   venue looks like itself on both tabs. */

export type VenueFact = { icon: ReactNode; label: string; value: string };

export default function VenueModal({
  open, onClose, name, address, photos, onPhoto, facts, note, description, badges = [], footer, children,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  address?: string | null;
  photos: string[];
  onPhoto: (index: number) => void;
  /** The numbers a couple asks for first. */
  facts: VenueFact[];
  /** Why Juno picked it. */
  note?: string | null;
  description?: string | null;
  badges?: VenueBadge[];
  footer: ReactNode;
  /** Under the pictures and the facts, across the full width. */
  children?: ReactNode;
}) {
  const { t } = useLang();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={name}
      description={address && (
        <span className="flex items-start gap-1.5">
          <MapPin size={12} className="mt-0.5 shrink-0" />{address}
        </span>
      )}
      footer={footer}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Pictures */}
        {photos.length > 0 ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onPhoto(0)}
              aria-label={t('Se billeder af {name}', { name })}
              className="relative h-52 w-full cursor-pointer overflow-hidden rounded-xl bg-sage-wash"
            >
              <img src={photos[0]} alt={name} className="h-full w-full object-cover" />
            </button>
            {photos.length > 1 && (
              <div className="flex gap-2">
                {photos.slice(1, 5).map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onPhoto(i + 1)}
                    aria-label={t('Billede {n}', { n: i + 2 })}
                    className="h-16 flex-1 cursor-pointer overflow-hidden rounded-lg bg-sage-wash"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-xl bg-sage-wash">
            <MapPin size={24} className="text-ink opacity-40" />
          </div>
        )}

        {/* What it is */}
        <div className="flex min-w-0 flex-col gap-3.5">
          {facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line-soft pb-3">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sage-strong">{f.label}</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink">
                    {f.icon}{f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {note && (
            <div className="rounded-xl bg-sage-wash px-4 py-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sage-strong">
                {t('Junos note')}
              </p>
              <p className="mt-1 font-serif text-[0.95rem] italic leading-snug text-ink">{note}</p>
            </div>
          )}

          {description && (
            <p className="text-[0.84rem] leading-relaxed text-ink-soft">{description}</p>
          )}

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.id}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[0.68rem] font-semibold',
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
        </div>
      </div>

      {children}
    </Dialog>
  );
}
