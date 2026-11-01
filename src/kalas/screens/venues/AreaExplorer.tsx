"use client";

/* Where in the country: the step for a couple who only said "Italy", or
 * nothing at all. Our own regions where we have them, otherwise the places a
 * country is known for getting married in, as photographs, because "Puglia"
 * means little to someone who has not been there and a picture of it does.
 *
 * Everything here is a toggle on the same list of places the search bar
 * shows, so the two can never disagree about what is being searched. */

import { Check, Expand, Loader2, MapPin, Plus } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { countryLabel } from '../../onboarding/countries';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import { regionShortLabel, type VenueRegion } from '@/lib/venue/regions';
import type { SearchPlace } from '@/lib/venue/searchPlan';

export default function AreaExplorer({
  countries, country, onCountry, regions, destinations, loading, failed, onRetry, isActive, onToggle, onPhoto,
}: {
  /** The countries worth a tab: the ones being searched, and the ones they named in onboarding. */
  countries: string[];
  country: string | null;
  onCountry: (country: string) => void;
  /** Our curated regions for the country, or none. */
  regions: VenueRegion[];
  destinations: DestinationSuggestion[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  isActive: (place: SearchPlace) => boolean;
  onToggle: (place: SearchPlace) => void;
  onPhoto: (photo: string, name: string) => void;
}) {
  const { t, lang } = useLang();
  const weddings = destinations.filter((d) => d.kind === 'wedding');
  const cities = destinations.filter((d) => d.kind === 'city');

  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-line bg-paper p-4 sm:p-5">
      {countries.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Land')}>
          {countries.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === country}
              onClick={() => onCountry(c)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors cursor-pointer',
                c === country ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-muted hover:border-ink hover:text-ink',
              )}
            >
              {countryLabel(c, lang)}
            </button>
          ))}
        </div>
      )}

      {!country ? (
        <p className="py-4 text-center text-[0.88rem] leading-relaxed text-ink-soft">
          {t('Skriv et land eller et sted i feltet ovenfor, så viser vi områderne der.')}
        </p>
      ) : regions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted">
            {t('Områder i {country}', { country: countryLabel(country, lang) })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => {
              const place: SearchPlace = { kind: 'region', slug: r.slug };
              const on = isActive(place);
              return (
                <button
                  key={r.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(place)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.82rem] font-medium transition-colors cursor-pointer',
                    on ? 'border-ink bg-sage-wash text-ink' : 'border-line-soft bg-white text-ink hover:border-ink',
                  )}
                >
                  {on ? <Check size={13} aria-hidden /> : <Plus size={13} className="text-muted" aria-hidden />}
                  {regionShortLabel(r, lang)}
                </button>
              );
            })}
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-3 py-8 text-[0.85rem] text-ink-soft">
          <Loader2 size={18} className="animate-spin text-muted" />
          {t('Finder byer og destinationer i {country}…', { country: countryLabel(country, lang) })}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-[0.85rem] text-ink-soft">{t('Kunne ikke hente destinationer.')}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-ink/20 px-4 py-2 text-[0.75rem] font-bold text-ink transition-colors hover:bg-card cursor-pointer"
          >
            {t('Prøv igen')}
          </button>
        </div>
      ) : (
        /* One row, the places known for weddings first and the cities after.
           Two rows of pictures pushed the venues themselves off the screen,
           and this panel is only the way to them. */
        <div className="flex flex-col gap-2">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted">
            {t('Områder i {country}', { country: countryLabel(country, lang) })}
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]">
            {[...weddings, ...cities].map((d) => {
              const place: SearchPlace = { kind: 'text', query: `${d.name}, ${country}` };
              return (
                <DestinationCard
                  key={`${d.kind}-${d.name}`}
                  d={d}
                  active={isActive(place)}
                  onToggle={() => onToggle(place)}
                  onPhoto={d.photo ? () => onPhoto(d.photo!, d.name) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DestinationCard({ d, active, onToggle, onPhoto }: {
  d: DestinationSuggestion; active: boolean; onToggle: () => void; onPhoto?: () => void;
}) {
  const { t } = useLang();
  return (
    <div className={cn(
      'group relative w-[12.5rem] shrink-0 overflow-hidden rounded-2xl border bg-white transition-colors',
      active ? 'border-ink shadow-[0_6px_18px_rgba(18,51,43,0.12)]' : 'border-line-soft hover:border-ink/40',
    )}>
      <button type="button" onClick={onToggle} aria-pressed={active} className="block w-full text-left cursor-pointer">
        {d.photo ? (
          <div className="relative h-24 w-full overflow-hidden">
            <img src={d.photo} alt="" loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-sage-wash">
            <MapPin size={18} className="text-ink opacity-40" aria-hidden />
          </div>
        )}
        <div className="p-3">
          <p className="flex items-center gap-1.5 font-serif text-[1rem] leading-tight text-ink">
            <span className="truncate">{d.name}</span>
            {d.kind === 'city' && (
              <span className="shrink-0 rounded-full bg-shell px-2 py-0.5 font-sans text-[0.56rem] font-bold uppercase tracking-[0.1em] text-muted">
                {t('By')}
              </span>
            )}
            {active && <Check size={14} className="shrink-0 text-sage-strong" aria-hidden />}
          </p>
          {d.blurb && <p className="mt-1 line-clamp-2 text-[0.74rem] leading-snug text-muted">{d.blurb}</p>}
        </div>
      </button>
      {onPhoto && (
        <button
          type="button"
          onClick={onPhoto}
          aria-label={t('Forstør billede')}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-soft opacity-0 shadow-sm transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 cursor-pointer"
        >
          <Expand size={14} />
        </button>
      )}
    </div>
  );
}
