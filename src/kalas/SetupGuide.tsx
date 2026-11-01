"use client";

import { useMemo, useState, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import { Check, Minimize2, Plus, SlidersHorizontal, X } from 'lucide-react';
import { cn, CheckDot, doneLabelClass } from './ui';
import { useWedding } from './useWedding';
import type { NavigateTarget } from './lib/hub-nav';
import { navigateToHub } from './lib/hub-nav';
import { useLang } from './i18n';
import { estimatedTotal } from './screens/budget/estimate';
import type { HubCat } from './screens/team/shared';

/* "Kom godt i gang": the first steps, floating in the bottom-right corner of
   whichever page the couple is on. It used to be a card on Hjem, which meant
   the next step was only in sight on one page, and that the page they landed
   on opened with a to-do list rather than their wedding.

   It can be minimised to a pill at any time. It can only be closed once every
   step is done: there is nowhere to open it from again, so until then putting
   it away means making it small. */

/** localStorage key: 'min' or 'closed' on this device. Absent, it is open. */
const GUIDE_KEY = 'kalas_setup_guide';

type GuideMode = 'open' | 'min' | 'closed';
type CheckStatus = 'completed' | 'in_progress' | 'todo';

/* The two the product is built on: the read-back of what they told Juno, and
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

function kr(n: number): string {
  return n.toLocaleString('da-DK');
}

const noop = () => () => {};

export default function SetupGuide({ onNavigate }: { onNavigate: (s: NavigateTarget) => void }) {
  // The mode is read from storage, which only the client has.
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  const { loading } = useWedding();
  if (!onClient || loading) return null;
  return <Guide onNavigate={onNavigate} />;
}

function Guide({ onNavigate }: { onNavigate: (s: NavigateTarget) => void }) {
  const { couple, event, journey, venues, guests, updateEvent } = useWedding();
  const { t } = useLang();
  const [customising, setCustomising] = useState(false);
  const [mode, setModeState] = useState<GuideMode>(() => {
    try {
      const stored = localStorage.getItem(GUIDE_KEY);
      if (stored === 'min' || stored === 'closed') return stored;
    } catch { /* ignore */ }
    // On a phone the open card would cover most of the page it floats over.
    return window.matchMedia('(max-width: 1023.98px)').matches ? 'min' : 'open';
  });
  const setMode = (next: GuideMode) => {
    setModeState(next);
    try {
      if (next === 'open') localStorage.removeItem(GUIDE_KEY);
      else localStorage.setItem(GUIDE_KEY, next);
    } catch { /* ignore */ }
  };

  const likedVenues = venues.filter((v) => v.category === 'venue' && v.swipe_status === 'liked');
  const hasChosenVenue = Boolean(event?.chosen_venue_id);
  const bookedVendors = venues.filter((v) => v.category !== 'venue' && v.booked_at).length;

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
  const budgetSuggestion = estimatedTotal(couple.budgetTotal || 0, guests.length || couple.guests || 0);

  /* The opening list. Research on activation checklists is consistent on four
     points: keep it to about four items, show progress, tie every row to a
     real action, and have the first one already ticked. The couple just told
     Juno everything about their wedding — starting them at "0 af 5 klaret" is
     throwing that away. */
  const allTasks = useMemo((): ChecklistItem[] => {
    const items: ChecklistItem[] = [
      {
        id: 'welcome',
        label: t('Fortæl Juno om jeres bryllup'),
        status: 'completed',
        screen: 'juno',
      },
      /* One row, but the two halves are edited in different places: the total
         is a field on the budget page, the date opens the picker in the hero
         on Hjem. */
      !hasBudget
        ? {
            id: 'basics',
            label: t('Sæt jeres budget'),
            hint: budgetSuggestion > 0
              ? t('Vi foreslår kr {amount}', { amount: kr(budgetSuggestion) })
              : t('Juno fordeler det på kategorier bagefter'),
            status: 'in_progress' as CheckStatus,
            screen: 'budget' as NavigateTarget,
          }
        : {
            id: 'basics',
            label: hasDate ? t('Angiv dato og budget') : t('Sæt jeres dato'),
            hint: hasDate ? undefined : t('Tryk på datoen øverst på Hjem'),
            status: (hasDate ? 'completed' : 'in_progress') as CheckStatus,
            screen: (hasDate ? 'budget' : 'home') as NavigateTarget,
          },
      {
        id: 'venues',
        label: t('Shortlist jeres venues'),
        hint: likedVenues.length > 0
          ? t('{n} af 3 på shortlisten', { n: likedVenues.length })
          : t('Juno søger på nettet og lægger dem på tavlen'),
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
  const pct = Math.round((checklistDone / Math.max(checklist.length, 1)) * 100);

  const openChecklist = (item: ChecklistItem) => {
    if (item.hubTab) navigateToHub(item.hubTab, item.hubCat);
    if (item.screen) onNavigate(item.screen);
  };

  if (mode === 'closed') return null;

  /* Above the bottom bar on a phone. Under Juno's drawer and sheet, which are
     z-30 and up in the same plane, so her message box is never covered. */
  const corner = 'absolute right-3 bottom-24 z-20 lg:right-6 lg:bottom-6';

  if (mode === 'min') {
    return (
      <motion.button
        type="button"
        onClick={() => setMode('open')}
        aria-expanded={false}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          corner,
          'flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-card pr-4 pl-3 text-meta font-semibold text-ink shadow-[0_12px_32px_-10px_rgba(18,51,43,0.3)] transition-colors hover:border-ink',
        )}
      >
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ background: `conic-gradient(var(--color-sage-strong) ${pct}%, var(--color-shell) 0)` }}
        />
        {t('Kom godt i gang')}{' '}
        <span className="font-bold text-sage-strong">
          {t('{n} af {total}', { n: checklistDone, total: checklist.length })}
        </span>
      </motion.button>
    );
  }

  const iconButton =
    'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-ink';

  return (
    <motion.section
      aria-label={t('Kom godt i gang')}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        corner,
        'flex max-h-[calc(100%-7.5rem)] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-[20px] border border-line bg-card shadow-[0_18px_44px_-12px_rgba(18,51,43,0.3)] lg:max-h-[calc(100%-3rem)]',
      )}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold leading-tight text-ink">
              {t('Kom godt i gang')}
            </h2>
            <p className="mt-1 text-meta text-ink-soft">
              {allTasksDone
                ? t('I har været hele vejen igennem. Resten holder jeg øje med.')
                : t('De første skridt for at sætte planlægningen i gang.')}
            </p>
          </div>
          <div className="-mt-0.5 -mr-1 flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setCustomising((v) => !v)}
              aria-expanded={customising}
              aria-label={t('Vælg hvad I vil holde styr på')}
              className={iconButton}
            >
              <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden />
            </button>
            <button type="button" onClick={() => setMode('min')} aria-label={t('Minimér')} className={iconButton}>
              <Minimize2 size={14} strokeWidth={1.8} aria-hidden />
            </button>
            {allTasksDone && (
              <button type="button" onClick={() => setMode('closed')} aria-label={t('Luk')} className={iconButton}>
                <X size={15} strokeWidth={1.8} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={checklistDone}
            aria-valuemin={0}
            aria-valuemax={checklist.length}
            aria-label={t('Kom godt i gang')}
            className="h-1 flex-1 overflow-hidden rounded-full bg-shell"
          >
            <div className="h-full rounded-full bg-sage-strong" style={{ width: `${pct}%` }} />
          </div>
          <p aria-live="polite" className="shrink-0 text-xs font-bold text-sage-strong">
            {t('{done} af {total} klaret', { done: checklistDone, total: checklist.length })}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
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

        {customising && (
          <div className="mx-2 mt-2 flex flex-col gap-3 rounded-[14px] bg-shell p-3">
            <div>
              <p className="text-meta font-semibold text-ink">
                {t('Vælg hvad I vil holde styr på')}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {t('Slå fra, hvad der ikke hører til jeres bryllup. I kan altid slå det til igen.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
                        'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                        on
                          ? 'border-sage-strong bg-sage-tint text-sage-strong'
                          : 'border-line text-muted hover:border-ink hover:text-ink',
                      )}
                    >
                      {on ? <Check size={12} strokeWidth={2.4} aria-hidden /> : <Plus size={12} strokeWidth={2.4} aria-hidden />}
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
            className="mx-2 mt-2 w-fit cursor-pointer text-left text-xs text-muted transition-colors hover:text-ink"
          >
            {t('Resten af planen ligger under Planlægning →')}
          </button>
        )}
      </div>
    </motion.section>
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

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={statusLabel ? `${label} — ${statusLabel}` : label}
      className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-shell"
    >
      <CheckDot done={done} className="!size-5" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-sm font-semibold leading-5', done ? doneLabelClass : 'text-ink')}>
          {label}
        </span>
        {/* A task that hasn't started shows its next move, not its absence. */}
        {!done && hint && <span className="text-xs text-ink-soft">{hint}</span>}
      </span>
    </button>
  );
}
