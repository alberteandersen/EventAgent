"use client";

/* The "Mere" pill's contents — the filters a couple reaches for last.
 *
 * The venue budget lives here rather than in a pill of its own: it is already
 * decided on the budget page, arrives pre-set, and a couple who wants to bend
 * it once should not have to walk past it every time they scan the row. */

import { Wallet, Star, Route } from 'lucide-react';
import { useLang } from '../../i18n';
import type { VenueFilters } from '@/lib/venue/filter';
import { toggleRequired, triOf } from './filterState';
import { Chip, RequireSwitch } from './filterControls';

const DISTANCES = [25, 50, 100] as const;

export default function MorePanel({
  filters,
  onChange,
  allocatedBudget,
  hasDistances,
}: {
  filters: VenueFilters;
  onChange: (next: VenueFilters) => void;
  /** What the budget page set aside for the venue, when it is known. */
  allocatedBudget?: number | null;
  /** Only offer a distance limit once the couple's own area resolved. */
  hasDistances?: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
          <Wallet size={14} className="text-muted" aria-hidden /> {t('Budget til lokalet')}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[0.74rem] text-muted">{t('Højst')}</span>
          <span className="text-[0.85rem] font-bold text-ink">
            {filters.budget_max ? `${filters.budget_max.toLocaleString('da-DK')} kr.` : t('Ingen grænse')}
          </span>
        </div>
        <input
          type="range" min={0} max={500000} step={10000}
          value={filters.budget_max ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ ...filters, budget_max: v === 0 ? null : v });
          }}
          aria-label={t('Budget til lokalet')}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-ink"
        />
        {allocatedBudget != null && filters.budget_max === allocatedBudget && (
          <p className="mt-1.5 text-[0.7rem] text-sage">
            {t('Sat efter jeres budget til Venue.')}
          </p>
        )}
        <RequireSwitch
          label={t('Skjul steder over budgettet')}
          hint={t('Steder uden oplyst pris bliver vist.')}
          active={triOf(filters, 'budget') === 'required'}
          disabled={filters.budget_max == null}
          onClick={() => onChange(toggleRequired(filters, 'budget'))}
        />
      </section>

      <section className="border-t border-line pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
          <Star size={14} className="text-muted" aria-hidden /> {t('Anmeldelser')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {([4, 4.5] as const).map((r) => (
            <Chip
              key={r}
              label={t('{n}+ i vurdering', { n: String(r).replace('.', ',') })}
              state={filters.min_rating === r ? 'wanted' : 'off'}
              onClick={() => onChange({
                ...filters,
                min_rating: filters.min_rating === r ? null : r,
                require: filters.min_rating === r
                  ? (filters.require ?? []).filter((x) => x !== 'rating')
                  : filters.require,
              })}
            />
          ))}
        </div>
        <RequireSwitch
          label={t('Skjul lavere vurderinger')}
          hint={t('Steder uden anmeldelser bliver vist.')}
          active={triOf(filters, 'rating') === 'required'}
          disabled={filters.min_rating == null}
          onClick={() => onChange(toggleRequired(filters, 'rating'))}
        />
      </section>

      {hasDistances && (
        <section className="border-t border-line pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
            <Route size={14} className="text-muted" aria-hidden /> {t('Afstand fra jer')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DISTANCES.map((km) => (
              <Chip
                key={km}
                label={t('Under {n} km', { n: km })}
                state={filters.max_distance_km === km ? 'wanted' : 'off'}
                onClick={() => onChange({
                  ...filters,
                  max_distance_km: filters.max_distance_km === km ? null : km,
                })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
