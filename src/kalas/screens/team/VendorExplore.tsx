"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Check, Star, MapPin, X, Loader2, RotateCw, MessageCircle } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { Button, EmptyState, ErrorState, Skeleton, cn } from '../../ui';
import { apiWrite } from '../../notice';
import { effectiveLocation } from '../../lib/location';
import type { NavigateTarget } from '../../lib/hub-nav';
import type { HubCat } from './shared';
import type { PlaceSuggestion } from '@/lib/venue/search';

/**
 * Location-driven vendor discovery for a non-venue category. Ava researches
 * real local vendors near the couple's location (from their venue, or the
 * top-right chip on the venue page) and shows them as save-able cards — the
 * vendor twin of the venue globe discovery.
 */
export default function VendorExplore({
  cat,
  onGoToVenue,
  onNavigate,
}: {
  cat: HubCat;
  onGoToVenue: () => void;
  onNavigate?: (s: NavigateTarget) => void;
}) {
  const { t, lang } = useLang();
  const { event, venues, couple, refresh } = useWedding();

  const location = useMemo(() => effectiveLocation(event, venues), [event, venues]);

  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [backendCat, setBackendCat] = useState<string>('other');
  const [loading, setLoading] = useState(false);
  // The search itself failed, as opposed to finding nobody.
  const [failed, setFailed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const cache = useRef<Record<string, { vendors: PlaceSuggestion[]; category: string }>>({});

  const savedPlaceIds = useMemo(
    () => new Set(venues.map((v) => v.place_id).filter(Boolean) as string[]),
    [venues],
  );

  const load = useMemo(
    () => async (loc: string, c: HubCat) => {
      const key = `${c}:${loc.toLowerCase()}`;
      const hit = cache.current[key];
      if (hit) {
        setResults(hit.vendors);
        setBackendCat(hit.category);
        setFailed(false);
        return;
      }
      setLoading(true);
      setFailed(false);
      setResults([]);
      try {
        const res = await fetch('/api/onboarding/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: c,
            location: loc,
            guest_count: couple.guests > 0 ? couple.guests : undefined,
            budget: couple.budgetTotal > 0 ? String(couple.budgetTotal) : undefined,
            lang,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { vendors?: PlaceSuggestion[]; category?: string };
        const list = data.vendors ?? [];
        cache.current[key] = { vendors: list, category: data.category ?? 'other' };
        setResults(list);
        setBackendCat(data.category ?? 'other');
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [couple.guests, couple.budgetTotal, lang],
  );

  useEffect(() => {
    if (location) void load(location, cat);
  }, [location, cat, load]);

  const saveVendor = async (v: PlaceSuggestion) => {
    setSavingId(v.id);
    try {
      const res = await apiWrite('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue: v, category: backendCat }),
      }, t);
      if (res) {
        setJustSaved((prev) => new Set(prev).add(v.id));
        await refresh();
      }
    } finally {
      setSavingId(null);
    }
  };

  const isSaved = (v: PlaceSuggestion) =>
    justSaved.has(v.id) || (v.place_id != null && savedPlaceIds.has(v.place_id));

  const visible = results.filter((v) => !dismissed.has(v.id));

  // ── No location yet → send them to set it on the venue page ──────────
  if (!location) {
    return (
      <EmptyState
        icon={MapPin}
        title={t('Vælg jeres lokation først')}
        action={<Button size="sm" onClick={onGoToVenue}>{t('Til venues')}</Button>}
      >
        {t('Sæt jeres lokation øverst på venue-siden, eller vælg et venue, så finder Ava leverandører i nærheden.')}
      </EmptyState>
    );
  }

  const retry = () => void load(location, cat);

  return (
    <div className="space-y-5">
      {/* Location context */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-meta text-muted">
          <MapPin size={13} className="text-sage" />
          {t('Nær {area}', { area: location })}
        </p>
        {!loading && !failed && visible.length > 0 && (
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={retry}>{t('Opdater')}</Button>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label={t('Ava leder efter leverandører…')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line-soft bg-card">
              <Skeleton className="h-40 rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <ErrorState title={t('Ava kunne ikke søge lige nu')} onRetry={retry}>
          {t('Søgningen gik ikke igennem. Prøv igen om lidt.')}
        </ErrorState>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t('Ingen leverandører fundet her endnu.')}
          action={<Button variant="secondary" size="sm" icon={RotateCw} onClick={retry}>{t('Søg igen')}</Button>}
        >
          {t('Ava fandt ingen i nærheden af {area}. Prøv igen, eller bed hende lede bredere.', { area: location })}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => (
            <VendorCard
              key={v.id}
              v={v}
              saved={isSaved(v)}
              saving={savingId === v.id}
              onSave={() => void saveVendor(v)}
              onDismiss={() => setDismissed((prev) => new Set(prev).add(v.id))}
            />
          ))}
        </div>
      )}

      {/* Ask Ava */}
      <Button variant="secondary" icon={MessageCircle} className="w-full" onClick={() => onNavigate?.('ava')}>
        {t('Spørg Ava om at finde flere')}
      </Button>
    </div>
  );
}

function VendorCard({
  v,
  saved,
  saving,
  onSave,
  onDismiss,
}: {
  v: PlaceSuggestion;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLang();
  const blurb = v.why_fit || v.description || '';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {v.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photo} alt={v.name} className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sage-wash to-shell">
            <MapPin size={22} className="text-sage" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/25 to-transparent" />
        {v.rating != null && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm">
            <Star size={11} fill="currentColor" className="text-amber" />
            {v.rating.toFixed(1)}
            {v.review_count ? <span className="font-normal text-muted">({v.review_count})</span> : null}
          </span>
        )}
        {!saved && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('Skjul')}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-paper/80 text-muted backdrop-blur-sm transition-colors hover:bg-paper cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-[1.08rem] leading-tight text-ink">{v.name}</h3>
        {v.address && (
          <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[0.72rem] text-sage-strong">
            <MapPin size={10} className="shrink-0" /> {v.address}
          </p>
        )}
        {blurb && (
          <p className="mt-2 flex-1 font-serif text-[0.82rem] italic leading-snug text-muted line-clamp-3">
            &ldquo;{blurb}&rdquo;
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-4">
          <span className="font-serif text-[0.95rem] text-ink">{v.price_hint || '-'}</span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saved}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-opacity cursor-pointer disabled:cursor-default',
              saved ? 'bg-sage-wash text-ink' : 'bg-ink text-paper hover:opacity-85',
            )}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <><Check size={12} /> {t('På listen')}</>
            ) : (
              <><Heart size={12} /> {t('Gem')}</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
