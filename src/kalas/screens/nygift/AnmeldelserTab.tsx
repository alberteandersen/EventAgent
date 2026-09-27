import * as React from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Star, ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { bookedVendors, reviewProgress, groupByCategory, CATEGORY_LABELS } from './reviews';
import type { VenueRow } from '@/lib/db/types';

export default function AnmeldelserTab() {
  const { t } = useLang();
  const { venues, event, saveVenueReview } = useWedding();

  const booked = bookedVendors(venues, event?.chosen_venue_id ?? null);
  const { done, total } = reviewProgress(booked);
  const groups = groupByCategory(booked);

  if (booked.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border border-dashed border-[#dcdfdb] bg-[#ffffff] px-7 py-14 text-center"
      >
        <Users size={22} className="mx-auto text-[#9a9686]" />
        <p className="mt-3 font-serif text-xl text-[#24413a]">{t('Ingen bookede leverandører endnu')}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#5f6b66]">
          {t('Når I markerer nogen som booket under Venue & leverandører, kan I bedømme dem her bagefter.')}
        </p>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6 rounded-[28px] border border-[#dcdfdb] bg-[#ffffff] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-md text-sm text-[#5f6b66]">
          {t('Skriv det ned mens I husker det, hvad gik godt, og hvem ville I anbefale videre.')}
        </p>
        <p className="shrink-0 text-sm font-bold text-[#7d938a]">
          {t('{done} af {total} bedømt', { done, total })}
        </p>
      </div>

      {groups.map(({ category, vendors }) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="font-serif text-lg text-[#24413a]">{t(CATEGORY_LABELS[category])}</h2>
          {vendors.map((vendor) => (
            <VendorReview key={vendor.id} vendor={vendor} onSave={saveVenueReview} />
          ))}
        </section>
      ))}
    </motion.section>
  );
}

function VendorReview({ vendor, onSave }: {
  vendor: VenueRow;
  onSave: (id: string, patch: { own_rating?: number | null; own_review?: string | null; own_recommend?: boolean | null }) => Promise<void>;
}) {
  const { t } = useLang();
  const [review, setReview] = useState(vendor.own_review ?? '');
  // The stars under the pointer light up before the click, so the rating
  // being given is visible before it is given.
  const [hover, setHover] = useState(0);
  const rating = vendor.own_rating ?? 0;
  const lit = hover || rating;

  return (
    <div className={cn(
      'rounded-[18px] border px-5 py-4',
      rating > 0 ? 'border-[#d3dcc4] bg-[#e8f0ec]' : 'border-[#e6e9e5] bg-[#f8f9f8]',
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#24413a]">{vendor.name}</p>
          {vendor.address && (
            <p className="truncate text-[13px] text-[#5f6b66]">{vendor.address}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                // Clicking the current rating clears it, so a misclick is undoable.
                onClick={() => void onSave(vendor.id, { own_rating: rating === n ? null : n })}
                onMouseEnter={() => setHover(n)}
                aria-label={t('Giv {n} ud af 5', { n })}
                aria-pressed={n === rating}
                className="p-0.5 cursor-pointer transition-transform hover:scale-110"
              >
                <Star
                  size={20}
                  className={cn('transition-colors', n <= lit ? 'text-[#c9a227]' : 'text-[#c6cbc6]', hover > 0 && n <= lit && n > rating && 'opacity-70')}
                  fill={n <= lit ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void onSave(vendor.id, { own_recommend: vendor.own_recommend === true ? null : true })}
              aria-label={t('Vil anbefale')}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-colors cursor-pointer',
                vendor.own_recommend === true ? 'bg-[#24413a] text-[#f8f9f8]' : 'text-[#9a9686] hover:bg-white/70',
              )}
            >
              <ThumbsUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => void onSave(vendor.id, { own_recommend: vendor.own_recommend === false ? null : false })}
              aria-label={t('Vil ikke anbefale')}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-colors cursor-pointer',
                vendor.own_recommend === false ? 'bg-[#b34e37] text-white' : 'text-[#9a9686] hover:bg-white/70',
              )}
            >
              <ThumbsDown size={14} />
            </button>
          </div>
        </div>
      </div>

      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        onBlur={() => review !== (vendor.own_review ?? '') && void onSave(vendor.id, { own_review: review.trim() || null })}
        rows={2}
        placeholder={t('Hvordan gik det? Kun jer der ser det.')}
        aria-label={t('Jeres anmeldelse af {name}', { name: vendor.name })}
        className="mt-3 w-full resize-none rounded-[12px] border border-[#e6e9e5] bg-white/60 px-3.5 py-2.5 text-sm leading-relaxed text-[#24413a] placeholder:text-[#9a9686] focus:outline-none"
      />
    </div>
  );
}
