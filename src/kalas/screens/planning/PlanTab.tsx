import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, CalendarClock, Check, ChevronDown, PartyPopper, Plus, Search, X } from 'lucide-react';
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
import { defaultChecklist, phaseLabel, phaseOf, PHASES, type Phase } from './checklist-data';
import { phaseNow, phaseOfRow, phaseWindow, planByPhase, type PhaseGroup } from './phases';
import {
  CHECKLIST_AREAS, MILESTONE_ACTIONS, areaOf, assigneeInitials, assigneeName, daysDiff,
  isCheck, isMilestone, nextSort, priorityOf, shiftPlan, todayISO, topUpKey,
} from './shared';

/** The phase as a heading, and as a step on the bar. Danish source strings. */
const PHASE_TITLE: Record<Phase, string> = {
  '12-18': '12–18 måneder før', '9-12': '9–12 måneder før', '6-9': '6–9 måneder før',
  '3-6': '3–6 måneder før', '1-3': '1–3 måneder før', maaned: 'Den sidste måned',
  uge: 'Ugen før', dagen: 'På dagen', efter: 'Efter brylluppet',
};
const PHASE_STEP: Record<Phase, string> = {
  '12-18': '12–18 mdr.', '9-12': '9–12 mdr.', '6-9': '6–9 mdr.', '3-6': '3–6 mdr.', '1-3': '1–3 mdr.',
  maaned: 'Sidste måned', uge: 'Ugen før', dagen: 'Dagen', efter: 'Efter',
};

type Row = TimelineTaskRow;

/**
 * The plan, one phase at a time: a bar of the phases along the top, opened on
 * the one the couple is in, and under it only that phase's milestones and
 * to-dos. Fourteen milestones and two hundred to-dos, split into two tabs,
 * read as two spreadsheets; this reads as the next few months.
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

  const [selected, setSelected] = useState<Phase>(now);
  const [direction, setDirection] = useState(1);
  const [showDone, setShowDone] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<'todo' | 'milestone' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);
  const stepRefs = useRef(new Map<Phase, HTMLButtonElement>());

  const group = groups.find((g) => g.phase === selected)!;
  const at = order.indexOf(selected);
  const nowAt = order.indexOf(now);
  const fmt = (iso: string, withYear = true) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

  function select(next: Phase) {
    const i = order.indexOf(next);
    setDirection(i >= at ? 1 : -1);
    setSelected(next);
    setShowDone(false);
    setAdding(null);
    setMenuId(null);
  }

  // Keep the chosen step in view on a phone, where the bar scrolls sideways.
  useEffect(() => {
    stepRefs.current.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [selected, reduce]);

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
      phase: p ? phaseLabel(p) : null,
    };
  };

  function toggle(r: Row) {
    const nowDone = !r.done;
    void updateTask(r.id, { done: nowDone });
    if (!nowDone) return;
    // The last open thing in the phase: the whole phase is done.
    const g = groups.find((x) => x.phase === phaseOfRow(r, weddingISO, now));
    if (g && g.total > 1 && g.done + 1 === g.total) onCelebrate(t('{phase} er klaret', { phase: t(PHASE_TITLE[g.phase]) }));
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

  /* ── Adding, into the phase on screen ─────────────────────────────────
     With a date, a new to-do is due by the end of the phase it was added in,
     which is also what keeps it in that phase. */
  const phaseEnd = weddingISO ? phaseWindow(selected, weddingISO).to : '';
  function openAdd(kind: 'todo' | 'milestone') {
    setAdding(kind);
    setNewTitle('');
    setNewDate(phaseEnd || today);
    setTimeout(() => newInputRef.current?.focus(), 60);
  }
  function commitAdd() {
    const title = newTitle.trim();
    if (!title) { setAdding(null); return; }
    const milestones = tasks.filter(isMilestone);
    if (adding === 'milestone') {
      void addTask({ title, due_date: newDate || null, kind: 'milestone', sort: nextSort(milestones) });
    } else {
      void addTask({
        title, due_date: phaseEnd || null, category: 'ovrigt', kind: 'check',
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
  const open = (g: PhaseGroup<Row>) => ({ milestones: g.milestones.filter((r) => !r.done), todos: g.todos.filter((r) => !r.done) });
  const shown = open(group);
  const doneRows = [...group.milestones, ...group.todos].filter((r) => r.done);
  const byArea = CHECKLIST_AREAS
    .map((a) => ({ area: a, rows: shown.todos.filter((r) => areaOf(r) === a.id) }))
    .filter((x) => x.rows.length > 0);

  /* Where the couple is now, what earlier phases left behind: a late
     milestone is the most important thing on the screen, and it must not
     hide in a phase they have already scrolled past. */
  const earlier = selected === now ? groups.filter((g) => order.indexOf(g.phase) < nowAt) : [];
  const lateMilestones = earlier.flatMap((g) => g.milestones.filter((r) => !r.done));
  const leftovers = earlier
    .map((g) => ({ phase: g.phase, left: g.todos.filter((r) => !r.done).length }))
    .filter((x) => x.left > 0);

  // Where this phase stands, in a few words under its heading.
  const left = group.total - group.done;
  const standing = selected === now ? { text: t('Her er I nu'), tone: 'now' as const }
    : at < nowAt ? (left > 0 ? { text: tn(left, 'Én ting mangler', '{n} ting mangler'), tone: 'late' as const } : { text: t('Klaret'), tone: 'done' as const })
    : weddingISO ? { text: tn(Math.max(1, Math.round(daysDiff(phaseWindow(selected, weddingISO).from, today) / 30)), 'Starter om en måned', 'Starter om {n} måneder'), tone: 'ahead' as const }
    : null;

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

      {/* ── The phases ─────────────────────────────────────────────────────
          Time runs left to right, the couple's phase marked, each step with
          how much of it is done. Arrow keys move along it. */}
      <div className="flex items-start gap-2">
        <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <ol
            aria-label={t('Planens faser')}
            className="flex min-w-max gap-1.5 lg:grid lg:min-w-0 lg:grid-cols-9"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const next = order[Math.min(order.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)))];
              select(next);
              stepRefs.current.get(next)?.focus();
            }}
          >
            {groups.map((g, i) => {
              const isSel = g.phase === selected;
              const isNow = g.phase === now;
              const gLeft = g.total - g.done;
              const pct = g.total ? (g.done / g.total) * 100 : 0;
              return (
                <li key={g.phase}>
                  <button
                    ref={(el) => { if (el) stepRefs.current.set(g.phase, el); }}
                    type="button"
                    onClick={() => select(g.phase)}
                    aria-current={isSel ? 'step' : undefined}
                    tabIndex={isSel ? 0 : -1}
                    className={cn(
                      'flex w-[7.2rem] flex-col items-start rounded-2xl border px-3 pb-2.5 pt-2 text-left transition-colors cursor-pointer lg:w-full',
                      isSel ? 'border-ink bg-ink text-canvas'
                        : isNow ? 'border-ink/60 bg-card text-ink hover:bg-shell'
                        : 'border-line bg-card text-ink hover:bg-shell',
                    )}
                  >
                    <span className="text-[13px] font-semibold leading-tight">{t(PHASE_STEP[g.phase])}</span>
                    <span className={cn(
                      'mt-0.5 text-[11px] font-medium tabular-nums',
                      isSel ? 'text-canvas/75'
                        : isNow ? 'text-sage-strong'
                        : i < nowAt && gLeft > 0 ? 'text-clay-ink'
                        : 'text-muted',
                    )}>
                      {isNow ? t('Nu') : g.total === 0 ? '–'
                        : i < nowAt && gLeft === 0 ? t('Klaret')
                        : i < nowAt ? tn(gLeft, 'én tilbage', '{n} tilbage')
                        : `${g.done}/${g.total}`}
                    </span>
                    <span aria-hidden className={cn('mt-2 h-1 w-full overflow-hidden rounded-full', isSel ? 'bg-canvas/20' : 'bg-line')}>
                      <span className={cn('block h-full rounded-full', isSel ? 'bg-canvas' : 'bg-sage-strong')} style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

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
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={selected}
            custom={direction}
            initial={reduce ? false : { opacity: 0, x: 24 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 * direction }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col"
          >
            {/* The phase */}
            <header>
              <h2 className="font-serif text-[1.8rem] leading-tight text-ink sm:text-[2.2rem]">{t(PHASE_TITLE[selected])}</h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
                {weddingISO && selected !== 'dagen' && (() => {
                  const w = phaseWindow(selected, weddingISO);
                  return <span>{fmt(w.from)} – {fmt(w.to)}</span>;
                })()}
                {weddingISO && selected === 'dagen' && <span>{longDate(weddingISO)}</span>}
                {group.total > 0 && <span>· {t('{done} af {total} klaret', { done: group.done, total: group.total })}</span>}
                {standing && (
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                    standing.tone === 'now' && 'bg-sage-tint text-success',
                    standing.tone === 'late' && 'bg-clay-tint text-clay-ink',
                    standing.tone === 'done' && 'bg-sage-tint text-success',
                    standing.tone === 'ahead' && 'bg-shell text-muted',
                  )}>
                    {standing.text}
                  </span>
                )}
              </p>
            </header>

            {/* What earlier phases left behind, on the phase they are in */}
            {(lateMilestones.length > 0 || leftovers.length > 0) && (
              <div className="mt-6 rounded-[18px] border border-terracotta/20 bg-terracotta-wash px-4 py-3.5 sm:px-5">
                <p className="text-[13px] font-semibold text-clay-ink">{t('Fra tidligere faser')}</p>
                {lateMilestones.length > 0 && (
                  <div className="mt-1 divide-y divide-terracotta/20">
                    {lateMilestones.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
                  </div>
                )}
                {leftovers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {leftovers.map((x) => (
                      <button key={x.phase} type="button" onClick={() => select(x.phase)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-terracotta/20 bg-card px-3 py-1.5 text-[12px] font-semibold text-clay-ink transition-colors hover:border-amber cursor-pointer">
                        {t(PHASE_STEP[x.phase])} · {tn(x.left, 'én opgave', '{n} opgaver')}
                        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* The big moments of the phase */}
            {shown.milestones.length > 0 && (
              <div className="mt-6 flex flex-col gap-3">
                {shown.milestones.map((r) => <TaskRow key={r.id} {...rowProps(r)} />)}
              </div>
            )}

            {selected === 'dagen' && (
              <button type="button" onClick={onOpenDay}
                className="group mt-3 flex items-center justify-between gap-3 rounded-[18px] bg-shell px-5 py-4 text-left transition-colors hover:bg-line/50 cursor-pointer">
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

            {/* The to-dos, by area */}
            {byArea.length > 0 && (
              <div className="mt-8 flex flex-col gap-6">
                {byArea.map(({ area, rows }) => (
                  <section key={area.id}>
                    {/* Hanken set inline: the theme sets every h3 in Cormorant, and
                        a 13px label in the display face read as a smudge. */}
                    <h3 style={{ fontFamily: 'var(--font-sans)' }} className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
                      <area.Icon size={14} strokeWidth={2} className="text-sage-strong" aria-hidden />
                      {t(area.label)}
                    </h3>
                    <div className="mt-1 divide-y divide-line/70">
                      {rows.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {shown.milestones.length === 0 && byArea.length === 0 && (
              <p className="mt-6 rounded-[18px] bg-shell px-5 py-6 text-center font-serif text-lg text-ink">
                {group.total === 0 ? t('Intet i denne fase endnu.') : t('Alt i denne fase er klaret.')}
              </p>
            )}

            {/* Adding, into this phase */}
            <AnimatePresence>
              {adding && (
                <div className="mt-4">
                  <AddRow
                    inputRef={newInputRef} title={newTitle}
                    placeholder={adding === 'milestone' ? 'Milepælens navn…' : 'Hvad skal huskes?'}
                    onTitleChange={setNewTitle}
                    {...(adding === 'milestone' ? { date: newDate, onDateChange: setNewDate } : {})}
                    onSave={commitAdd} onCancel={() => setAdding(null)}
                  />
                </div>
              )}
            </AnimatePresence>
            {!adding && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
                <button type="button" onClick={() => openAdd('todo')}
                  className="inline-flex items-center gap-2 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
                  <Plus size={14} aria-hidden /> {t('Tilføj opgave')}
                </button>
                <button type="button" onClick={() => openAdd('milestone')}
                  className="inline-flex items-center gap-2 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
                  <Plus size={14} aria-hidden /> {t('Tilføj milepæl')}
                </button>
              </div>
            )}

            {/* What is done in this phase, folded away */}
            {doneRows.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer">
                  <span className="flex size-5 items-center justify-center rounded-full bg-sage-tint text-sage-strong">
                    <Check size={11} strokeWidth={3} aria-hidden />
                  </span>
                  {tn(doneRows.length, 'Én ting er klaret i denne fase', '{n} ting er klaret i denne fase')}
                  <ChevronDown size={14} className={cn('transition-transform', showDone && 'rotate-180')} aria-hidden />
                </button>
                {showDone && (
                  <div className="mt-2 divide-y divide-line/70">
                    {doneRows.map((r) => <div key={r.id}><TaskRow variant="list" {...rowProps(r)} /></div>)}
                  </div>
                )}
              </div>
            )}

            {/* On to the next phase, or back */}
            <nav aria-label={t('Faser')} className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
              {at > 0 ? (
                <button type="button" onClick={() => select(order[at - 1])}
                  className="group inline-flex items-center gap-2 text-[14px] font-semibold text-ink-soft transition-colors hover:text-ink cursor-pointer">
                  <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
                  {t(PHASE_TITLE[order[at - 1]])}
                </button>
              ) : <span />}
              {at < order.length - 1 && (
                <button type="button" onClick={() => select(order[at + 1])}
                  className="group inline-flex items-center gap-2 text-right text-[14px] font-semibold text-ink transition-colors cursor-pointer">
                  {t(PHASE_TITLE[order[at + 1]])}
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              )}
            </nav>
          </motion.div>
        </AnimatePresence>
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

