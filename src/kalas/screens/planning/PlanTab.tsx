import * as React from 'react';
import { useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarClock, Check, ChevronDown, PartyPopper, Plus, Search, X } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { showNotice } from '../../notice';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import type { ScreenId } from '../../Shell';
import type { TimelineTaskRow } from '@/lib/db/types';
import { usePlanningSignals } from '../../lib/usePlanningSignals';
import TaskRow, { type DisplayTask } from './TaskRow';
import TaskDialog from './TaskDialog';
import AddRow from './AddRow';
import ResetControl from './ResetControl';
import { canRun, runMilestoneAction } from './actions';
import { seeding, useChecklistSeed } from './useChecklistSeed';
import { defaultMilestones, DEFAULT_MILESTONE_TITLES } from './milestones';
import { defaultChecklist, phaseOf, PHASES, type Phase } from './checklist-data';
import { phaseNow, phaseOfRow, phaseWindow, planByPhase, type PhaseGroup } from './phases';
import {
  CHECKLIST_AREAS, MILESTONE_ACTIONS, areaOf, assigneeInitials, assigneeName,
  isCheck, isMilestone, nextSort, priorityOf, shiftPlan, todayISO, topUpKey,
} from './shared';

/** The phase as a heading, and in a few words on a search result. Danish
 *  source strings. With a wedding date, the phases counted in months go by
 *  their calendar months instead (MONTH_PHASES below). */
const PHASE_TITLE: Record<Phase, string> = {
  '12-18': '12–18 måneder før', '9-12': '9–12 måneder før', '6-9': '6–9 måneder før',
  '3-6': '3–6 måneder før', '1-3': '1–3 måneder før', maaned: 'Den sidste måned',
  uge: 'Ugen før', dagen: 'På dagen', efter: 'Efter brylluppet',
};
const PHASE_STEP: Record<Phase, string> = {
  '12-18': '12–18 mdr.', '9-12': '9–12 mdr.', '6-9': '6–9 mdr.', '3-6': '3–6 mdr.', '1-3': '1–3 mdr.',
  maaned: 'Sidste måned', uge: 'Ugen før', dagen: 'Dagen', efter: 'Efter',
};
const MONTH_PHASES = new Set<Phase>(['12-18', '9-12', '6-9', '3-6', '1-3']);

/** The page's sections, each named by its first phase. Most are one phase;
 *  the last month, the week before and the day share one, since three
 *  sections for thirty days is two too many. Inside it they keep a heading
 *  each (PART_TITLE). */
const PERIODS: Phase[][] = [['12-18'], ['9-12'], ['6-9'], ['3-6'], ['1-3'], ['maaned', 'uge', 'dagen'], ['efter']];
const PART_TITLE: Partial<Record<Phase, string>> = { maaned: 'De første uger', uge: 'Ugen før', dagen: 'På dagen' };

/** How many to-dos the period they are in opens with, before "Vis alle". */
const START = 4;
const PRIORITY_RANK = { high: 0, medium: 1, low: 3 } as const;

type Row = TimelineTaskRow;

/**
 * The plan on one page, read from the top: the years as markers down a rail,
 * the period the couple is in open with its milestones and a handful of
 * to-dos, and every other period one line that opens in place. Nine tabs with
 * a counter each put two hundred undone things in front of a couple before
 * they had read one of them.
 */
export default function PlanTab({ onCelebrate, onNavigate, onOpenDay }: {
  onCelebrate: (title: string) => void;
  onNavigate?: (s: ScreenId) => void;
  /** Opens the Bryllupsdagen tab, from the day itself. */
  onOpenDay: () => void;
}) {
  const { t, tn, lang } = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'da-DK';
  const { couple, timelineTasks, addTask, updateTask, deleteTask, seedTasks, clearTasks, event } = useWedding();
  const tasks = useWithoutPending(timelineTasks);
  const removeTask = useRemoveWithUndo();
  const { looksDone } = usePlanningSignals();
  const { error: seedError, setError: setSeedError } = useChecklistSeed();
  const reduce = useReducedMotion();

  const today = todayISO();
  const weddingISO = couple.dateISO;
  const now = phaseNow(weddingISO, today);
  const groups = planByPhase(tasks, weddingISO, today);
  const order = PHASES.map((p) => p.id);

  const nowPeriod = PERIODS.find((ps) => ps.includes(now))![0];
  const [openPeriods, setOpenPeriods] = useState<Set<Phase>>(() => new Set([nowPeriod]));
  const [showAll, setShowAll] = useState(false);
  const [showDone, setShowDone] = useState<Set<Phase>>(() => new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ kind: 'todo' | 'milestone'; phase: Phase } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  const nowAt = order.indexOf(now);
  const fmt = (iso: string, withYear = true) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

  /* A phase by name: its calendar months when there is a date to count from,
     "Sep.–mar." in short and "September – marts" as a heading. The year is
     left to the markers on the rail. */
  const monthOf = (iso: string, style: 'short' | 'long') =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { month: style });
  function phaseName(p: Phase, style: 'short' | 'long') {
    if (!weddingISO || !MONTH_PHASES.has(p)) return t((style === 'short' ? PHASE_STEP : PHASE_TITLE)[p]);
    const w = phaseWindow(p, weddingISO);
    const [a, b] = [monthOf(w.from, style), monthOf(w.to, style)];
    const range = a === b ? a : style === 'short' ? `${a}–${b}` : `${a} – ${b}`;
    return range.charAt(0).toLocaleUpperCase(locale) + range.slice(1);
  }

  const toggleIn = (set: Set<Phase>, p: Phase) => {
    const next = new Set(set);
    if (!next.delete(p)) next.add(p);
    return next;
  };
  function togglePeriod(id: Phase) {
    setOpenPeriods((s) => toggleIn(s, id));
    setAdding(null);
    setMenuId(null);
  }

  /* ── When the wedding has moved ─────────────────────────────────────── */
  const weddingRow = tasks.find((r) => r.category === 'wedding_day');
  const moved = weddingISO && weddingRow?.due_date && weddingRow.due_date !== weddingISO
    ? { from: weddingRow.due_date, to: weddingISO }
    : null;
  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  function followWedding() {
    if (!moved) return;
    const shifts = shiftPlan(tasks, moved.from, moved.to);
    for (const s of shifts) void updateTask(s.id, { due_date: s.due_date });
    const others = shifts.filter((s) => s.id !== weddingRow?.id).length;
    showNotice(t('Tidslinjen er flyttet'), tn(others, 'Én dato fulgte med.', '{n} datoer fulgte med.'));
  }

  /* ── Rows ────────────────────────────────────────────────────────────── */
  const toDisplay = (r: Row, withPhase = false): DisplayTask => {
    const p = withPhase ? phaseOfRow(r, weddingISO, now) : null;
    return {
      id: r.id, title: r.title, dateISO: r.due_date, done: r.done,
      weddingDay: r.category === 'wedding_day',
      priority: priorityOf(r),
      assigneeInitials: assigneeInitials(r.assignee, couple),
      assigneeName: r.assignee ? t(assigneeName(r.assignee, couple) ?? '') : null,
      hasNotes: !!r.notes?.trim(),
      dateOptional: isCheck(r),
      phase: p ? phaseName(p, 'short') : null,
    };
  };

  function toggle(r: Row) {
    const nowDone = !r.done;
    void updateTask(r.id, { done: nowDone });
    if (!nowDone) return;
    // The last open thing in the phase: the whole phase is done.
    const g = groups.find((x) => x.phase === phaseOfRow(r, weddingISO, now));
    if (g && g.total > 1 && g.done + 1 === g.total) onCelebrate(t('{phase} er klaret', { phase: phaseName(g.phase, 'long') }));
    else onCelebrate(r.title);
  }

  function rowProps(r: Row) {
    const act = isMilestone(r) ? MILESTONE_ACTIONS[r.title] : undefined;
    const reason = isMilestone(r) ? looksDone(r.title) : null;
    return {
      task: toDisplay(r),
      deleteLabel: isMilestone(r) ? 'Slet milepæl' : 'Slet punkt',
      menuOpen: menuId === r.id,
      onMenu: () => setMenuId((m) => (m === r.id ? null : r.id)),
      onCloseMenu: () => setMenuId(null),
      onToggle: () => toggle(r),
      onOpen: () => { setMenuId(null); setOpenId(r.id); },
      onDelete: () => { setMenuId(null); removeTask(r.id, r.title, () => deleteTask(r.id)); },
      // A to-do they dated can go back to where its phase put it.
      ...(isCheck(r) && r.due_date ? { onClearDate: () => { setMenuId(null); void updateTask(r.id, { due_date: null }); } } : {}),
      onDateChange: (d: string) => void updateTask(r.id, { due_date: d }),
      action: canRun(act, onNavigate) ? { label: act.label, onClick: () => runMilestoneAction(act, onNavigate) } : undefined,
      suggestion: reason ? { reason, onAccept: () => toggle(r) } : undefined,
    };
  }

  /* ── Adding, into the phase it was asked for in ───────────────────────
     With a date, a new to-do is due by the end of the phase it was added in,
     which is also what keeps it in that phase. */
  const phaseEnd = (p: Phase) => (weddingISO ? phaseWindow(p, weddingISO).to : '');
  function openAdd(kind: 'todo' | 'milestone', phase: Phase) {
    setAdding({ kind, phase });
    setNewTitle('');
    setNewDate(phaseEnd(phase) || today);
    setTimeout(() => newInputRef.current?.focus(), 60);
  }
  function commitAdd() {
    const title = newTitle.trim();
    if (!title || !adding) { setAdding(null); return; }
    const milestones = tasks.filter(isMilestone);
    if (adding.kind === 'milestone') {
      void addTask({ title, due_date: newDate || null, kind: 'milestone', sort: nextSort(milestones) });
    } else {
      void addTask({
        title, due_date: phaseEnd(adding.phase) || null, category: 'ovrigt', kind: 'check',
        sort: nextSort(tasks.filter((r) => isCheck(r) && areaOf(r) === 'ovrigt')),
      });
    }
    setAdding(null);
  }

  /* ── Starting over ───────────────────────────────────────────────────── */
  const allChecks = timelineTasks.filter(isCheck);
  const allMilestones = timelineTasks.filter(isMilestone);
  const lostText = (own: number, ticks: number, ownOne: string, ownMany: string) =>
    [own > 0 && tn(own, ownOne, ownMany), ticks > 0 && tn(ticks, 'ét flueben', '{n} flueben')].filter(Boolean).join(t(' og '));
  const lostChecks = lostText(allChecks.filter((r) => phaseOf(r.title) === null).length, allChecks.filter((r) => r.done).length,
    'jeres ene egne punkt', 'jeres {n} egne punkter');
  const lostMilestones = lostText(allMilestones.filter((m) => !DEFAULT_MILESTONE_TITLES.has(m.title)).length,
    allMilestones.filter((m) => m.done).length, 'jeres egen milepæl', 'jeres {n} egne milepæle');
  const resetOptions = [
    ...(weddingISO ? [{
      id: 'milestones', itemLabel: 'Gendan standardplanen…', confirmTitle: 'Gendan standardplanen?',
      detail: lostMilestones
        ? t('Milepælene lægges ud fra jeres dato igen, og {lost} forsvinder.', { lost: lostMilestones })
        : t('Milepælene lægges ud fra jeres dato igen.'),
      onReset: () => void (async () => {
        await clearTasks('milestone');
        await seedTasks(defaultMilestones(weddingISO));
      })(),
    }] : []),
    {
      id: 'checklist', itemLabel: 'Gendan standardlisten…', confirmTitle: 'Gendan standardlisten?',
      detail: lostChecks
        ? t('Listen starter forfra med standardpunkterne, og {lost} forsvinder.', { lost: lostChecks })
        : t('Listen starter forfra med standardpunkterne.'),
      onReset: () => void (async () => {
        // Claim the seed slot first, or the auto-seed would double the list.
        if (event) seeding.add(event.id);
        const cleared = await clearTasks('check');
        if (cleared) { setSeedError(cleared); return; }
        if (event) localStorage.setItem(topUpKey(event.id), '1');
        setSeedError(await seedTasks(defaultChecklist()));
      })(),
    },
  ];

  /* ── Search, across the whole plan ───────────────────────────────────── */
  const q = query.trim().toLowerCase();
  const results = q ? tasks.filter((r) => t(r.title).toLowerCase().includes(q)) : [];

  const openTask = tasks.find((r) => r.id === openId) ?? null;

  /* ── The periods down the page ───────────────────────────────────────
     An earlier one with nothing in it has nothing to say and is left out. */
  const periods = PERIODS.map((phases) => {
    const parts = phases.map((p) => groups.find((g) => g.phase === p)!);
    const total = parts.reduce((n, g) => n + g.total, 0);
    const done = parts.reduce((n, g) => n + g.done, 0);
    const time = phases.includes(now) ? 'now' as const
      : order.indexOf(phases[phases.length - 1]) < nowAt ? 'past' as const : 'ahead' as const;
    const span = weddingISO
      ? { from: phaseWindow(phases[0], weddingISO).from, to: phaseWindow(phases[phases.length - 1], weddingISO).to }
      : null;
    return { id: phases[0], parts, total, done, time, span };
  }).filter((p) => p.time !== 'past' || p.total > 0);

  /* A late milestone is the most important thing on the screen, so it also
     shows where they are now, unless its own period is open right above. */
  const lateMilestones = periods
    .filter((p) => p.time === 'past' && !openPeriods.has(p.id))
    .flatMap((p) => p.parts.flatMap((g) => g.milestones.filter((r) => !r.done)));

  const partDates = (p: Phase) => {
    if (!weddingISO) return null;
    if (p === 'dagen') return longDate(weddingISO);
    const w = phaseWindow(p, weddingISO);
    return `${fmt(w.from, false)} – ${fmt(w.to, false)}`;
  };

  /* One phase, opened: its milestones, its to-dos, and adding to it. Where
     they are now it opens on a handful of to-dos rather than all of them. */
  function phaseBody(g: PhaseGroup<Row>) {
    const milestones = g.milestones.filter((r) => !r.done);
    const todos = g.todos.filter((r) => !r.done);
    const doneRows = [...g.milestones, ...g.todos].filter((r) => r.done);
    const folds = g.phase === now && todos.length > START + 1;
    const rank = (r: Row) => { const p = priorityOf(r); return p ? PRIORITY_RANK[p] : 2; };
    const first = folds && !showAll ? [...todos].sort((a, b) => rank(a) - rank(b)).slice(0, START) : null;
    const byArea = first ? [] : CHECKLIST_AREAS
      .map((a) => ({ area: a, rows: todos.filter((r) => areaOf(r) === a.id) }))
      .filter((x) => x.rows.length > 0);
    const addingHere = adding?.phase === g.phase ? adding : null;
    const doneOpen = showDone.has(g.phase);
    // Hanken set inline: the theme sets every heading in Cormorant, and a 13px
    // label in the display face read as a smudge.
    const label = 'flex items-center gap-2 text-[13px] font-semibold text-ink-soft';

    return (
      <>
        {milestones.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {milestones.map((r) => <TaskRow key={r.id} {...rowProps(r)} />)}
          </div>
        )}

        {g.phase === 'dagen' && (
          <button type="button" onClick={onOpenDay}
            className="group mt-3 flex w-full items-center justify-between gap-3 rounded-[18px] bg-shell px-5 py-4 text-left transition-colors hover:bg-line/50 cursor-pointer">
            <span className="flex items-center gap-3">
              <PartyPopper size={18} className="text-sage-strong" aria-hidden />
              <span>
                <span className="block text-[15px] font-semibold text-ink">{t('Programmet for dagen')}</span>
                <span className="block text-[13px] text-muted">{t('Minut for minut, fra ankomst til natmad')}</span>
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        )}

        {first && (
          <section className="mt-6">
            <h4 style={{ fontFamily: 'var(--font-sans)' }} className={label}>{t('Start her')}</h4>
            <div className="mt-1 divide-y divide-line/70">
              {first.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
            </div>
          </section>
        )}

        {byArea.length > 0 && (
          <div className="mt-6 flex flex-col gap-6">
            {byArea.map(({ area, rows }) => (
              <section key={area.id}>
                <h4 style={{ fontFamily: 'var(--font-sans)' }} className={label}>
                  <area.Icon size={14} strokeWidth={2} className="text-sage-strong" aria-hidden />
                  {t(area.label)}
                </h4>
                <div className="mt-1 divide-y divide-line/70">
                  {rows.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
                </div>
              </section>
            ))}
          </div>
        )}

        {milestones.length === 0 && todos.length === 0 && g.phase !== 'dagen' && (
          <p className="mt-4 rounded-[18px] bg-shell px-5 py-5 text-center font-serif text-lg text-ink">
            {g.total === 0 ? t('Intet her endnu.') : t('Alt her er klaret.')}
          </p>
        )}

        <AnimatePresence>
          {addingHere && (
            <div className="mt-4">
              <AddRow
                inputRef={newInputRef} title={newTitle}
                placeholder={addingHere.kind === 'milestone' ? 'Milepælens navn…' : 'Hvad skal huskes?'}
                onTitleChange={setNewTitle}
                {...(addingHere.kind === 'milestone' ? { date: newDate, onDateChange: setNewDate } : {})}
                onSave={commitAdd} onCancel={() => setAdding(null)}
              />
            </div>
          )}
        </AnimatePresence>
        {!addingHere && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            {folds && (
              <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
                className="inline-flex items-center gap-1.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:text-sage-strong cursor-pointer">
                {showAll ? t('Vis færre') : t('Vis alle {n} opgaver', { n: todos.length })}
                <ChevronDown size={14} className={cn('transition-transform', showAll && 'rotate-180')} aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => openAdd('todo', g.phase)}
              className="inline-flex items-center gap-2 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
              <Plus size={14} aria-hidden /> {t('Tilføj opgave')}
            </button>
            <button type="button" onClick={() => openAdd('milestone', g.phase)}
              className="inline-flex items-center gap-2 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
              <Plus size={14} aria-hidden /> {t('Tilføj milepæl')}
            </button>
          </div>
        )}

        {doneRows.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setShowDone((s) => toggleIn(s, g.phase))} aria-expanded={doneOpen}
              className="inline-flex items-center gap-2 py-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
              <span className="flex size-5 items-center justify-center rounded-full bg-sage-tint text-sage-strong">
                <Check size={11} strokeWidth={3} aria-hidden />
              </span>
              {tn(doneRows.length, 'Én ting er klaret her', '{n} ting er klaret her')}
              <ChevronDown size={14} className={cn('transition-transform', doneOpen && 'rotate-180')} aria-hidden />
            </button>
            {doneOpen && (
              <div className="mt-1 divide-y divide-line/70">
                {doneRows.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6 rounded-[22px] border border-line bg-card px-4 py-6 sm:rounded-[28px] sm:px-8 sm:py-8"
    >
      {moved && (
        <div role="status" className="flex flex-col gap-3 rounded-[18px] bg-sage-tint/50 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
          <CalendarClock size={20} className="hidden shrink-0 text-sage-strong sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg leading-snug text-ink">{t('Brylluppet er flyttet til {date}', { date: longDate(moved.to) })}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              {t('Tidslinjen er lagt ud fra {date}. Flyt den med, så der stadig er lige så lang tid til hver ting.', { date: longDate(moved.from) })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={followWedding}
              className="h-9 whitespace-nowrap rounded-full bg-ink px-4 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer">
              {t('Flyt tidslinjen')}
            </button>
            <button type="button" onClick={() => weddingRow && void updateTask(weddingRow.id, { due_date: moved.to })}
              className="h-9 whitespace-nowrap rounded-full border border-line bg-card px-4 text-[0.82rem] font-semibold text-ink transition-colors hover:bg-shell cursor-pointer">
              {t('Behold datoerne')}
            </button>
          </div>
        </div>
      )}

      {!weddingISO && (
        <div className="flex flex-col gap-3 rounded-[18px] bg-shell px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[14px] text-ink">{t('Sæt jeres dato, så får hver fase sine datoer, og milepælene lægges ud.')}</p>
          <a href="/settings" className="inline-flex h-9 w-fit shrink-0 items-center rounded-full bg-ink px-4 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90">
            {t('Sæt datoen')}
          </a>
        </div>
      )}

      {seedError && (
        <p role="alert" className="rounded-[14px] bg-terracotta-tint px-4 py-3 text-[13px] text-terracotta">
          {t('Kunne ikke hente standardlisten')}: {seedError}
        </p>
      )}

      {/* ── Search, and the tab's other actions ─────────────────────────── */}
      <div className="flex items-center gap-2">
        {searching ? (
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-shell px-3.5">
            <Search size={14} className="shrink-0 text-muted" aria-hidden />
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearching(false); } }}
              placeholder={t('Søg i hele planen')} aria-label={t('Søg i hele planen')}
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none sm:text-sm"
            />
            <button type="button" onClick={() => { setQuery(''); setSearching(false); }} aria-label={t('Luk søgning')}
              className="text-muted hover:text-ink cursor-pointer"><X size={14} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setSearching(true)}
            className="inline-flex h-9 items-center gap-2 rounded-full px-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
            <Search size={14} aria-hidden /> {t('Søg i hele planen')}
          </button>
        )}
        <div className="ml-auto"><ResetControl options={resetOptions} /></div>
      </div>

      {q ? (
        /* ── Search results, flat, each with its phase ─────────────────── */
        <div>
          <p className="text-[13px] text-muted">{tn(results.length, 'Ét punkt', '{n} punkter')}</p>
          <div className="mt-2 divide-y divide-line/70">
            {results.map((r) => (
              <div key={r.id}><TaskRow variant="list" {...rowProps(r)} task={toDisplay(r, true)} /></div>
            ))}
          </div>
        </div>
      ) : (
        /* ── The periods ─────────────────────────────────────────────────
           Time runs down a rail on the left: a year where one starts, a dot
           per period. --rail is how far the content sits from the rail's
           left edge; the dots and the years pull back out by the same. */
        <ol
          aria-label={t('Planens faser')}
          className="ml-[5px] border-l border-line pl-[calc(var(--rail)-6px)] [--rail:22px] sm:[--rail:32px]"
        >
          {periods.map((p, i) => {
            const isOpen = openPeriods.has(p.id);
            const left = p.total - p.done;
            const year = p.span?.from.slice(0, 4);
            const newYear = year && year !== periods[i - 1]?.span?.from.slice(0, 4);
            const named = !weddingISO || !MONTH_PHASES.has(p.id);
            return (
              <React.Fragment key={p.id}>
                {newYear && (
                  <li className={cn('ml-[calc(var(--rail)*-1)] pb-1', i > 0 && 'pt-5')}>
                    <span className="inline-block bg-card py-1 pr-3 font-serif text-[1.3rem] leading-none text-ink">{year}</span>
                  </li>
                )}
                <li className={cn(isOpen && 'pb-6')}>
                  <h2 style={{ fontFamily: 'var(--font-sans)' }} className="relative">
                    <span aria-hidden className={cn(
                      'absolute left-[calc(var(--rail)*-1)] top-1/2 size-[11px] -translate-y-1/2 rounded-full border-2',
                      p.time === 'now' ? 'border-sage-strong bg-sage-strong ring-4 ring-sage-tint'
                        : p.time === 'past' ? (left > 0 ? 'border-terracotta bg-card' : 'border-sage-strong bg-sage-strong')
                        : 'border-line bg-card',
                    )} />
                    <button type="button" onClick={() => togglePeriod(p.id)} aria-expanded={isOpen}
                      className="group flex w-full items-center gap-x-3 py-2 text-left cursor-pointer">
                      <span className={cn(
                        'font-serif leading-tight text-ink transition-[font-size] duration-200',
                        isOpen ? 'text-[1.7rem] sm:text-[2.1rem]' : 'text-[1.3rem] sm:text-[1.45rem]',
                      )}>
                        {phaseName(p.id, 'long')}
                      </span>
                      {p.time === 'now' && (
                        <span className="rounded-full bg-sage-tint px-2.5 py-0.5 text-[12px] font-semibold text-success">{t('Nu')}</span>
                      )}
                      {named && p.span && !isOpen && (
                        <span className="hidden text-[13px] text-muted sm:inline">{fmt(p.span.from, false)} – {fmt(p.span.to, false)}</span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-2 text-[13px] font-medium tabular-nums">
                        {!isOpen && (
                          p.time === 'past'
                            ? left > 0
                              ? <span className="text-clay-ink">{tn(left, 'én tilbage', '{n} tilbage')}</span>
                              : <span className="text-success">{t('Klaret')}</span>
                            : <span className="text-muted">
                                {p.total === 0 ? '–'
                                  : p.done > 0 ? t('{done} af {total} klaret', { done: p.done, total: p.total })
                                  : tn(p.total, 'Én ting', '{n} ting')}
                              </span>
                        )}
                        <ChevronDown size={16} className={cn('text-muted transition-transform group-hover:text-ink', isOpen && 'rotate-180')} aria-hidden />
                      </span>
                    </button>
                  </h2>

                  {isOpen && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
                        {p.span && <span>{fmt(p.span.from)} – {fmt(p.span.to)}</span>}
                        {p.total > 0 && <span>{p.span && '· '}{t('{done} af {total} klaret', { done: p.done, total: p.total })}</span>}
                      </p>

                      {p.time === 'now' && lateMilestones.length > 0 && (
                        <div className="mt-4 rounded-[18px] border border-terracotta/20 bg-terracotta-wash px-4 py-3.5 sm:px-5">
                          <p className="text-[13px] font-semibold text-clay-ink">{t('Fra tidligere faser')}</p>
                          <div className="mt-1 divide-y divide-terracotta/20">
                            {lateMilestones.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
                          </div>
                        </div>
                      )}

                      {p.parts.length === 1 ? phaseBody(p.parts[0]) : p.parts.map((g) => (
                        <section key={g.phase} className="mt-7 first-of-type:mt-5">
                          <h3 className="flex flex-wrap items-baseline gap-x-2.5 font-serif text-[1.3rem] leading-tight text-ink">
                            {t(PART_TITLE[g.phase] ?? PHASE_TITLE[g.phase])}
                            {g.phase === now && (
                              <span style={{ fontFamily: 'var(--font-sans)' }} className="self-center rounded-full bg-sage-tint px-2 py-0.5 text-[11px] font-semibold text-success">{t('Nu')}</span>
                            )}
                            <span style={{ fontFamily: 'var(--font-sans)' }} className="text-[13px] text-muted">{partDates(g.phase)}</span>
                          </h3>
                          {phaseBody(g)}
                        </section>
                      ))}
                    </motion.div>
                  )}
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      )}

      <AnimatePresence>
        {openTask && (
          <TaskDialog
            key={openTask.id}
            task={openTask}
            couple={couple}
            deleteLabel={isMilestone(openTask) ? 'Slet milepæl' : 'Slet punkt'}
            onClose={() => setOpenId(null)}
            onSave={(patch) => {
              void updateTask(openTask.id, patch);
              if (patch.done === true) onCelebrate(openTask.title);
            }}
            onDelete={() => { setOpenId(null); removeTask(openTask.id, openTask.title, () => deleteTask(openTask.id)); }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

