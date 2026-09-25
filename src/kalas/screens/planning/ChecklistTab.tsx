import * as React from 'react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { RotateCcw, Plus, Search, X, ArrowRight, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { ScreenId } from '../../Shell';
import TaskRow, { type DisplayTask } from './TaskRow';
import TaskDialog from './TaskDialog';
import AddRow from './AddRow';
import { defaultChecklist, missingChecklistItems } from './checklist-data';
import {
  isCheck, isMilestone, hasArea, groupByArea, areaLabel, nextSort, areaOf, topUpKey,
  assigneeInitials, assigneeName, priorityOf,
  readOpenAreas, writeOpenAreas,
  type ChecklistArea, type Filter, FILTER_LABELS, CHECKLIST_AREAS,
} from './shared';

/** Event ids whose default list has already been claimed for insertion.
 *  Module scope rather than a ref on purpose: switching to the Tidslinje tab
 *  unmounts this component, and a fresh ref would start a second insert of the
 *  same 200 rows while the first is still in flight. */
const seeding = new Set<string>();

export default function ChecklistTab({ onCelebrate, onNavigate }: {
  onCelebrate: (title: string) => void;
  onNavigate?: (s: ScreenId) => void;
}) {
  const { t } = useLang();
  const { loading, event, couple, timelineTasks, addTask, updateTask, deleteTask, seedTasks, clearTasks } = useWedding();

  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const [addingIn, setAddingIn] = useState<ChecklistArea | null>(null);
  const [newTitle, setNewTitle] = useState('');
  // The task open in TaskDialog. Its title, area, date and the rest are all
  // edited there now, instead of an inline rename that only reached the title.
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAreas, setOpenAreas] = useState<Set<ChecklistArea>>(() => readOpenAreas());
  const reduce = useReducedMotion();
  const newInputRef = useRef<HTMLInputElement>(null);
  const toppedUpRef = useRef(false);

  React.useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  /* `checks` drives seeding and the top-up; `rows` is what the tab renders.
     They must not be the same list, milestones exist before the checklist is
     seeded, so folding them into `checks` would convince the seeder that the
     list is already full. */
  const checks = timelineTasks.filter(isCheck);
  // A task removed a moment ago stays out of `rows` while Fortryd is offered.
  const visible = useWithoutPending(timelineTasks);
  const removeTask = useRemoveWithUndo();
  const rows = [...visible.filter(isCheck), ...visible.filter((r) => isMilestone(r) && hasArea(r))];

  /* The checklist seeds itself from here rather than from Planning's mount
     effect: its items are dateless, so waiting for a wedding date only left
     couples staring at an empty list. Seeding on tab open also keeps ~200 rows
     off half-created onboarding events, which is what that gate was for. */
  React.useEffect(() => {
    if (loading || !event || checks.length > 0 || seeding.has(event.id)) return;
    const id = event.id;
    seeding.add(id);
    void seedTasks(defaultChecklist()).then((err) => {
      if (err) { seeding.delete(id); setError(err); }
    });
  }, [loading, event, checks.length, seedTasks]);

  /* Couples who already have a checklist get any newly added default items,
     once per event. Their ticks and their own items are untouched, which a
     Nulstil would not be. */
  React.useEffect(() => {
    if (loading || toppedUpRef.current || checks.length === 0 || !event) return;
    toppedUpRef.current = true;
    const key = topUpKey(event.id);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const missing = missingChecklistItems(checks);
    if (missing.length > 0) void seedTasks(missing);
  }, [loading, checks, event, seedTasks]);

  const done = rows.filter((r) => r.done).length;
  const counts: Record<Filter, number> = {
    alle: rows.length,
    kommende: rows.length - done,
    færdige: done,
  };

  const q = query.trim().toLowerCase();
  const groups = groupByArea(
    rows.filter((r) => {
      if (filter === 'kommende' && r.done) return false;
      if (filter === 'færdige' && !r.done) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    }),
  );

  /** Progress per area is counted over ALL its rows, not the filtered subset —
   *  "3/10" must not change just because a filter is on. */
  function areaProgress(area: ChecklistArea) {
    const all = rows.filter((r) => areaOf(r) === area);
    return { done: all.filter((r) => r.done).length, total: all.length };
  }

  /* Every area starts folded away, so the 12 groups fit on one screen instead
     of 205 rows. While a search or filter is on, an area with matches unfolds
     itself, otherwise searching would return twelve closed lines. */
  const filtering = q !== '' || filter !== 'alle';
  const isOpen = (area: ChecklistArea) => filtering || openAreas.has(area);
  const allOpen = groups.length > 0 && groups.every(({ area }) => openAreas.has(area));

  function setOpen(next: Set<ChecklistArea>) {
    setMenuId(null);
    setOpenAreas(next);
    writeOpenAreas(next);
  }

  function toggleArea(area: ChecklistArea) {
    const next = new Set(openAreas);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    setOpen(next);
  }

  function toggleAll() {
    setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.area)));
  }

  function handleToggle(row: (typeof rows)[number]) {
    const nowDone = !row.done;
    void updateTask(row.id, { done: nowDone });
    if (nowDone) celebrateArea(row);
  }

  /** Called as `row` is ticked off. At 200 items a toast per tick is noise, so
   *  only a whole area gets one. */
  function celebrateArea(row: (typeof rows)[number]) {
    const area = areaOf(row);
    const siblings = rows.filter((r) => areaOf(r) === area);
    const remaining = siblings.filter((r) => !r.done && r.id !== row.id).length;
    if (remaining === 0 && siblings.length > 1) {
      onCelebrate(t('{area} er klaret', { area: t(areaLabel(area)) }));
    }
  }

  function openAdd(area: ChecklistArea) {
    setMenuId(null);
    setAddingIn(area);
    setNewTitle('');
    setTimeout(() => newInputRef.current?.focus(), 60);
  }

  function commitAdd() {
    if (!addingIn || !newTitle.trim()) { setAddingIn(null); return; }
    void addTask({
      title: newTitle.trim(),
      due_date: null,
      category: addingIn,
      kind: 'check',
      sort: nextSort(rows.filter((r) => areaOf(r) === addingIn)),
    });
    setAddingIn(null);
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    // Claim the seed slot first: clearing empties `rows`, and without this the
    // auto-seed effect would fire alongside the re-seed below and double it.
    if (event) seeding.add(event.id);
    void (async () => {
      // Scoped to check items — the timeline on the other tab must survive.
      const cleared = await clearTasks('check');
      if (cleared) { setError(cleared); return; }
      // A reset is an explicit "give me the current list", so it re-seeds in
      // full — including anything the top-up would otherwise have added.
      if (event) localStorage.setItem(topUpKey(event.id), '1');
      setError(await seedTasks(defaultChecklist()));
    })();
  }

  const toDisplay = (r: (typeof rows)[number]): DisplayTask => ({
    id: r.id, title: r.title, dateISO: r.due_date, done: r.done, weddingDay: false,
    // A milestone heading this area's block is only visiting from the timeline.
    tag: isMilestone(r) ? 'Milepæl' : undefined,
    priority: priorityOf(r),
    assigneeInitials: assigneeInitials(r.assignee, couple),
    // Danish source words ("Begge", "Dig"), or a name t() passes through.
    assigneeName: r.assignee ? t(assigneeName(r.assignee, couple) ?? '') : null,
    hasNotes: !!r.notes?.trim(),
  });
  const openTask = rows.find((r) => r.id === openId) ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[28px] border border-[#dcdfdb] bg-[#ffffff] p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-[#5f6b66]">
          {t('De mange småting, samlet i bunker, så I kan tage ét område ad gangen.')}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="shrink-0 text-sm font-bold text-[#7d938a]">
            {t('{done} af {total} klaret', { done, total: rows.length })}
          </p>
          {groups.length > 0 && !filtering && (
            <button
              type="button"
              onClick={toggleAll}
              className="flex h-8 items-center gap-1.5 rounded-full border border-[#d9ded9] bg-white px-3 text-xs font-semibold text-[#24413a] transition-colors cursor-pointer"
            >
              <ChevronsUpDown size={13} />
              {allOpen ? t('Fold alle sammen') : t('Fold alle ud')}
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer',
              confirmReset ? 'bg-[#b34e37] text-white' : 'border border-[#d9ded9] bg-white text-[#24413a]',
            )}
          >
            <RotateCcw size={13} />
            {confirmReset ? t('Sikker?') : t('Nulstil')}
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 w-full items-center gap-2.5 rounded-[14px] border border-[#e6e9e5] bg-[#f8f9f8] px-4 sm:w-[260px]">
          <Search size={15} className="shrink-0 text-[#9a9686]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Søg i tjeklisten')}
            aria-label={t('Søg i tjeklisten')}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#24413a] placeholder:text-[#9a9686] focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Ryd søgning')}
              className="text-[#9a9686] hover:text-[#24413a] cursor-pointer">
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
                  ? 'bg-[#24413a] text-[#f8f9f8]'
                  : 'border border-[#e6e9e5] bg-[#f8f9f8] text-[#5f6b66] hover:text-[#24413a]',
              )}
            >
              {t(FILTER_LABELS[f])}
              <span className={active ? 'text-[#dbe5e0]' : 'text-[#9a9686]'}>{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="rounded-[18px] border border-[#e2b9ab] bg-[#faf4ef] px-5 py-4">
          <p className="text-sm font-semibold text-[#b34e37]">
            {t('Kunne ikke hente standardlisten')}
          </p>
          <p className="mt-1 text-[13px] text-[#5f6b66]">{error}</p>
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-[18px] border border-[#e6e9e5] bg-[#f8f9f8] px-5 py-10 text-center">
          <p className="font-serif text-lg text-[#24413a]">
            {rows.length === 0
              ? error
                ? t('Tjeklisten er tom, tryk Nulstil for at prøve igen.')
                : t('Henter standardlisten …')
              : filter === 'færdige' ? t('Ingen afkrydsede punkter endnu.')
              : filter === 'kommende' ? t('Alt er krydset af. Flot arbejde.')
              : t('Ingen punkter matcher din søgning.')}
          </p>
        </div>
      )}

      {/* One foldable block per area. Tight gap on purpose: folded away, the
          twelve headers should read as a single list, not twelve panels. */}
      <div className="flex flex-col gap-1">
      {groups.map(({ area, items }) => {
        const progress = areaProgress(area);
        const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
        const Icon = CHECKLIST_AREAS.find((a) => a.id === area)?.Icon;
        const open = isOpen(area);
        const label = t(areaLabel(area));
        return (
          <section key={area} className="flex flex-col">
            {/* Button inside the heading, not the other way round: a <button>
                may only contain phrasing content, and this way the area keeps
                its place in the heading outline. No aria-label, the visible
                text is the accessible name, so "2/17" is announced too, and
                aria-expanded carries the state. */}
            <h2>
              <button
                type="button"
                onClick={() => toggleArea(area)}
                aria-expanded={open}
                className="flex w-full flex-wrap items-center gap-3 rounded-[14px] px-1 py-2 text-left transition-colors hover:bg-[#f2efe7] cursor-pointer"
              >
                {Icon && <Icon size={16} strokeWidth={2} className="shrink-0 text-[#7d938a]" />}
                <span className="font-serif text-lg text-[#24413a]">{label}</span>
                <span className="text-xs font-bold text-[#9a9686]">
                  {progress.done}/{progress.total}
                </span>
                <span aria-hidden className="h-1 min-w-[64px] flex-1 overflow-hidden rounded-full bg-[#e6e9e5]">
                  <span className="block h-full rounded-full bg-[#7d938a] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={cn(
                    'shrink-0 text-[#9a9686] transition-transform duration-200',
                    open && 'rotate-180',
                  )}
                />
              </button>
            </h2>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 pt-2">
                    {/* The real thank-you list and the photo album live in
                        Nygift; these checkboxes only remind you they exist. */}
                    {area === 'efter' && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('nygift')}
                        className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#d3dcc4] bg-[#e8f0ec] px-5 py-3.5 text-left transition-colors hover:bg-[#e6ebdc] cursor-pointer"
                      >
                        <span className="text-sm text-[#24413a]">
                          {t('Takkelisten og billederne bor under Nygift')}
                        </span>
                        <ArrowRight size={15} className="shrink-0 text-[#5f6b66]" />
                      </button>
                    )}

                    {items.map((row) => (
                      <TaskRow
                        key={row.id}
                        task={toDisplay(row)}
                        deleteLabel="Slet punkt"
                        menuOpen={menuId === row.id}
                        onMenu={() => setMenuId((m) => (m === row.id ? null : row.id))}
                        onCloseMenu={() => setMenuId(null)}
                        onToggle={() => handleToggle(row)}
                        onOpen={() => { setMenuId(null); setOpenId(row.id); }}
                        // A milestone is only visiting: open, tick or date it
                        // here, but delete it on the timeline where it lives.
                        {...(isCheck(row)
                          ? { onDelete: () => { setMenuId(null); removeTask(row.id, row.title, () => deleteTask(row.id)); } }
                          : {})}
                        onDateChange={(d) => void updateTask(row.id, { due_date: d })}
                      />
                    ))}

                    <AnimatePresence>
                      {addingIn === area && (
                        <AddRow inputRef={newInputRef} title={newTitle}
                          placeholder="Hvad skal huskes?"
                          onTitleChange={setNewTitle}
                          onSave={commitAdd} onCancel={() => setAddingIn(null)} />
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => openAdd(area)}
                      className="flex w-full items-center gap-4 rounded-[18px] border border-dashed border-[#dcdfdb] bg-transparent px-5 py-3 text-left text-sm font-semibold text-[#5f6b66] transition-colors hover:border-[#c6cbc6] hover:text-[#24413a] cursor-pointer"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-[#c6cbc6]">
                        <Plus size={14} />
                      </span>
                      {t('Tilføj punkt')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
      </div>

      <AnimatePresence>
        {openTask && (
          <TaskDialog
            key={openTask.id}
            task={openTask}
            couple={couple}
            onClose={() => setOpenId(null)}
            onSave={(patch) => {
              void updateTask(openTask.id, patch);
              if (patch.done === true) celebrateArea(openTask);
            }}
            onDelete={isCheck(openTask) ? () => { setOpenId(null); removeTask(openTask.id, openTask.title, () => deleteTask(openTask.id)); } : undefined}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
