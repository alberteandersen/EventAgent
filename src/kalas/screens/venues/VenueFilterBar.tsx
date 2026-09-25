"use client";

/* The controls above the results: one row of named pills, each with its own
 * little menu.
 *
 * It was a three-storey card — a few quick chips, a "Filtre" button hiding six
 * collapsed sections, a row of active-filter chips, and a bare <select> for
 * sorting. Two things were wrong with that. Nothing on the outside said what
 * could be adjusted, so the drawer had to be opened to find out; and the
 * answer to a filter lived somewhere other than the control that set it, which
 * is why a whole second row existed just to repeat it back.
 *
 * Now each pill names its filter and carries its own answer ("Fyn +2",
 * "175 gæster"), so the repeat row is gone and the bar is one stripe. Farthest
 * right sit the two things that are not filters at all: the heart, which jumps
 * to the couple's favourites, and the sort. */

import { useState } from 'react';
import {
  Users, ArrowUpDown, Heart, UtensilsCrossed, BedDouble,
  Trees, Accessibility, Car, Baby, Dog, Clock,
} from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueFilters, VenueSort } from '@/lib/venue/filter';
import { VENUE_SETTINGS, type VenueSetting } from '@/lib/venue/facts';
import { activeFilters, clearAll, triOf } from './filterState';
import FilterPill from './FilterPill';
import MorePanel from './MorePanel';
import { Chip, PanelHint, TriChip } from './filterControls';

export interface RegionOption {
  id: string;
  label: string;
}

export interface VenueFilterCounts {
  total: number;
  shown: number;
  withCatering: number;
  withStay: number;
  hiddenCapacity: number;
}

/** Danish labels for the aesthetic buckets in VENUE_SETTINGS. */
const SETTING_LABELS: Record<VenueSetting, string> = {
  barn: 'Lade',
  castle: 'Slot',
  manor: 'Herregård',
  garden: 'Have & orangeri',
  coastal: 'Ved vandet',
  vineyard: 'Vingård',
  hotel: 'Hotel',
  industrial: 'Industrielt',
  museum: 'Museum',
  lakeside: 'Ved søen',
  chapel: 'Kapel & kirke',
  restaurant: 'Restaurant',
  tented: 'Telt',
};

export default function VenueFilterBar({
  filters,
  onChange,
  onGuestsCommit,
  regions,
  activeRegionIds,
  onRegionToggle,
  sort,
  onSortChange,
  counts,
  hasDistances = false,
  allocatedBudget,
  loading,
  savedCount = 0,
  onOpenSaved,
}: {
  filters: VenueFilters;
  onChange: (next: VenueFilters) => void;
  onGuestsCommit: (guests: number | null) => void;
  regions: RegionOption[];
  activeRegionIds: string[];
  onRegionToggle: (id: string) => void;
  sort: VenueSort;
  onSortChange: (sort: VenueSort) => void;
  counts: VenueFilterCounts;
  /** True when the couple's own area resolved, so distances can be shown. */
  hasDistances?: boolean;
  /** What the budget page set aside for the venue. */
  allocatedBudget?: number | null;
  loading: boolean;
  /** How many venues are already on the couple's list. */
  savedCount?: number;
  /** Opens the favourites tab. Omitted when there is nowhere to go. */
  onOpenSaved?: () => void;
}) {
  const { t, tn } = useLang();
  /** Only one menu at a time — two open popovers is two ways to be lost. */
  const [openPill, setOpenPill] = useState<string | null>(null);
  const [guestDraft, setGuestDraft] = useState<string>(
    filters.min_capacity != null ? String(filters.min_capacity) : ''
  );

  /* Every filter menu gets the live count in its footer; the sort menu does
     not, it reorders the list, it never shortens it. */
  const pill = (id: string) => ({
    open: openPill === id,
    onOpenChange: (open: boolean) => setOpenPill(open ? id : null),
  });
  const withCount = (id: string) => ({ ...pill(id), shown: counts.shown });

  const commitGuests = () => {
    const parsed = parseInt(guestDraft, 10);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (next !== (filters.min_capacity ?? null)) {
      onChange({ ...filters, min_capacity: next });
      onGuestsCommit(next);
    }
  };

  const stepGuests = (delta: number) => {
    const base = filters.min_capacity ?? 70;
    const next = Math.max(1, base + delta);
    setGuestDraft(String(next));
    onChange({ ...filters, min_capacity: next });
    onGuestsCommit(next);
  };

  const labels: Record<string, string> = {
    budget: t('Højst'),
    catering: t('Catering i huset'),
    accommodation: t('Overnatning'),
    ceremony: t('Vielse på stedet'),
    outdoor: t('Have eller terrasse'),
    wheelchair: t('Kørestolsvenlig'),
    parking: t('Parkering'),
    children: t('Børnevenligt'),
    dogs: t('Hunde tilladt'),
  };
  const active = activeFilters(filters, labels);

  const chosenRegions = regions.filter((r) => activeRegionIds.includes(r.id));
  const areaSummary = chosenRegions.length === 0
    ? null
    : chosenRegions.length === 1
      ? chosenRegions[0].label
      : `${chosenRegions[0].label} +${chosenRegions.length - 1}`;

  const settings = filters.settings ?? [];
  const toggleSetting = (s: VenueSetting) => {
    const next = settings.includes(s) ? settings.filter((x) => x !== s) : [...settings, s];
    onChange({
      ...filters,
      settings: next,
      require: next.length === 0
        ? (filters.require ?? []).filter((r) => r !== 'setting')
        : filters.require,
    });
  };

  const foodCount = (['catering', 'accommodation'] as const)
    .filter((r) => triOf(filters, r) !== 'off').length;
  const ceremonyCount = (['ceremony', 'outdoor'] as const)
    .filter((r) => triOf(filters, r) !== 'off').length;
  const includedCount =
    (['wheelchair', 'parking', 'children', 'dogs'] as const)
      .filter((r) => triOf(filters, r) !== 'off').length
    + (filters.own_drinks === 'allowed' ? 1 : 0)
    + (filters.exclusive === 'sole_use' ? 1 : 0)
    + (filters.min_curfew != null ? 1 : 0);
  const moreCount =
    (filters.budget_max != null ? 1 : 0)
    + (filters.min_rating != null ? 1 : 0)
    + (filters.max_distance_km != null ? 1 : 0);

  const SORTS: { id: VenueSort; label: string }[] = [
    { id: 'relevance', label: t('Bedste match') },
    { id: 'rating', label: t('Højeste vurdering') },
    { id: 'price', label: t('Laveste pris') },
    // Offered only when the couple's area resolved — a sort that silently
    // does nothing is worse than one that is not there.
    ...(hasDistances ? [{ id: 'distance' as const, label: t('Tættest på jer') }] : []),
  ];
  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? SORTS[0].label;

  return (
    <div className="flex flex-col gap-2.5">
      {/* ── The row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          {...withCount('guests')}
          label={t('Kapacitet')}
          summary={filters.min_capacity ? t('{n} gæster', { n: filters.min_capacity }) : null}
          width="15rem"
          onReset={filters.min_capacity != null ? () => {
            setGuestDraft('');
            onChange({ ...filters, min_capacity: null });
            onGuestsCommit(null);
          } : undefined}
        >
          <PanelHint>{t('Steder der er for små, bliver sorteret fra.')}</PanelHint>
          <div className="flex items-center gap-1 rounded-full border border-line bg-[#f8f9f8] pl-3 pr-1">
            <Users size={13} className="shrink-0 text-muted" aria-hidden />
            <label htmlFor="venue-guests" className="text-[0.76rem] font-semibold text-muted">
              {t('Gæster')}
            </label>
            <button type="button" onClick={() => stepGuests(-10)} aria-label={t('Færre gæster')}
              className="flex h-8 w-7 items-center justify-center text-[1rem] text-muted hover:text-ink cursor-pointer">−</button>
            <input
              id="venue-guests"
              inputMode="numeric"
              value={guestDraft}
              onChange={(e) => setGuestDraft(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={commitGuests}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="-"
              className="h-9 w-11 bg-transparent text-center text-[0.85rem] font-bold text-ink focus:outline-none"
            />
            <button type="button" onClick={() => stepGuests(10)} aria-label={t('Flere gæster')}
              className="flex h-8 w-7 items-center justify-center text-[1rem] text-muted hover:text-ink cursor-pointer">+</button>
          </div>
        </FilterPill>

        {regions.length > 0 && (
          <FilterPill
            {...withCount('area')}
            label={t('Område')}
            summary={areaSummary}
            count={chosenRegions.length}
            width="20rem"
          >
            <PanelHint>{t('Vælg ét eller flere, de søges på én gang.')}</PanelHint>
            <div className="flex flex-wrap gap-1.5">
              {regions.map((r) => (
                <Chip
                  key={r.id}
                  label={r.label}
                  state={activeRegionIds.includes(r.id) ? 'wanted' : 'off'}
                  onClick={() => onRegionToggle(r.id)}
                />
              ))}
            </div>
          </FilterPill>
        )}

        <FilterPill
          {...withCount('food')}
          label={t('Mad & drikke')}
          count={foodCount}
          summary={foodCount > 0 ? t('Mad & drikke') : null}
          width="20rem"
        >
          <TriChip filters={filters} onChange={onChange} rule="catering"
            icon={<UtensilsCrossed size={13} />} label={t('Catering i huset')} />
          <TriChip filters={filters} onChange={onChange} rule="accommodation"
            icon={<BedDouble size={13} />} label={t('Overnatning')} />
          {triOf(filters, 'accommodation') !== 'off' && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Chip
                label={t('På stedet eller i nærheden')}
                state={filters.accommodation === 'on_site_or_nearby' ? 'wanted' : 'off'}
                onClick={() => onChange({ ...filters, accommodation: 'on_site_or_nearby' })}
              />
              <Chip
                label={t('Kun på stedet')}
                state={filters.accommodation === 'on_site' ? 'wanted' : 'off'}
                onClick={() => onChange({ ...filters, accommodation: 'on_site' })}
              />
            </div>
          )}
          <p className="mt-2.5 text-[0.7rem] text-sage">
            {t('{n} af stederne har catering i huset, {m} har overnatning.', {
              n: counts.withCatering, m: counts.withStay,
            })}
          </p>
        </FilterPill>

        <FilterPill
          {...withCount('ceremony')}
          label={t('Ude & inde')}
          count={ceremonyCount}
          summary={ceremonyCount > 0 ? t('Ude & inde') : null}
          width="20rem"
        >
          <TriChip filters={filters} onChange={onChange} rule="ceremony"
            icon={<Heart size={13} />} label={t('Vielse på stedet')} />
          <TriChip filters={filters} onChange={onChange} rule="outdoor"
            icon={<Trees size={13} />} label={t('Have eller terrasse')} />
        </FilterPill>

        <FilterPill
          {...withCount('setting')}
          label={t('Stemning')}
          count={settings.length}
          summary={settings.length === 1 ? t(SETTING_LABELS[settings[0]]) : settings.length > 1 ? t('Stemning') : null}
          width="21rem"
          onReset={settings.length > 0 ? () => onChange({
            ...filters,
            settings: [],
            require: (filters.require ?? []).filter((r) => r !== 'setting'),
          }) : undefined}
        >
          <PanelHint>{t('Vælg de stemninger I kan se jer selv i.')}</PanelHint>
          <div className="flex flex-wrap gap-1.5">
            {VENUE_SETTINGS.map((s) => (
              <Chip
                key={s}
                label={t(SETTING_LABELS[s])}
                state={settings.includes(s) ? 'wanted' : 'off'}
                onClick={() => toggleSetting(s)}
              />
            ))}
          </div>
        </FilterPill>

        <FilterPill
          {...withCount('included')}
          label={t('Inkluderet')}
          count={includedCount}
          summary={includedCount > 0 ? t('Inkluderet') : null}
          width="21rem"
        >
          <PanelHint>{t('Det praktiske er oplyst af Google.')}</PanelHint>
          <TriChip filters={filters} onChange={onChange} rule="wheelchair"
            icon={<Accessibility size={13} />} label={t('Kørestolsvenlig')} />
          <TriChip filters={filters} onChange={onChange} rule="parking"
            icon={<Car size={13} />} label={t('Parkering')} />
          <TriChip filters={filters} onChange={onChange} rule="children"
            icon={<Baby size={13} />} label={t('Børnevenligt')} />
          <TriChip filters={filters} onChange={onChange} rule="dogs"
            icon={<Dog size={13} />} label={t('Hunde tilladt')} />

          <div className="mt-2 border-t border-line pt-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label={t('Egne drikkevarer')}
                state={filters.own_drinks === 'allowed' ? 'wanted' : 'off'}
                onClick={() => onChange({
                  ...filters,
                  own_drinks: filters.own_drinks === 'allowed' ? 'any' : 'allowed',
                })}
              />
              <Chip
                label={t('Stedet for jer selv')}
                state={filters.exclusive === 'sole_use' ? 'wanted' : 'off'}
                onClick={() => onChange({
                  ...filters,
                  exclusive: filters.exclusive === 'sole_use' ? 'any' : 'sole_use',
                })}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[0.74rem] text-muted">
                <Clock size={13} aria-hidden /> {t('Festen skal kunne vare til')}
              </span>
              {([1, 2, 3] as const).map((h) => (
                <Chip
                  key={h}
                  label={t('kl. {h}', { h: `0${h}` })}
                  state={filters.min_curfew === h ? 'wanted' : 'off'}
                  onClick={() => onChange({
                    ...filters,
                    min_curfew: filters.min_curfew === h ? null : h,
                  })}
                />
              ))}
            </div>
          </div>
        </FilterPill>

        <FilterPill
          {...withCount('more')}
          label={t('Mere')}
          count={moreCount}
          summary={moreCount > 0 ? t('Mere') : null}
          width="21rem"
          align="right"
        >
          <MorePanel
            filters={filters}
            onChange={onChange}
            allocatedBudget={allocatedBudget}
            hasDistances={hasDistances}
          />
        </FilterPill>

        {/* ── Not filters: the couple's list, and the order ─────────────── */}
        {onOpenSaved && (
          <button
            type="button"
            onClick={onOpenSaved}
            aria-label={t('Se jeres favoritter')}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[0.78rem] font-semibold text-ink transition-colors hover:border-ink hover:bg-[#e8f0ec] cursor-pointer sm:ml-auto"
          >
            <Heart
              size={15}
              className={cn('shrink-0', savedCount > 0 && 'fill-current')}
              aria-hidden
            />
            {savedCount > 0 && savedCount}
          </button>
        )}

        <FilterPill
          {...pill('sort')}
          label={t('Sortér')}
          summary={sort === 'relevance' ? null : sortLabel}
          width="14rem"
          align="right"
        >
          <div className="flex flex-col gap-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onSortChange(s.id); setOpenPill(null); }}
                aria-pressed={sort === s.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.82rem] transition-colors cursor-pointer',
                  sort === s.id ? 'bg-[#e8f0ec] font-semibold text-ink' : 'text-muted hover:bg-shell hover:text-ink',
                )}
              >
                <ArrowUpDown size={13} className="shrink-0 opacity-60" aria-hidden />
                {s.label}
              </button>
            ))}
          </div>
        </FilterPill>
      </div>

      {/* ── What the row adds up to ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.74rem] text-muted">
        <span className="font-bold text-ink">
          {loading ? t('Søger…') : tn(counts.shown, '{n} sted', '{n} steder')}
        </span>
        {counts.hiddenCapacity > 0 && filters.min_capacity != null && (
          <span>
            {t('{n} skjult, for små til {guests} gæster', {
              n: counts.hiddenCapacity, guests: filters.min_capacity,
            })}
          </span>
        )}
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(clearAll(filters))}
            className="ml-auto font-semibold text-muted underline-offset-4 hover:text-ink hover:underline cursor-pointer"
          >
            {t('Ryd alle filtre')}
          </button>
        )}
      </div>
    </div>
  );
}
