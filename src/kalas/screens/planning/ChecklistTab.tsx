import * as React from 'react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Plus, Search, X, ArrowRight, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { ScreenId } from '../../Shell';
import TaskRow, { type DisplayTask } from './TaskRow';
import TaskDialog from './TaskDialog';
import AddRow from './AddRow';
import ResetControl from './ResetControl';
import { seeding, useChecklistSeed } from './useChecklistSeed';
import { defaultChecklist, phaseOf, phaseLabel, currentPhase, isDueBy, PHASES } from './checklist-data';
import {
  isCheck, isMilestone, hasArea, groupByArea, areaLabel, nextSort, areaOf, topUpKey,
  assigneeInitials, assigneeName, priorityOf,
  readOpenAreas, writeOpenAreas, daysDiff, todayISO,
  type ChecklistArea, type Filter, FILTER_LABELS, CHECKLIST_AREAS,
} from './shared';

/** The checklist's filters: the shared three, plus "Nu" once there is a date. */
type ChecklistFilter = Filter | 'nu';


export default function ChecklistTab({ onCelebrate, onNavigate }: {
  onCelebrate: (title: string) => void;
  onNavigate?: (s: ScreenId) => void;
}) {
  const { t, tn } = useLang();
  const { event, couple, timelineTasks, addTask, updateTask, deleteTask, seedTasks, clearTasks } = useWedding();

  const [filter, setFilter] = useState<ChecklistFilter>('alle');
  const [query, setQuery] = useState('');
  const [addingIn, setAddingIn] = useState<ChecklistArea | null>(null);
  const [newTitle, setNewTitle] = useState('');
  // The task open in TaskDialog. Its title, area, date and the rest are all
  // edited there now, instead of an inline rename that only reached the title.
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openAreas, setOpenAreas] = useState<Set<ChecklistArea>>(() => readOpenAreas());
  const reduce = useReducedMotion();
  const newInputRef = useRef<HTMLInputElement>(null);

  /* `checks` drives seeding and the top-up; `rows` is what the tab renders.
     They must not be the same list, milestones exist before the checklist is
     seeded, so folding them into `checks` would convince the seeder that the
     list is already full. */
  const checks = timelineTasks.filter(isCheck);
  // A task removed a moment ago stays out of `rows` while Fortryd is offered.
  const visible = useWithoutPending(timelineTasks);
  const removeTask = useRemoveWithUndo();
  const rows = [...visible.filter(isCheck), ...visible.filter((r) => isMilestone(r) && hasArea(r))];

  // Lays the default list out (shared with Overblik), and says if it could not.
  const { error, setError } = useChecklistSeed();

  /* Where the couple is in the plan, from their date. Without one there is
     no "now" to speak of, so the Nu filter and the counts stay away. */
  const now = couple.dateISO ? currentPhase(daysDiff(couple.dateISO)) : null;
  const dueNow = (r: (typeof rows)[number]) => {
    const phase = isCheck(r) ? phaseOf(r.title) : null;
    return !r.done && now !== null && phase !== null && isDueBy(phase, now);
  };
  const phaseRank = (r: (typeof rows)[number]) => {
    const phase = isCheck(r) ? phaseOf(r.title) : null;
    return phase ? PHASES.findIndex((p) => p.id === phase) : PHASES.length;
  };

  /* An open area, split by when: what belongs to now, what comes later, and
     what is done, each in phase order with the area's milestone first. One
     undifferentiated run of forty rows is what made it all run together.
     Without a date there is no "now", so the open items stay one group. */
  const today = todayISO();
  function bucketed(items: (typeof rows)[number][]) {
    const byWhen = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      (Number(isCheck(a)) - Number(isCheck(b))) || phaseRank(a) - phaseRank(b);
    const isNow = (r: (typeof rows)[number]) =>
      isCheck(r) ? dueNow(r) : r.due_date != null && r.due_date <= today;
    const open = items.filter((r) => !r.done);
    const done = items.filter((r) => r.done);
    return now
      ? [
          { id: 'nu', label: 'Hører til nu', rows: open.filter(isNow).sort(byWhen) },
          { id: 'senere', label: 'Senere', rows: open.filter((r) => !isNow(r)).sort(byWhen) },
          { id: 'klaret', label: 'Klaret', rows: done },
        ]
      : [
          { id: 'aabne', label: null, rows: open.sort(byWhen) },
          { id: 'klaret', label: 'Klaret', rows: done },
        ];
  }

  const done = rows.filter((r) => r.done).length;
  const counts: Record<ChecklistFilter, number> = {
    alle: rows.length,
    nu: rows.filter(dueNow).length,
    kommende: rows.length - done,
    færdige: done,
  };
  const filters: ChecklistFilter[] = now ? ['alle', 'nu', 'kommende', 'færdige'] : ['alle', 'kommende', 'færdige'];
  const activeFilter: ChecklistFilter = filter === 'nu' && !now ? 'alle' : filter;

  const q = query.trim().toLowerCase();
  const groups = groupByArea(
    rows.filter((r) => {
      if (activeFilter === 'nu' && !dueNow(r)) return false;
      if (activeFilter === 'kommende' && r.done) return false;
      if (activeFilter === 'færdige' && !r.done) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    }),
  );
  // Under Nu, what should have been done first comes first.
  if (activeFilter === 'nu') {
    for (const g of groups) {
      g.items.sort((a, b) => (Number(isCheck(a)) - Number(isCheck(b))) || phaseRank(a) - phaseRank(b));
    }
  }

  /** Progress per area is counted over ALL its rows, not the filtered subset —
   *  "3/10" must not change just because a filter is on. */
  function areaProgress(area: ChecklistArea) {
    const all = rows.filter((r) => areaOf(r) === area);
    return { done: all.filter((r) => r.done).length, total: all.length, due: all.filter(dueNow).length };
  }

  /* Every area starts folded away, so the 12 groups fit on one screen instead
     of 205 rows. While a search or filter is on, an area with matches unfolds
     itself, otherwise searching would return twelve closed lines. */
  const filtering = q !== '' || activeFilter !== 'alle';
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

  /* What a reset throws away, counted, for the confirmation: items the couple
     wrote (or renamed, which reads the same) and every tick. */
  const ownCount = checks.filter((r) => phaseOf(r.title) === null).length;
  const tickCount = checks.filter((r) => r.done).length;
  const lost = [
    ownCount > 0 && tn(ownCount, 'jeres ene egne punkt', 'jeres {n} egne punkter'),
    tickCount > 0 && tn(tickCount, 'ét flueben', '{n} flueben'),
  ].filter(Boolean).join(t(' og '));
  const resetDetail = lost
    ? t('Listen starter forfra med standardpunkterne, og {lost} forsvinder.', { lost })
    : t('Listen starter forfra med standardpunkterne.');

  function handleReset() {
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
    phase: (() => { const p = isCheck(r) ? phaseOf(r.title) : null; return p ? phaseLabel(p) : null; })(),
    phaseDue: dueNow(r),
    dateOptional: isCheck(r),
  });
  const openTask = rows.find((r) => r.id === openId) ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[22px] border border-[#dcdfdb] bg-[#ffffff] p-4 sm:rounded-[28px] sm:p-7"
    >
      {/* One line of controls: find, narrow down, fold, and the rest behind
          "⋯". How far they are lives on Overblik, not in a count up here. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 w-full items-center gap-2.5 rounded-[14px] border border-[#e6e9e5] bg-[#f8f9f8] px-4 sm:w-[260px]">
          <Search size={15} className="shrink-0 text-[#9a9686]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Søg i tjeklisten')}
            aria-label={t('Søg i tjeklisten')}
            className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-[#24413a] placeholder:text-[#9a9686] focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Ryd søgning')}
              className="text-[#9a9686] hover:text-[#24413a] cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
        {filters.map((f) => {
          const active = activeFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors cursor-pointer',
                active
                  ? 'bg-[#24413a] text-[#f8f9f8]'
                  : 'border border-[#e6e9e5] bg-[#f8f9f8] text-[#5f6b66] hover:text-[#24413a]',
              )}
            >
              {f === 'nu' ? t('Nu') : t(FILTER_LABELS[f])}
              {/* Only "Nu" is worth a number: "Kommende 217" says nothing. */}
              {f === 'nu' && <span className={active ? 'text-[#dbe5e0]' : 'text-[#9a9686]'}>{counts.nu}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {groups.length > 0 && !filtering && (
            <button
              type="button"
              onClick={toggleAll}
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-[#5f6b66] transition-colors hover:text-[#24413a] cursor-pointer"
            >
              <ChevronsUpDown size={13} />
              {allOpen ? t('Fold alle sammen') : t('Fold alle ud')}
            </button>
          )}
          <ResetControl
            itemLabel="Gendan standardlisten…"
            confirmTitle="Gendan standardlisten?"
            detail={resetDetail}
            onReset={handleReset}
          />
        </div>
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
                ? t('Tjeklisten er tom. Prøv igen med Gendan standardlisten under ⋯.')
                : t('Henter standardlisten …')
              : activeFilter === 'færdige' ? t('Ingen afkrydsede punkter endnu.')
              : activeFilter === 'kommende' ? t('Alt er krydset af. Flot arbejde.')
              : activeFilter === 'nu' ? t('I er med. Intet her skal gøres endnu.')
              : t('Ingen punkter matcher din søgning.')}
          </p>
        </div>
      )}

      {/* One foldable block per area, parted by hairlines so twelve areas read
          as twelve things, each saying how far it has come and what it asks
          of them now on a quiet second line. */}
      <div className="border-t border-line">
      {groups.map(({ area, items }) => {
        const progress = areaProgress(area);
        const Icon = CHECKLIST_AREAS.find((a) => a.id === area)?.Icon;
        const open = isOpen(area);
        const label = t(areaLabel(area));
        const buckets = bucketed(items);
        const labelled = buckets.filter((b) => b.rows.length > 0).length > 1;
        return (
          <section key={area} className="border-b border-line">
            {/* Button inside the heading, not the other way round: a <button>
                may only contain phrasing content, and this way the area keeps
                its place in the heading outline. No aria-label, the visible
                text is the accessible name, so the counts are announced too,
                and aria-expanded carries the state. */}
            <h2>
              <button
                type="button"
                onClick={() => toggleArea(area)}
                aria-expanded={open}
                className="flex w-full items-center gap-3.5 px-1 py-3.5 text-left transition-colors hover:bg-[#f6f7f5] cursor-pointer sm:px-2"
              >
                {Icon && (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-shell text-sage-strong">
                    <Icon size={16} strokeWidth={2} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg leading-snug text-ink">{label}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[13px] font-normal text-muted">
                    <span>{t('{done} af {total} klaret', { done: progress.done, total: progress.total })}</span>
                    {now && progress.due > 0 && activeFilter !== 'nu' && (
                      <span className="inline-flex items-center gap-1.5 text-[#746b56]">
                        <span aria-hidden className="size-1.5 rounded-full bg-[#c9a15f]" />
                        {tn(progress.due, 'én hører til nu', '{n} hører til nu')}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')}
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
                  {/* Indented under the area's icon on a wide screen, so the
                      items read as belonging to it. */}
                  <div className="pb-4 sm:pl-[3.25rem]">
                    {/* The real thank-you list and the photo album live in
                        Nygift; these checkboxes only remind you they exist. */}
                    {area === 'efter' && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('nygift')}
                        className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl bg-sage-tint/50 px-4 py-3 text-left transition-colors hover:bg-sage-tint cursor-pointer"
                      >
                        <span className="text-sm text-ink">{t('Takkelisten og billederne bor under Nygift')}</span>
                        <ArrowRight size={15} className="shrink-0 text-muted" />
                      </button>
                    )}

                    {buckets.map((b) => b.rows.length > 0 && (
                      <div key={b.id}>
                        {labelled && b.label && (
                          <p className="px-1 pb-1 pt-3 text-[12px] font-semibold text-muted sm:px-2">{t(b.label)}</p>
                        )}
                        <div className="divide-y divide-line/70">
                          {b.rows.map((row) => (
                            // The hairline sits on this wrapper, not on the
                            // row itself, whose hover is rounded.
                            <div key={row.id}>
                            <TaskRow
                              variant="list"
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
                            </div>
                          ))}
                        </div>
                      </div>
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
                      className="mt-1 inline-flex items-center gap-2 px-1 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink cursor-pointer sm:px-2"
                    >
                      <Plus size={14} aria-hidden />
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
