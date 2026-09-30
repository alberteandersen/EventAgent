"use client";

import { motion } from 'motion/react';
import { Heart, Check, ArrowLeft } from 'lucide-react';
import { Eyebrow, cn } from '../../ui';
import { useLang } from '../../i18n';
import { type DisplayVenue, RatingBadge, imgSrc } from './shared';

/* ═══════════════════════════════════════════════════════════════════════
   VENUE COMPARISON VIEW
═══════════════════════════════════════════════════════════════════════ */
type ComparisonField = { label: string; value: string; wide?: boolean };

function buildComparisonFields(v: DisplayVenue): ComparisonField[] {
  const fields: ComparisonField[] = [
    { label: 'Pris', value: v.price || '-' },
    { label: 'Kapacitet', value: v.capacity || '-' },
    { label: 'Beliggenhed', value: v.location || '-' },
    {
      label: 'Vurdering',
      value: v.rating != null
        ? `${v.rating.toFixed(1)}${v.reviewCount ? ` · ${v.reviewCount} anm.` : ''}`
        : '-',
    },
  ];

  for (const item of v.research?.practical?.slice(0, 4) ?? []) {
    fields.push({ label: item.key, value: item.value });
  }

  const notes = v.description?.trim()
    || v.quote?.trim()
    || v.why.slice(0, 2).join(' · ')
    || '-';

  fields.push({ label: 'Noter', value: notes, wide: true });

  if (v.research?.highlights?.length) {
    fields.push({
      label: 'Højdepunkter',
      value: v.research.highlights.slice(0, 3).join(' · '),
      wide: true,
    });
  }

  return fields;
}

export function ComparisonView({
  venues, saved, booked, onBack, onToggleSave, onBook,
}: {
  venues: DisplayVenue[]; saved: Set<string>; booked: string | null;
  onBack: () => void; onToggleSave: (id: string) => void; onBook: (id: string) => void;
}) {
  const { t } = useLang();
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <div className="px-6 pt-8 sm:px-9 lg:px-12">
        <button onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
          <ArrowLeft size={13} /> {t('Tilbage')}
        </button>
        <Eyebrow>{t('Sammenligning · {n} venues', { n: venues.length })}</Eyebrow>
        <h2 className="display mt-3 text-[clamp(2rem,4vw,3rem)] text-ink">
          {t('Side om')} <span className="italic">{t('side')}</span>
        </h2>
        <p className="mt-2 max-w-xl text-[0.9rem] text-ink-soft">
          {t('Sammenlign det der betyder noget, pris, kapacitet, noter og mere.')}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6 px-6 pb-16 sm:px-9 lg:px-12">
        {venues.map((v, i) => {
          const isBooked = booked === v.id;
          const isSaved = saved.has(v.id);
          const fields = buildComparisonFields(v);

          return (
            <motion.article
              key={v.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="rule overflow-hidden rounded-[22px] bg-card"
            >
              <div className="flex flex-col lg:flex-row">
                {/* Left, photo */}
                <div className="relative w-full shrink-0 lg:w-[300px] xl:w-[340px]">
                  <div className="aspect-[4/3] lg:min-h-full lg:aspect-auto lg:h-full">
                    <img
                      src={imgSrc(v.image)}
                      alt={v.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-transparent" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <RatingBadge rating={v.rating} count={v.reviewCount} />
                    {isBooked && (
                      <span className="rounded-full bg-ink px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-canvas">
                        {t('Booket')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right, attribute grid */}
                <div className="flex min-w-0 flex-1 flex-col gap-5 p-6 lg:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-[1.45rem] leading-tight text-ink">{v.name}</h3>
                      {v.location && (
                        <p className="mt-1 text-[0.8rem] text-muted">{v.location}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSave(v.id)}
                        aria-label={isSaved ? t('Fjern fra listen') : t('Gem venue')}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full rule transition-all cursor-pointer',
                          isSaved ? 'bg-ink text-canvas' : 'hover:bg-shell',
                        )}
                      >
                        <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBook(v.id)}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer"
                      >
                        {isBooked ? <><Check size={12} /> {t('Booket')}</> : t('Vælg venue')}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div
                        key={`${v.id}-${field.label}`}
                        className={cn(
                          'rounded-[14px] border border-[var(--color-line)] bg-white px-4 py-3.5',
                          field.wide && 'sm:col-span-2',
                        )}
                      >
                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted">
                          {t(field.label)}
                        </p>
                        <p className={cn(
                          'mt-1.5 text-[0.88rem] leading-relaxed text-ink',
                          field.wide ? 'whitespace-pre-wrap' : 'font-medium',
                        )}>
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {v.why.length > 0 && !v.research?.highlights?.length && (
                    <ul className="space-y-2 border-t border-[var(--color-line)] pt-4">
                      {v.why.slice(0, 3).map((r) => (
                        <li key={r} className="flex items-start gap-2 text-[0.8rem] leading-snug text-ink-soft">
                          <Check size={11} className="mt-0.5 shrink-0 text-sage" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.div>
  );
}
