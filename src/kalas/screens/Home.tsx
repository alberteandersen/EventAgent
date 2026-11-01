"use client";

import { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Flower2, Music, Camera, UtensilsCrossed, Pencil } from 'lucide-react';
import { Page, PageLoader } from '../ui';
import { useWedding } from '../useWedding';
import type { NavigateTarget } from '../lib/hub-nav';
import { navigateToHub } from '../lib/hub-nav';
import { useLang } from '../i18n';
import { daysUntilWedding } from '@/lib/wedding-date';
import { estimatedTotal } from './budget/estimate';
import { IMAGES } from '../images';
import { budgetLines } from '@/lib/budget/benchmarks';
import type { HubCat } from './team/shared';
import HeroPhoto from './home/HeroPhoto';
import PhoneBanner from './home/PhoneBanner';
import { venueCardImage } from './home/venueImage';
import WeddingDatePicker from '../onboarding/WeddingDatePicker';

const HERO_IMG = '/landing/hero.jpg';
/* Only used until the couple has a venue of their own. The photo it replaces
   was an American ballroom — chandeliers and gold chiavari chairs — on a card
   inviting a Danish couple to find somewhere that matches their mood. */
const VENUE_FALLBACK_IMG = IMAGES.orangeri;

function formatLongDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function kr(n: number): string {
  return n.toLocaleString('da-DK');
}

export default function Home({ onNavigate }: { onNavigate: (s: NavigateTarget) => void }) {
  const {
    loading, couple, event, venues, guests, budgetItems, weddingSite, updateEvent,
  } = useWedding();
  const [editingDate, setEditingDate] = useState(false);
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-US' : 'da-DK';

  const days = daysUntilWedding(event);
  const likedVenues = venues.filter((v) => v.category === 'venue' && v.swipe_status === 'liked');
  const guestsMissingContact = guests.filter((g) => !g.email?.trim()).length;
  const guestsConfirmed = guests.filter((g) => g.rsvp === 'ja').length;

  const budgetTotal = couple.budgetTotal || 0;
  const budgetCommitted = budgetItems.reduce((sum, item) => sum + (item.planned_amount ?? 0), 0);
  const budgetPct = budgetTotal > 0 ? Math.round((budgetCommitted / budgetTotal) * 100) : 0;

  const coupleLabel = couple.b && couple.a
    ? `${couple.a} & ${couple.b}`
    : couple.a || t('Jeres bryllup');

  const dateLine = event?.event_date
    ? `${formatLongDate(event.event_date, locale)}${couple.region ? ` · ${couple.region}` : ''}`
    : couple.dateLabel + (couple.region ? ` · ${couple.region}` : '');

  /* What we can responsibly suggest they budget, from what they already told
     us — 0 when we know neither a budget nor a headcount, and a number with
     nothing behind it is worse than no number. */
  const budgetSuggestion = estimatedTotal(budgetTotal, guests.length || couple.guests || 0);

  const vendorTiles = [
    {
      id: 'florist' as const,
      label: t('Blomster'),
      meta: venues.filter((v) => v.category === 'florist').length > 0
        ? t('{n} fundet', { n: venues.filter((v) => v.category === 'florist').length })
        : t('Florister i nærheden'),
      icon: Flower2,
      hubCat: 'blomster' as HubCat,
    },
    {
      id: 'musician' as const,
      label: t('Musik'),
      meta: t('DJ\'s og bands'),
      icon: Music,
      hubCat: 'musik' as HubCat,
    },
    {
      id: 'photographer' as const,
      label: t('Foto'),
      meta: venues.filter((v) => v.category === 'photographer').length > 0
        ? t('{n} fundet', { n: venues.filter((v) => v.category === 'photographer').length })
        : t('Fotografer'),
      icon: Camera,
      hubCat: 'fotografi' as HubCat,
    },
    {
      id: 'caterer' as const,
      label: t('Catering'),
      meta: t('Menuer og kage'),
      icon: UtensilsCrossed,
      hubCat: 'catering' as HubCat,
    },
  ];

  const goHub = (tab: 'explore' | 'shortlist', cat?: HubCat) => {
    navigateToHub(tab, cat);
    onNavigate('team');
  };

  // Before the wedding arrives the hero would read "Jeres bryllup" and a
  // countdown of nothing.
  if (loading) return <PageLoader />;

  return (
    <Page>
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="flex flex-col gap-7"
      >
        <div
          className="flex w-full flex-col gap-8 rounded-[28px] border border-line bg-blush p-7 lg:flex-row"
        >
          <HeroPhoto fallback={HERO_IMG} alt={coupleLabel} />
          <div className="flex flex-1 flex-col justify-center gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage-strong">
              {t('Brylluppet for')}
            </p>
            <h1 className="font-serif text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.05] text-ink">
              {coupleLabel}
            </h1>
            {/* The date is the product's pulse, and it changes — it should be
                editable where it is shown, not only by asking Juno. */}
            <div className="relative flex flex-col items-start">
              <button
                type="button"
                onClick={() => setEditingDate((v) => !v)}
                aria-expanded={editingDate}
                className="group -mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left text-base text-ink-soft transition-colors hover:bg-shell"
              >
                {dateLine}
                <Pencil
                  size={14}
                  strokeWidth={1.8}
                  aria-hidden
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                />
                <span className="sr-only">{t('Ret datoen')}</span>
              </button>

              {editingDate && (
                <div className="absolute top-full left-0 z-20 mt-2 w-[300px] rounded-2xl border border-line-strong bg-card p-4 shadow-[0_12px_32px_rgba(19,26,22,0.18)]">
                  <WeddingDatePicker
                    value={event?.event_date ?? ''}
                    lang={lang}
                    onChange={(iso) => {
                      // date_precision follows the date, or the timeline and
                      // the countdown disagree about how firm it is.
                      void updateEvent({ event_date: iso, date_precision: 'exact' });
                      setEditingDate(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingDate(false)}
                    className="mt-3 w-full cursor-pointer text-[13px] font-semibold text-muted hover:text-ink"
                  >
                    {t('Luk')}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2">
              <span className="font-serif text-xl font-semibold text-paper">
                {days ?? '-'}
              </span>
              <span className="text-sm font-semibold text-sage-tint">{t('dage tilbage')}</span>
            </div>
          </div>
        </div>

      </motion.section>

      {/* Discovery */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex flex-col gap-5 lg:flex-row"
      >
        <button
          type="button"
          onClick={() => goHub('explore', 'venue')}
          className="relative flex min-h-[280px] flex-1 flex-col justify-end overflow-hidden rounded-[26px] bg-cover bg-center p-7 text-left"
          style={{ backgroundImage: `url('${venueCardImage(venues, event?.chosen_venue_id, VENUE_FALLBACK_IMG)}')` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(20,32,16,0.15)_0%,rgba(20,32,16,0.82)_100%)]" />
          <div className="relative flex flex-col gap-2">
            <h3 className="font-serif text-3xl font-semibold leading-tight text-paper">
              {t('Find jeres venue')}
            </h3>
            <p className="max-w-[420px] text-sm leading-relaxed text-sage-tint">
              {t('Steder der matcher gæsteantal, stemning, placering og budget.')}
            </p>
          </div>
          <span className="relative mt-4 inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-paper px-3 text-xs font-semibold text-ink">
            {t('Udforsk venues')}
            <MapPin size={13} />
          </span>
        </button>

        <div className="flex flex-1 flex-col gap-6 rounded-[26px] border border-line bg-white p-7">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h3 className="font-serif text-3xl font-semibold text-ink">
                {t('Find leverandører')}
              </h3>
              <p className="text-sm text-muted">
                {t('Saml holdet der bringer dagen til live.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goHub('explore', 'fotografi')}
              className="shrink-0 text-sm font-bold text-ink hover:opacity-70"
            >
              {t('Se alle →')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {vendorTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => goHub('explore', tile.hubCat)}
                  className="flex flex-col gap-3 rounded-[18px] border border-line-soft bg-shell p-4 text-left transition-colors hover:bg-shell"
                >
                  <Icon size={20} className="text-ink-soft" strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-bold text-ink">{tile.label}</p>
                    <p className="text-[11px] text-muted">{tile.meta}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Overview */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="flex flex-col gap-5"
      >
        <div className="flex items-end justify-between border-b border-line-soft pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-[28px] font-semibold text-ink">
              {t('Over hele planlægningen')}
            </h2>
            <p className="text-sm text-muted">
              {t('Et roligt overblik over alle hjørner af brylluppet.')}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            label={t('Budget')}
            stat={budgetTotal > 0 ? `${budgetPct}%` : budgetSuggestion > 0 ? t('Forslag') : '—'}
            detail={
              budgetTotal > 0
                ? t('kr {spent} af kr {total} fordelt', { spent: kr(budgetCommitted), total: kr(budgetTotal) })
                : budgetSuggestion > 0
                  ? t('Brancheestimat for et dansk bryllup. Ret det hele.')
                  : t('Fortæl Juno jeres gæsteantal, så regner jeg et forslag')
            }
            suggestion={
              /* An empty budget page is wasted space. Open on a real Danish
                 starting point, marked as the estimate it is — a number to
                 push around beats a field to invent. */
              budgetTotal === 0 && budgetSuggestion > 0
                ? budgetLines.slice(0, 3).map((line) => ({
                    label: t(line.label),
                    value: `kr ${kr(Math.round((budgetSuggestion * line.pct) / 100))}`,
                  }))
                : undefined
            }
            link={t('Åbn budget →')}
            onClick={() => onNavigate('budget')}
          />
          <OverviewCard
            label={t('Gæster')}
            stat={String(guests.length || couple.guests || 0)}
            detail={
              guests.length > 0
                ? t('{confirmed} bekræftet · {missing} mangler kontakt', {
                    confirmed: guestsConfirmed,
                    missing: guestsMissingContact,
                  })
                : t('Importér fra CSV, eller tilføj de første ti i hånden')
            }
            link={t('Åbn gæster →')}
            onClick={() => onNavigate('guests')}
          />
          <OverviewCard
            label={t('Venues')}
            stat={String(likedVenues.length)}
            detail={
              likedVenues.length > 0
                ? t('på shortlisten til gennemgang')
                : couple.region
                  ? t('Juno søger steder i {region} på det åbne web', { region: couple.region })
                  : t('Juno søger steder på det åbne web og verificerer dem')
            }
            link={t('Åbn venues →')}
            onClick={() => goHub(likedVenues.length > 0 ? 'shortlist' : 'explore', 'venue')}
          />
          <OverviewCard
            label={t('Hjemmeside')}
            stat={weddingSite?.published ? t('Live') : t('Kladde')}
            detail={
              weddingSite?.published
                ? t('Jeres bryllupsside er publiceret')
                : t('Vælg et tema, og publicér når I er klar')
            }
            link={t('Åbn hjemmeside →')}
            onClick={() => onNavigate('website')}
          />
        </div>
      </motion.section>

      <PhoneBanner />

      <p className="pb-4 text-center text-[13px] text-muted">
        {t('Planlagt med omtanke af {names}, guidet af Juno.', { names: coupleLabel })}
      </p>
    </Page>
  );
}

function OverviewCard({
  label,
  stat,
  detail,
  suggestion,
  link,
  onClick,
}: {
  label: string;
  stat: string;
  detail: string;
  /** A starting point shown in place of an empty number. */
  suggestion?: { label: string; value: string }[];
  link: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[200px] flex-1 flex-col gap-4 rounded-[18px] border border-line bg-card p-6 text-left transition-shadow hover:shadow-[0_8px_24px_rgba(36,65,58,0.06)]"
    >
      <p className="eyebrow">{label}</p>
      {suggestion ? (
        <div className="flex flex-col gap-1.5">
          {suggestion.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink-soft">{row.label}</span>
              <span className="shrink-0 text-[13px] font-semibold text-ink">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {stat}
        </p>
      )}
      <p className="flex-1 text-[13px] leading-snug text-muted">{detail}</p>
      <span className="text-[13px] font-semibold text-terracotta">{link}</span>
    </button>
  );
}
