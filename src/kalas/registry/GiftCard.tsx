"use client";

/* One gift tile, shared by all three registry surfaces: the couple's screen,
   the token site renderer and the AI site's portal grid. Presentation only —
   no data fetching, no mutators, so src/app/w/[slug] can import it too.

   The image carries the card, the way Ønskeskyen does it: a 4:5 photo with the
   price on it and a "reserved" band across the bottom. Everything a caller
   needs to differ about goes in `actions` (couple) or `footer` (guests). */

import { useState } from 'react';
import { Gift, Heart } from 'lucide-react';
import { cn } from '../ui';
import { useLang } from '../i18n';
import { formatPrice } from './gifts';
import type { CSSProperties, ReactNode } from 'react';

export type GiftCardItem = {
  title: string;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  store_name: string | null;
  favourite?: boolean | null;
};

export default function GiftCard({
  item, reserved, reservedBy, actions, footer, onImageClick, tone = 'kalas', titleStyle,
}: {
  item: GiftCardItem;
  reserved: boolean;
  /** Couple's screen only — guests must never see who took what. */
  reservedBy?: string | null;
  /** Hover controls laid over the image (edit, open, delete). */
  actions?: ReactNode;
  /** Sits under the card body — the guests' "Reservér gave" button. */
  footer?: ReactNode;
  onImageClick?: () => void;
  /**
   * 'kalas' paints the card in the app palette. 'inherit' borrows the
   * surrounding page's colours instead — both wedding-site renderers pick their
   * own palette per couple, and a cream card dropped into a dark one looks like
   * a bug. Same shape either way; only the surfaces change.
   */
  tone?: 'kalas' | 'inherit';
  /** The site design's display font, for the two public renderers. */
  titleStyle?: CSSProperties;
}) {
  const { t } = useLang();
  // Registry images are hotlinked straight from the webshop and never copied
  // into storage, so they rot and some shops refuse foreign referrers. Falling
  // back to the placeholder keeps the grid intact instead of showing a broken
  // image icon.
  const [broken, setBroken] = useState(false);
  const price = formatPrice(item.price_cents, item.currency);
  const showImage = Boolean(item.image_url) && !broken;
  const borrowed = tone === 'inherit';

  return (
    <div className={cn(
      'group flex flex-col overflow-hidden rounded-2xl transition-shadow',
      borrowed
        ? 'border border-current/15 bg-current/[0.04]'
        : 'rule bg-card hover:shadow-[0_8px_24px_rgba(36,65,58,0.06)]',
      reserved && 'opacity-80',
    )}>
      <div
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden',
          borrowed ? 'bg-current/10' : showImage ? 'bg-shell' : 'bg-sage-tint',
        )}
        onClick={onImageClick}
        role={onImageClick ? 'button' : undefined}
        tabIndex={onImageClick ? 0 : undefined}
        onKeyDown={onImageClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onImageClick(); } } : undefined}
      >
        {showImage ? (
          <img
            src={item.image_url as string}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className={cn(
              'h-full w-full object-cover transition-transform duration-500 ease-out',
              !reserved && 'group-hover:scale-[1.04]',
              reserved && 'grayscale-[0.35]',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gift size={26} className={borrowed ? 'opacity-30' : 'text-ink/30'} aria-hidden />
          </div>
        )}

        {price && (
          <span className={cn(
            'absolute right-2 top-2 rounded-full px-2.5 py-1 text-[0.72rem] font-medium backdrop-blur-sm',
            borrowed ? 'bg-white/85 text-[#141a13]' : 'bg-card/95 text-ink',
          )}>
            {price}
          </span>
        )}

        {item.favourite && (
          <span
            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
            title={t('Ønskes mest')}
          >
            <Heart size={13} className="fill-terracotta text-terracotta" aria-hidden />
            <span className="sr-only">{t('Ønskes mest')}</span>
          </span>
        )}

        {actions && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[#141a13]/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
            {actions}
          </div>
        )}

        {reserved && (
          <span className={cn(
            'absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[0.62rem] font-medium uppercase tracking-[0.14em]',
            borrowed ? 'bg-[#141a13]/80 text-white' : 'bg-ink text-canvas',
          )}>
            {reservedBy ? t('Reserveret · {name}', { name: reservedBy }) : t('Reserveret')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p
          style={titleStyle}
          className={cn(
            'text-[0.98rem] leading-tight',
            !titleStyle && 'font-serif',
            borrowed ? undefined : reserved ? 'text-ink/60' : 'text-ink',
            borrowed && reserved && 'opacity-70',
          )}
        >
          {item.title}
        </p>
        {item.store_name && (
          <p className={cn('text-[0.74rem]', borrowed ? 'opacity-65' : 'text-muted')}>{item.store_name}</p>
        )}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
