"use client";

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  MapPin, Flower2, Music, Camera, UtensilsCrossed, Pencil, SlidersHorizontal, Check, Plus,
} from 'lucide-react';
import { cn, CheckDot, taskRowTone, doneLabelClass } from '../ui';
import { useWedding } from '../useWedding';
import type { NavigateTarget } from '../lib/hub-nav';
import { navigateToHub } from '../lib/hub-nav';
import { useLang } from '../i18n';
import { daysUntilWedding } from '@/lib/wedding-date';
import { estimatedTotal } from './budget/estimate';
import { budgetLines, IMAGES } from '../data';
import type { HubCat } from './team/shared';
import HeroPhoto from './home/HeroPhoto';
import PhoneBanner from './home/PhoneBanner';
import { venueCardImage } from './home/venueImage';
import WeddingDatePicker from '../onboarding/WeddingDatePicker';

const HERO_IMG =
  'https://cdn.wonder.so/images/019d9110-e1f2-74f3-85e8-c89f82be5a63/6d0cada0901a800c9f43a2cf68a9d52f6cf2620687565337240b2d069d261834.jpg';
/* Only used until the couple has a venue of their own. The photo it replaces
   was an American ballroom — chandeliers and gold chiavari chairs — on a card
   inviting a Danish couple to find somewhere that matches their mood. */
const VENUE_FALLBACK_IMG = IMAGES.orangeri;

type CheckStatus = 'completed' | 'in_progress' | 'todo';

/* The two the product is built on: the read-back of what they told Ava, and
   the date-and-budget that everything else is derived from. */
const LOCKED_TASKS = ['welcome', 'basics'];

type ChecklistItem = {
  id: string;
  label: string;
  status: CheckStatus;
  /** The concrete next move — a number they can react to beats a category name. */
  hint?: string;
  screen?: NavigateTarget;
  hubTab?: 'explore' | 'shortlist';
  hubCat?: HubCat;
};

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
    couple, event, journey, venues, guests, budgetItems, weddingSite, updateEvent,
  } = useWedding();
  const [editingDate, setEditingDate] = useState(false);
  const [customising, setCustomising] = useState(false);
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-US' : 'da-DK';

  const days = daysUntilWedding(event);
  const likedVenues = venues.filter((v) => v.category === 'venue' && v.swipe_status === 'liked');
  const hasChosenVenue = Boolean(event?.chosen_venue_id);
  const guestsMissingContact = guests.filter((g) => !g.email?.trim()).length;
  const guestsConfirmed = guests.filter((g) => g.rsvp === 'ja').length;
  const bookedVendors = venues.filter((v) => v.category !== 'venue' && v.booked_at).length;

  const budgetTotal = couple.budgetTotal || 0;
  const budgetCommitted = budgetItems.reduce((sum, item) => sum + (item.planned_amount ?? 0), 0);
  const budgetPct = budgetTotal > 0 ? Math.round((budgetCommitted / budgetTotal) * 100) : 0;

  const coupleLabel = couple.b && couple.a
    ? `${couple.a} & ${couple.b}`
    : couple.a || t('Jeres bryllup');

  const dateLine = event?.event_date
    ? `${formatLongDate(event.event_date, locale)}${couple.region ? ` · ${couple.region}` : ''}`
    : couple.dateLabel + (couple.region ? ` · ${couple.region}` : '');

  /* A season chip in onboarding ("Forår 2028") lands in date_hint, not
     event_date. Counting only the exact date meant nagging couples who had
     already answered — the row is about the budget for everyone else. */
  const hasDate = Boolean(event?.event_date || event?.date_hint);
  const hasBudget = Boolean(event?.budget);
  const venueStage = journey.find((s) => s.key === 'venue');
  const vendorsStage = journey.find((s) => s.key === 'vendors');
  const invitesStage = journey.find((s) => s.key === 'invites');

  /* What we can responsibly suggest they budget, from what they already told
     us — 0 when we know neither a budget nor a headcount, and a number with
     nothing behind it is worse than no number. */
  const budgetSuggestion = estimatedTotal(budgetTotal, guests.length || couple.guests || 0);

  /* The opening list. Research on activation checklists is consistent on four
     points: keep it to about four items, show progress, tie every row to a
     real action, and have the first one already ticked. The couple just told
     Ava everything about their wedding — starting them at "0 af 5 klaret" is
     throwing that away. */
  const allTasks = useMemo((): ChecklistItem[] => {
    const items: ChecklistItem[] = [
      {
        id: 'welcome',
        label: t('Fortæl Ava om jeres bryllup'),
        status: 'completed',
        screen: 'ava',
      },
      /* One row, but the two halves are edited in different places: the total
         is a field on the budget page, the date opens the picker in the hero.
         Sending both to Ava (as this used to) meant pressing "Vi foreslår kr
         200.000" landed you in the chat instead of the budget. */
      !hasBudget
        ? {
            id: 'basics',
            label: t('Sæt jeres budget'),
            hint: budgetSuggestion > 0
              ? t('Vi foreslår kr {amount}', { amount: kr(budgetSuggestion) })
              : t('Ava fordeler det på kategorier bagefter'),
            status: 'in_progress' as CheckStatus,
            screen: 'budget' as NavigateTarget,
          }
        : {
            id: 'basics',
            label: hasDate ? t('Angiv dato og budget') : t('Sæt jeres dato'),
            hint: hasDate ? undefined : t('Tryk på datoen øverst på siden'),
            status: (hasDate ? 'completed' : 'in_progress') as CheckStatus,
            screen: 'budget' as NavigateTarget,
          },
      {
        id: 'venues',
        label: t('Shortlist jeres venues'),
        hint: likedVenues.length > 0
          ? t('{n} af 3 på shortlisten', { n: likedVenues.length })
          : t('Ava søger på nettet og lægger dem på tavlen'),
        status: hasChosenVenue || likedVenues.length >= 3
          ? 'completed'
          : likedVenues.length > 0 || venueStage?.status === 'active'
            ? 'in_progress'
            : 'todo',
        screen: 'team',
        hubTab: likedVenues.length > 0 ? 'shortlist' : 'explore',
        hubCat: 'venue',
      },
      {
        id: 'guests',
        label: t('Lav gæstelisten'),
        hint: guests.length > 0
          ? t('{n} af 10 tilføjet', { n: guests.length })
          : t('Tilføj de første 10 gæster'),
        status: guests.length >= 10
          ? 'completed'
          : guests.length > 0
            ? 'in_progress'
            : 'todo',
        screen: 'guests',
      },
      {
        id: 'vendors',
        label: t('Book jeres leverandører'),
        status: bookedVendors >= 2
          ? 'completed'
          : bookedVendors > 0 || vendorsStage?.status === 'active'
            ? 'in_progress'
            : 'todo',
        screen: 'team',
        hubTab: 'explore',
        hubCat: 'fotografi',
      },
      {
        id: 'invites',
        label: t('Send save the dates'),
        status: invitesStage?.status === 'complete'
          ? 'completed'
          : invitesStage?.status === 'active'
            ? 'in_progress'
            : 'todo',
        screen: 'invites',
      },
    ];
    return items;
  }, [
    t, hasDate, hasBudget, budgetSuggestion, hasChosenVenue, likedVenues.length, venueStage?.status,
    guests.length, bookedVendors, vendorsStage?.status, invitesStage?.status,
  ]);

  /* Not every wedding has a website, a registry or save-the-dates. A row they
     will never tick is worse than no row, so they can switch any of them off —
     except the two the whole product is built on. */
  const hidden = useMemo(() => new Set(event?.checklist_hidden ?? []), [event?.checklist_hidden]);
  const shownTasks = useMemo(
    () => allTasks.filter((c) => !hidden.has(c.id)),
    [allTasks, hidden],
  );

  const toggleTask = (id: string) => {
    const next = hidden.has(id)
      ? [...hidden].filter((x) => x !== id)
      : [...hidden, id];
    void updateEvent({ checklist_hidden: next });
  };

  /* Four rows at a time: what they have done, what they are on, and the next
     two. The rest of the plan lives on the timeline — available, just not the
     first thing they meet. */
  const checklist = useMemo(() => {
    const done = shownTasks.filter((c) => c.status === 'completed');
    const open = shownTasks.filter((c) => c.status !== 'completed');
    // Nothing left to do: show the tail of what they finished rather than a
    // single lonely row.
    if (open.length === 0) return done.slice(-4);
    return [...done.slice(-1), ...open].slice(0, 4);
  }, [shownTasks]);

  const allTasksDone = shownTasks.every((c) => c.status === 'completed');
  const hiddenTasks = shownTasks.length - checklist.length;

  const checklistDone = checklist.filter((c) => c.status === 'completed').length;

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

  const openChecklist = (item: ChecklistItem) => {
    if (item.hubTab) navigateToHub(item.hubTab, item.hubCat);
    if (item.screen) onNavigate(item.screen);
  };

  return (
    <div className="flex min-h-full flex-col gap-10 bg-[#f4f5f3] px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="flex flex-col gap-7"
      >
        <div
          className="flex w-full flex-col gap-8 rounded-[28px] border border-[#dcdfdb] bg-[#e6e9e6] p-7 lg:flex-row"
        >
          <HeroPhoto fallback={HERO_IMG} alt={coupleLabel} />
          <div className="flex flex-1 flex-col justify-center gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7d938a]">
              {t('Brylluppet for')}
            </p>
            <h1 className="font-serif text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.05] text-[#24413a]">
              {coupleLabel}
            </h1>
            {/* The date is the product's pulse, and it changes — it should be
                editable where it is shown, not only by asking Ava. */}
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
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-[#24413a] px-5 py-2">
              <span className="font-serif text-xl font-semibold text-[#f8f9f8]">
                {days ?? '-'}
              </span>
              <span className="text-sm font-semibold text-[#dbe5e0]">{t('dage tilbage')}</span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div
          className="flex flex-col gap-5 rounded-[28px] border border-line bg-card p-7"
        >
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                {t('Kom godt i gang')}
              </h2>
              <p className="text-sm text-ink-soft">
                {allTasksDone
                  ? t('I har været hele vejen igennem. Resten holder jeg øje med.')
                  : t('De første skridt for at sætte planlægningen i gang.')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p aria-live="polite" className="text-sm font-bold text-sage-strong">
                {t('{done} af {total} klaret', { done: checklistDone, total: checklist.length })}
              </p>
              <button
                type="button"
                onClick={() => setCustomising((v) => !v)}
                aria-expanded={customising}
                aria-label={t('Vælg hvad I vil holde styr på')}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden />
              </button>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={checklistDone}
            aria-valuemin={0}
            aria-valuemax={checklist.length}
            aria-label={t('Kom godt i gang')}
            className="h-1 w-full overflow-hidden rounded-full bg-shell"
          >
            <div
              className="h-full rounded-full bg-sage-strong"
              style={{ width: `${(checklistDone / Math.max(checklist.length, 1)) * 100}%` }}
            />
          </div>

          <div className="flex flex-col gap-3">
            {checklist.map((item) => (
              <ChecklistRow
                key={item.id}
                label={item.label}
                hint={item.hint}
                status={item.status}
                statusLabel={
                  item.status === 'completed'
                    ? t('Færdig')
                    : item.status === 'in_progress'
                      ? t('I gang')
                      : ''
                }
                onClick={() => openChecklist(item)}
              />
            ))}
          </div>

          {customising && (
            <div className="flex flex-col gap-3 rounded-[18px] bg-shell p-4">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {t('Vælg hvad I vil holde styr på')}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  {t('Slå fra, hvad der ikke hører til jeres bryllup. I kan altid slå det til igen.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allTasks
                  .filter((task) => !LOCKED_TASKS.includes(task.id))
                  .map((task) => {
                    const on = !hidden.has(task.id);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => toggleTask(task.id)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors',
                          on
                            ? 'border-sage-strong bg-sage-tint text-sage-strong'
                            : 'border-line text-muted hover:border-ink hover:text-ink',
                        )}
                      >
                        {on ? <Check size={13} strokeWidth={2.4} aria-hidden /> : <Plus size={13} strokeWidth={2.4} aria-hidden />}
                        {task.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {hiddenTasks > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('planning')}
              className="-mt-1 w-fit cursor-pointer text-[13px] text-muted transition-colors hover:text-ink"
            >
              {t('Resten af tjeklisten ligger under Tidslinje & tjekliste →')}
            </button>
          )}
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
            <h3 className="font-serif text-3xl font-semibold leading-tight text-[#f8f9f8]">
              {t('Find jeres venue')}
            </h3>
            <p className="max-w-[420px] text-sm leading-relaxed text-[#e6ebe0]">
              {t('Steder der matcher gæsteantal, stemning, placering og budget.')}
            </p>
          </div>
          <span className="relative mt-4 inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-[#f8f9f8] px-3 text-xs font-semibold text-[#24413a]">
            {t('Udforsk venues')}
            <MapPin size={13} />
          </span>
        </button>

        <div className="flex flex-1 flex-col gap-6 rounded-[26px] border border-[#dcdfdb] bg-[#ffffff] p-7">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h3 className="font-serif text-3xl font-semibold text-[#24413a]">
                {t('Find leverandører')}
              </h3>
              <p className="text-sm text-[#5f6b66]">
                {t('Saml holdet der bringer dagen til live.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goHub('explore', 'fotografi')}
              className="shrink-0 text-sm font-bold text-[#24413a] hover:opacity-70"
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
                  className="flex flex-col gap-3 rounded-[18px] border border-[#e6e9e5] bg-[#eceeeb] p-4 text-left transition-colors hover:bg-[#e8e4da]"
                >
                  <Icon size={20} className="text-[#35544a]" strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-bold text-[#24413a]">{tile.label}</p>
                    <p className="text-[11px] text-[#5f6b66]">{tile.meta}</p>
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
        <div className="flex items-end justify-between border-b border-[#e2e6e2] pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-[28px] font-semibold text-[#24413a]">
              {t('Over hele planlægningen')}
            </h2>
            <p className="text-sm text-[#5f6b66]">
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
                  : t('Fortæl Ava jeres gæsteantal, så regner jeg et forslag')
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
                  ? t('Ava søger steder i {region} på det åbne web', { region: couple.region })
                  : t('Ava søger steder på det åbne web og verificerer dem')
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

      <p className="pb-4 text-center text-[13px] text-[#a6b0aa]">
        {t('Planlagt med omtanke af {names}, guidet af Ava.', { names: coupleLabel })}
      </p>
    </div>
  );
}

function ChecklistRow({
  label,
  hint,
  status,
  statusLabel,
  onClick,
}: {
  label: string;
  hint?: string;
  status: CheckStatus;
  statusLabel: string;
  onClick: () => void;
}) {
  const done = status === 'completed';
  const active = status === 'in_progress';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={statusLabel ? `${label} — ${statusLabel}` : label}
      className={`flex w-full items-center gap-4 rounded-[18px] border px-5 py-4 text-left transition-colors hover:opacity-95 ${taskRowTone(
        done ? 'done' : 'default',
      )}`}
    >
      <CheckDot done={done} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-base font-semibold ${done ? doneLabelClass : 'text-ink'}`}>
          {label}
        </span>
        {/* A task that hasn't started shows its next move, not its absence. */}
        {!done && hint && <span className="text-[13px] text-ink-soft">{hint}</span>}
      </span>
      {statusLabel && (
        <span
          className={`text-xs font-bold uppercase tracking-[0.12em] ${
            done ? 'text-sage-strong' : active ? 'text-clay' : 'text-muted'
          }`}
        >
          {statusLabel}
        </span>
      )}
    </button>
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
