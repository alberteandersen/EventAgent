import * as React from 'react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Plus, Search, X, CalendarClock } from 'lucide-react';
import { timeline as MOCK_TIMELINE } from '../../data';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { showNotice } from '../../notice';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { DisplayTask } from './TaskRow';
import TimelineSpine, { type RowActions } from './TimelineSpine';
import TaskDialog from './TaskDialog';
import AddRow from './AddRow';
import {
  isMilestone, isCheck, onTimeline, areaOf, nextSort, buildTimelineBands, todayISO, daysDiff, shiftPlan,
  assigneeInitials, assigneeName, priorityOf,
  type Filter, FILTER_LABELS, CHECKLIST_AREAS,
} from './shared';

// The mock timeline is a proven default plan anchored on its own wedding day.
// We re-anchor every milestone onto the couple's real date, preserving the
// relative lead times (book venue ~12 months out, invitations ~3 weeks, …).
const MOCK_WED_MS = new Date(MOCK_TIMELINE[MOCK_TIMELINE.length - 1].dateISO).getTime();


/**
 * Which checklist area each milestone belongs to, so it heads that area's block
 * on the Tjekliste tab — the big decision first, the small print under it.
 *
 * "Jeres dag" is deliberately absent: it keeps the 'wedding_day' sentinel that
 * drives the "Dagen" status, and it is the wedding itself rather than a task in
 * an area. `category` can only carry one of the two meanings, and this is the
 * one row where the sentinel wins. See migration 0023 for the backfill.
 */
const MILESTONE_AREA: Record<string, string> = {
  'Sæt budget & gæsteliste': 'okonomi',
  'Book venue': 'venue',
  'Save-the-dates': 'papir',
  'Book fotograf': 'foto',
  'Brudekjole & jakkesæt': 'stil',
  'Florist & dekoration': 'stil',
  'Musik / DJ / band': 'dagen',
  'Kage & dessert': 'mad',
  'Vielsesattest & jura': 'jura',
  'Endelig prøvepasning': 'stil',
  'Bordplan & menu låst': 'gaester',
  'Invitationer sendt': 'papir',
  'Koordinering med leverandører': 'optil',
};

export function defaultMilestones(weddingISO: string) {
  const wed = new Date(weddingISO).getTime();
  return MOCK_TIMELINE.map((t, i) => {
    const offset = new Date(t.dateISO).getTime() - MOCK_WED_MS;
    return {
      title: t.title,
      due_date: new Date(wed + offset).toISOString().slice(0, 10),
      category: i === MOCK_TIMELINE.length - 1 ? 'wedding_day' : MILESTONE_AREA[t.title] ?? null,
      kind: 'milestone' as const,
      done: false,
      sort: i,
    };
  });
}

export default function TimelineTab({ onCelebrate }: { onCelebrate: (title: string) => void }) {
  const { t, tn, lang } = useLang();
  const locale = lang === 'en' ? 'en-US' : 'da-DK';
  const monthLabel = (monthISO: string) =>
    new Date(`${monthISO}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const longDate = (dateISO: string) =>
    new Date(`${dateISO}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const { couple, timelineTasks: allTasks, addTask, updateTask, deleteTask, seedTasks, clearTasks } = useWedding();
  // A task removed a moment ago stays off the timeline while Fortryd is offered.
  const timelineTasks = useWithoutPending(allTasks);
  const removeTask = useRemoveWithUndo();
  const today = todayISO();
  const daysUntil = couple.dateISO ? Math.max(0, daysDiff(couple.dateISO, today)) : 0;

  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const [addingAfter, setAddingAfter] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmReset, setConfirmReset] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  /* The plan was laid out from the date the couple had then. When "Jeres
     dag" and their date part ways, they have moved the wedding (in Settings)
     and every date below still counts down to the old one. */
  const weddingRow = timelineTasks.find((r) => r.category === 'wedding_day');
  const moved = couple.dateISO && weddingRow?.due_date && weddingRow.due_date !== couple.dateISO
    ? { from: weddingRow.due_date, to: couple.dateISO }
    : null;
  const shifts = moved ? shiftPlan(timelineTasks, moved.from, moved.to) : [];

  function followWedding() {
    for (const s of shifts) void updateTask(s.id, { due_date: s.due_date });
    const others = shifts.filter((s) => s.id !== weddingRow?.id).length;
    showNotice(t('Tidslinjen er flyttet'), tn(others, 'Én dato fulgte med.', '{n} datoer fulgte med.'));
  }

  function keepDates() {
    if (weddingRow && moved) void updateTask(weddingRow.id, { due_date: moved.to });
  }

  // The milestones, plus any checklist item the couple has dated — giving a
  // check a date is how you put it in the calendar.
  const rows = timelineTasks.filter(onTimeline);
  const milestones = timelineTasks.filter(isMilestone);

  // Dated milestones first (chronologically), undated ones last by sort — an
  // undated row must never be pinned to the wedding date.
  const tasks: (DisplayTask & { visiting: boolean; overdue: boolean })[] = rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      dateISO: r.due_date,
      done: r.done,
      weddingDay: r.category === 'wedding_day',
      // A check keeps its area icon here, so the milestones still read as the
      // spine rather than the two blurring into one list.
      Icon: isCheck(r) ? CHECKLIST_AREAS.find((a) => a.id === areaOf(r))?.Icon : undefined,
      visiting: isCheck(r),
      priority: priorityOf(r),
      assigneeInitials: assigneeInitials(r.assignee, couple),
      assigneeName: r.assignee ? t(assigneeName(r.assignee, couple) ?? '') : null,
      hasNotes: !!r.notes?.trim(),
      // Read on the spine's day marker, where there is no room for a word.
      overdue: !r.done && r.due_date != null && r.category !== 'wedding_day' && r.due_date < today,
    }))
    .sort((a, b) => {
      if (a.dateISO && b.dateISO) return a.dateISO.localeCompare(b.dateISO);
      if (a.dateISO) return -1;
      if (b.dateISO) return 1;
      return 0;
    });

  const done = tasks.filter((x) => x.done).length;
  const counts: Record<Filter, number> = {
    alle: tasks.length,
    kommende: tasks.length - done,
    færdige: done,
  };

  const q = query.trim().toLowerCase();
  const visible = tasks.filter((x) => {
    if (filter === 'kommende' && x.done) return false;
    if (filter === 'færdige' && !x.done) return false;
    if (q && !x.title.toLowerCase().includes(q)) return false;
    return true;
  });

  // Only a dated task has a place on the spine; the rest wait in their own
  // tray. Bands are built from what is *visible*, so filtering to "færdige"
  // shows the months those tasks fall in, not an outline of the whole plan.
  const dated = visible.filter((x) => x.dateISO !== null);
  const undated = visible.filter((x) => x.dateISO === null);
  const bands = buildTimelineBands(dated, today);

  /* The timeline and the checklist share these rows, so what the menu offers
     depends on where a row lives: a visiting check comes off the spine by
     losing its date, a milestone is deleted outright. */
  function rowActions(task: (typeof tasks)[number]): RowActions {
    const onOpen = () => { setMenuId(null); setOpenId(task.id); };
    return task.visiting
      ? { onOpen, onClearDate: () => { setMenuId(null); void updateTask(task.id, { due_date: null }); } }
      : {
          onOpen,
          onDelete: () => { setMenuId(null); removeTask(task.id, task.title, () => deleteTask(task.id)); },
          onInsertAfter: () => openAdd(task.id),
        };
  }
  const openTask = rows.find((r) => r.id === openId) ?? null;

  function handleToggle(task: DisplayTask) {
    const nowDone = !task.done;
    void updateTask(task.id, { done: nowDone });
    if (nowDone) onCelebrate(task.title);
  }

  function openAdd(afterId: string) {
    setMenuId(null);
    setAddingAfter(afterId);
    setNewTitle('');
    setNewDate(afterId === 'bottom'
      ? (couple.dateISO ?? new Date().toISOString().slice(0, 10))
      : new Date().toISOString().slice(0, 10));
    setTimeout(() => newInputRef.current?.focus(), 60);
  }

  function commitAdd() {
    if (!newTitle.trim()) { setAddingAfter(null); return; }
    // nextSort over the milestones only — the checklist runs its own 0-204
    // series, and a new milestone must not inherit a number from it.
    void addTask({ title: newTitle.trim(), due_date: newDate, kind: 'milestone', sort: nextSort(milestones) });
    setAddingAfter(null);
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    void (async () => {
      // Scoped to milestones — the checklist on the other tab must survive.
      await clearTasks('milestone');
      if (couple.dateISO) await seedTasks(defaultMilestones(couple.dateISO));
    })();
    setConfirmReset(false);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[22px] border border-line bg-card p-4 sm:rounded-[28px] sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted">
          {couple.dateISO
            ? t('{days} dage til dagen · alt med en dato frem til brylluppet.', { days: daysUntil })
            : t('Alt med en dato frem til brylluppet.')}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {tasks.length > 0 && (
            <p className="shrink-0 text-sm font-bold text-sage">
              {t('{done} af {total} klaret', { done, total: tasks.length })}
            </p>
          )}
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer',
              confirmReset ? 'bg-terracotta text-canvas' : 'border border-line bg-card text-ink',
            )}
          >
            <RotateCcw size={13} />
            {confirmReset ? t('Sikker?') : t('Nulstil')}
          </button>
          <button
            type="button"
            onClick={() => openAdd('bottom')}
            className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-canvas cursor-pointer"
          >
            <Plus size={13} />
            {t('Tilføj milepæl')}
          </button>
        </div>
      </div>

      {moved && (
        <div role="status" className="flex flex-col gap-3 rounded-[18px] border border-sage-tint bg-sage-tint/40 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
          <CalendarClock size={20} className="hidden shrink-0 text-sage-strong sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg leading-snug text-ink">
              {t('Brylluppet er flyttet til {date}', { date: longDate(moved.to) })}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              {t('Tidslinjen er lagt ud fra {date}. Flyt den med, så der stadig er lige så lang tid til hver ting.', { date: longDate(moved.from) })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={followWedding}
              className="h-9 whitespace-nowrap rounded-full bg-ink px-4 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer">
              {t('Flyt tidslinjen')}
            </button>
            <button type="button" onClick={keepDates}
              className="h-9 whitespace-nowrap rounded-full border border-line bg-card px-4 text-[0.82rem] font-semibold text-ink transition-colors hover:bg-shell cursor-pointer">
              {t('Behold datoerne')}
            </button>
          </div>
        </div>
      )}

      {/* Search + filters, once there is something to search */}
      {tasks.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 w-full items-center gap-2.5 rounded-[14px] border border-line bg-shell px-4 sm:w-[260px]">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Søg i milepæle')}
            aria-label={t('Søg i milepæle')}
            className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Ryd søgning')}
              className="text-faint hover:text-ink cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
        {(['alle', 'kommende', 'færdige'] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer',
                active
                  ? 'bg-ink text-shell'
                  : 'border border-line bg-shell text-muted hover:text-ink',
              )}
            >
              {t(FILTER_LABELS[f])}
              <span className={active ? 'text-sage-tint' : 'text-faint'}>{counts[f]}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* The spine, time runs downward, one month band at a time. */}
      {tasks.length === 0 && !couple.dateISO ? (
        /* The milestones are laid out backwards from the wedding day, so
           without one there is nothing to lay out yet. Say that, and where
           the date goes, instead of inviting them to type the plan by hand. */
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-shell px-5 py-10 text-center">
          <CalendarClock size={22} className="text-sage-strong" aria-hidden />
          <p className="font-serif text-xl text-ink">{t('Tidslinjen bygges ud fra jeres dato')}</p>
          <p className="max-w-md text-[13px] leading-relaxed text-muted">
            {t('Sæt datoen, så lægger vi 14 milepæle ud for jer, fra budget og venue til bordplan og invitationer.')}
          </p>
          <a href="/settings"
            className="mt-1 inline-flex h-9 items-center rounded-full bg-ink px-4 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90">
            {t('Sæt datoen')}
          </a>
        </div>
      ) : dated.length === 0 && undated.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-shell px-5 py-10 text-center">
          <p className="font-serif text-lg text-ink">
            {tasks.length === 0
              ? t('Ingen milepæle endnu, tilføj jeres første.')
              : filter === 'færdige' ? t('Ingen færdige milepæle endnu.')
              : filter === 'kommende' ? t('Alt er klaret. I er foran planen.')
              : t('Ingen milepæle matcher din søgning.')}
          </p>
        </div>
      ) : (
        <TimelineSpine
          bands={bands}
          undated={undated}
          monthLabel={monthLabel}
          menuId={menuId}
          onMenu={(id) => setMenuId((m) => (m === id ? null : id))}
          onCloseMenu={() => setMenuId(null)}
          onToggle={handleToggle}
          onDateChange={(id, d) => void updateTask(id, { due_date: d })}
          rowActions={rowActions}
          renderAddRow={(id) => (
            <AnimatePresence>
              {addingAfter === id && (
                <AddRow inputRef={newInputRef} title={newTitle} date={newDate}
                  placeholder="Milepælens navn…"
                  onTitleChange={setNewTitle} onDateChange={setNewDate}
                  onSave={commitAdd} onCancel={() => setAddingAfter(null)} />
              )}
            </AnimatePresence>
          )}
        />
      )}

      <AnimatePresence>
        {addingAfter === 'bottom' && (
          <AddRow inputRef={newInputRef} title={newTitle} date={newDate}
            placeholder="Milepælens navn…"
            onTitleChange={setNewTitle} onDateChange={setNewDate}
            onSave={commitAdd} onCancel={() => setAddingAfter(null)} />
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => openAdd('bottom')}
        className="flex w-full items-center gap-4 rounded-[18px] border border-dashed border-line bg-transparent px-5 py-4 text-left text-sm font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink cursor-pointer"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line-strong">
          <Plus size={14} />
        </span>
        {t('Tilføj milepæl')}
      </button>

      <AnimatePresence>
        {openTask && (
          <TaskDialog
            key={openTask.id}
            task={openTask}
            couple={couple}
            deleteLabel="Slet milepæl"
            onClose={() => setOpenId(null)}
            onSave={(patch) => {
              void updateTask(openTask.id, patch);
              if (patch.done === true) onCelebrate(openTask.title);
            }}
            // A dated checklist item is only visiting: deleting it here would
            // take it off the checklist too.
            onDelete={isMilestone(openTask) ? () => { setOpenId(null); removeTask(openTask.id, openTask.title, () => deleteTask(openTask.id)); } : undefined}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
