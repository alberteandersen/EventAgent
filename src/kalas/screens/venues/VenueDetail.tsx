"use client";

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, Check, ArrowLeft, Star, Loader2, BookOpen, Send } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { type DisplayVenue, imgSrc } from './shared';

/* ══════════════════════════════════════════════════════════════════════
   VENUE DETAIL PAGE, real data only; Juno research fills the gaps
═══════════════════════════════════════════════════════════════════════ */
export function VenueDetail({
  venue, allVenues, saved, sent, isBooked, onBack, onSave, onContact, onBook, onSelectOther, onRefresh,
}: {
  venue: DisplayVenue; allVenues: DisplayVenue[]; saved: boolean; sent: boolean; isBooked: boolean;
  onBack: () => void; onSave: () => void; onContact: () => void; onBook: () => void;
  onSelectOther: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t, tn } = useLang();
  const [notes, setNotes]         = useState('');
  const [activePackage, setPkg]   = useState<number | null>(null);
  // Start in the researching state when a shortlisted venue has nothing on file
  // yet — opening it kicks off research (below), so the couple never sees an
  // empty page. Non-shortlisted venues wait for a manual press.
  const [researching, setResearching] = useState(!venue.research && saved);
  const [researchError, setResearchError] = useState<string | null>(null);
  const realPhotos = venue.photos ?? [];
  const research = venue.research;
  const description = venue.description ?? venue.quote;
  const highlights = research?.highlights.length ? research.highlights : venue.why;
  const practical  = research?.practical ?? [];
  const packages   = research?.packages ?? [];
  const directions = research?.directions ?? null;

  async function runResearch() {
    setResearching(true);
    setResearchError(null);
    try {
      const res = await fetch(`/api/venues/${venue.id}/research`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Research failed');
      }
      await onRefresh();
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : t('Kunne ikke researche venue'));
    } finally {
      setResearching(false);
    }
  }

  // First time a shortlisted venue is opened, kick off research automatically so
  // the couple lands on filled-in info instead of an empty page. Only runs for
  // venues on their list and only when nothing has been researched yet; the
  // button remains for a manual refresh. The ref guards against re-firing on
  // re-render (the view is keyed by venue.id, so a different venue remounts and
  // gets its own auto-run).
  const autoResearchedRef = useRef(false);
  useEffect(() => {
    if (autoResearchedRef.current || venue.research || !saved) return;
    autoResearchedRef.current = true;
    void runResearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full bg-canvas pb-24">

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line-soft bg-canvas/95 px-6 py-3 backdrop-blur-md sm:px-9 lg:px-12">
        <button type="button" onClick={onBack}
          className="flex h-8 cursor-pointer items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> {t('Tilbage')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runResearch()}
            disabled={researching}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all',
              researching
                ? 'border border-line-soft bg-paper text-faint'
                : 'border border-line-soft bg-white text-ink hover:bg-paper',
            )}>
            {researching ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
            {researching ? t('Juno researcher…') : research ? t('Opdater research') : t('Research venue')}
          </button>
          <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={onSave}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all',
              saved
                ? 'bg-sage-wash text-ink'
                : 'border border-line-soft bg-white text-ink hover:bg-paper',
            )}>
            <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
            {saved ? t('Gemt') : t('Gem')}
          </motion.button>
        </div>
      </div>

      {/* ── Photos ────────────────────────────────────────────────── */}
      {realPhotos.length > 1 ? (
        <div className="grid h-[300px] gap-1 sm:h-[460px] sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-2">
          <div className="relative overflow-hidden sm:row-span-2">
            <img src={imgSrc(venue.image)} alt={venue.name}
              className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-line bg-white/95 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-[0.68rem] font-medium text-ink">{tn(realPhotos.length, '{n} billede', '{n} billeder')}</span>
            </div>
          </div>
          {realPhotos.slice(1, 5).map((url, i) => (
            <div key={i} className="relative hidden overflow-hidden sm:block">
              <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-[300px] overflow-hidden sm:h-[420px]">
          <img src={imgSrc(venue.image)} alt={venue.name}
            className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
      )}

      {/* ── Main info ─────────────────────────────────────────────── */}
      <div className="px-6 pt-8 sm:px-9 lg:px-12">

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-sage-wash px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink">
            {t('Juno pick')}
          </span>
          {venue.rating != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-paper px-3 py-1 text-[0.72rem] font-medium text-ink">
              <Star size={12} fill="currentColor" className="text-clay-ink" />
              {venue.rating.toFixed(1)}
              {venue.reviewCount > 0 && <span className="text-muted">· {tn(venue.reviewCount, '{n} anmeldelse', '{n} anmeldelser')}</span>}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05] text-ink">
          {venue.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{venue.location}</p>
        {directions && (
          <p className="mt-1 text-[0.8rem] text-sage-strong">{directions}</p>
        )}

        {researchError && (
          <p className="mt-4 rounded-[14px] border border-terracotta/20 bg-terracotta-wash px-4 py-3 text-sm text-terracotta">{researchError}</p>
        )}

        {research?.briefing?.length ? (
          <div className="mt-6 rounded-[18px] bg-ink p-6 text-paper">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Junos briefing')}</p>
            <ul className="mt-4 space-y-2.5">
              {research.briefing.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[0.92rem] leading-snug">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage-tint" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : researching ? (
          <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-line-soft bg-white px-5 py-4">
            <Loader2 size={16} className="shrink-0 animate-spin text-ink" />
            <p className="text-sm leading-relaxed text-muted">
              {t('Juno researcher venueet, søger på nettet og udfylder kapacitet, priser og praktisk info fra stedets egne sider…')}
            </p>
          </div>
        ) : !research ? (
          <div className="mt-6 rounded-[18px] border border-dashed border-line bg-white px-5 py-4">
            <p className="text-sm leading-relaxed text-muted">
              {t('Juno kunne ikke hente info automatisk. Tryk')}{' '}
              <span className="font-medium text-ink">{t('Research venue')}</span>{' '}
              {t('for at prøve igen.')}
            </p>
          </div>
        ) : null}

        {description && (
          <p className="mt-7 max-w-2xl text-[1.02rem] leading-relaxed text-ink-soft">{description}</p>
        )}

        {/* Stats strip */}
        <div className="mt-8 grid grid-cols-3 items-stretch gap-px overflow-hidden rounded-[18px] border border-line bg-line">
          <div className="flex min-h-[5.5rem] flex-col bg-white px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Kapacitet')}</p>
            <p className="mt-2 text-[0.9rem] font-semibold leading-snug text-ink">{venue.capacity || '-'}</p>
          </div>
          <div className="flex min-h-[5.5rem] flex-col bg-sage-wash px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Pris fra')}</p>
            <p className="mt-2 text-[0.9rem] font-semibold leading-snug text-ink">{venue.price || '-'}</p>
          </div>
          <div className="flex min-h-[5.5rem] flex-col bg-ink px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-line-strong">{t('Bedømmelse')}</p>
            <p className="mt-2 font-serif text-[1.35rem] leading-none text-paper">
              {venue.rating != null ? `★ ${venue.rating.toFixed(1)}` : '-'}
            </p>
          </div>
        </div>

        {practical.length > 0 && (
          <div className="mt-10 border-t border-line-soft pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Praktisk info')}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              {practical.map(({ key, value }) => (
                <div key={key}>
                  <dt className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">{key}</dt>
                  <dd className="mt-1.5 text-[0.92rem] leading-snug text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {highlights.length > 0 && (
          <div className="mt-10 border-t border-line-soft pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Faciliteter & fordele')}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-start gap-3">
                  <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-sage-strong" />
                  <span className="text-[0.92rem] leading-snug text-ink-soft">{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {packages.length > 0 && (
          <div className="mt-10 border-t border-line-soft pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Priser & pakker')}</p>
            <p className="mt-1.5 text-[0.8rem] text-muted">{t('Fra venueets egne sider, bekræft altid pris og dato direkte.')}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {packages.map((pkg, i) => {
                const active = activePackage === i;
                return (
                  <button key={pkg.name} type="button" onClick={() => setPkg(active ? null : i)}
                    className={cn(
                      'group flex flex-col rounded-[18px] p-5 text-left transition-all cursor-pointer',
                      pkg.featured
                        ? 'bg-ink text-paper'
                        : active
                          ? 'border-2 border-ink bg-white'
                          : 'border border-line bg-white hover:bg-paper',
                    )}>
                    {pkg.featured && (
                      <span className="mb-2 text-[0.58rem] font-bold uppercase tracking-[0.22em] text-sage-tint">{t('Mest valgt')}</span>
                    )}
                    <span className={cn('font-serif text-[1.15rem]', pkg.featured ? 'text-paper' : 'text-ink')}>
                      {pkg.name}
                    </span>
                    <span className={cn('mt-1 text-[0.76rem] leading-relaxed', pkg.featured ? 'text-muted' : 'text-muted')}>
                      {pkg.desc}
                    </span>
                    <span className={cn('mt-4 font-serif text-[1.5rem] leading-none', pkg.featured ? 'text-paper' : 'text-ink')}>
                      {pkg.price}
                    </span>
                    {active && !pkg.featured && (
                      <span className="mt-3 flex items-center gap-1 text-[0.72rem] text-sage-strong">
                        <Check size={12} /> {t('Valgt')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(venue.quote || venue.why.length > 0) && (
          <div className="mt-10 border-t border-line-soft pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Derfor matcher det jer')}</p>
            <div className="mt-5 rounded-[18px] border border-line bg-white p-6">
              {venue.quote && (
                <blockquote className="font-serif text-[1.2rem] italic leading-relaxed text-ink">
                  &ldquo;{venue.quote}&rdquo;
                </blockquote>
              )}
              {venue.why.length > 0 && (
                <ul className={cn('space-y-3', venue.quote && 'mt-5 border-t border-line-soft pt-5')}>
                  {venue.why.map((reason) => (
                    <li key={reason} className="flex items-start gap-3">
                      <Check size={13} className="mt-1 shrink-0 text-sage-strong" />
                      <span className="text-[0.9rem] leading-relaxed text-ink-soft">{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {allVenues.length > 1 && (
          <div className="mt-10 border-t border-line-soft pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Flere fra jeres liste')}</p>
            <div className="mt-5 flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {allVenues.filter((v) => v.id !== venue.id).slice(0, 4).map((v) => (
                <button key={v.id} type="button" onClick={() => onSelectOther(v.id)}
                  className="relative shrink-0 overflow-hidden rounded-[14px] text-left cursor-pointer"
                  style={{ width: 'min(180px, 45vw)', aspectRatio: '3/4' }}>
                  <img src={imgSrc(v.image)} alt={v.name}
                    className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-serif text-[0.95rem] leading-tight text-paper">{v.name}</p>
                    {v.rating != null && (
                      <p className="mt-0.5 text-[0.65rem] text-sage-tint">★ {v.rating.toFixed(1)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-line-soft pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Jeres noter')}</p>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Skriv noter om dette venue, spørgsmål, mavefornemmelser, hvad I vil spørge om til visning…')}
            rows={4}
            className="mt-3 w-full resize-none rounded-[18px] border border-line bg-white px-5 py-4 text-[0.9rem] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
          />
        </div>

        <div className="mt-8 border-t border-line-soft pt-8">
          <p className="mb-4 text-[0.8rem] text-muted">
            {t('Juno forbereder en personlig henvendelse og sender den på jeres vegne.')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {isBooked ? (
              <div className="flex h-8 items-center gap-1.5 rounded-full bg-sage-wash px-3 text-xs font-semibold text-ink">
                <Check size={13} /> {t('Jeres venue')}
              </div>
            ) : (
              <>
                <button type="button" onClick={onBook}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper hover:opacity-85 transition-opacity">
                  <Check size={13} /> {t('Vælg som jeres venue')}
                </button>
                <button type="button" onClick={onContact} disabled={sent}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-white px-3 text-xs font-semibold text-ink hover:bg-paper transition-colors disabled:cursor-default disabled:opacity-60 disabled:hover:bg-white">
                  {sent ? <><Check size={13} /> {t('Juno har kontaktet stedet')}</> : <><Send size={12} /> {t('Kontakt via Juno')}</>}
                </button>
              </>
            )}
            <button type="button" onClick={onSave}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
                saved
                  ? 'bg-sage-wash text-ink'
                  : 'border border-line-soft bg-white text-ink hover:bg-paper',
              )}>
              <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
              {saved ? t('Gemt') : t('Gem venue')}
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
