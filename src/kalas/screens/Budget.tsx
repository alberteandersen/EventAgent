import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, X, Pencil, Bell, StickyNote, ChevronRight, ChevronDown, MessageCircle } from 'lucide-react';
import BudgetLineDetail from './BudgetLineDetail';
import BudgetAvaAssistant from './BudgetAvaAssistant';
import { budgetLines, type BudgetLine } from '@/lib/budget/benchmarks';
import {
  BUDGET_COLORS,
  BUDGET_ICON_IDS,
  nextBudgetColor,
  resolveBudgetIcon,
  type BudgetIconId,
} from '../lib/budget-style';
import { Button, Eyebrow, Chip, CheckDot, Page, PageHeader, PageLoader, cn } from '../ui';
import AnimateNumber from '../AnimateNumber';
import { useWedding } from '../useWedding';
import { useUndo } from '../undo';
import { useLang } from '../i18n';
import { navigateToHub, type NavigateTarget } from '../lib/hub-nav';
import { estimatedTotal, estimatedLines, rentalSplit, subItemSeeds } from './budget/estimate';
import type { HubCat } from './team/shared';

const isCustomLine = (id: string) => id.startsWith('custom-');

/* Budget benchmark id → the vendor-search chip it should deep-link to.
   Custom + 'misc' lines have no matching vendor category, so no CTA. */
const BUDGET_TO_HUBCAT: Record<string, HubCat> = {
  venue: 'venue', photo: 'fotografi', catering: 'catering',
  florals: 'blomster', music: 'musik', attire: 'beauty',
};

/** Events whose opening budget has been claimed for insertion. Module scope,
 *  not a ref: navigating away unmounts the screen, and a fresh ref would start
 *  a second batch of the same benchmark rows while the first is still in flight. */
const seeding = new Set<string>();

/** Events whose one-time venue/hire split is in flight. Same reason as
 *  `seeding`: the new row lands a moment after the insert, and a remount in
 *  that gap would otherwise add a second hire line. */
const splitting = new Set<string>();

/** Categories whose usual posts are being added, keyed `event:category`.
 *  Module scope for the same reason: the flag lands after the insert. */
const subSeeding = new Set<string>();

const kr = (n: number) => new Intl.NumberFormat('da-DK').format(Math.round(n));
/** Undo key for a category: its id is a category name, not a row id. */
const lineKey = (category: string) => `budget-line:${category}`;

/** Paid state of a line: fully paid, partially paid, or nothing paid. */
const paidState = (actual: number, paid: number): 'full' | 'partial' | 'none' =>
  actual > 0 && paid >= actual ? 'full' : paid > 0 ? 'partial' : 'none';

/** Whole days from today until a YYYY-MM-DD date (negative = overdue). */
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function Budget({ onNavigate }: { onNavigate?: (s: NavigateTarget) => void }) {
  const { t, tn } = useLang();
  const {
    loading, couple, event, budgetItems, saveBudgetItem, deleteBudgetItem, updateEvent,
    budgetSubItems, addBudgetSubItem, updateBudgetSubItem, deleteBudgetSubItem, seedBudgetSubItems,
  } = useWedding();

  // What the estimate is built on. Their own figure wins; a headcount is the
  // fallback. Zero means we know neither, and nothing is guessed.
  const estimate = estimatedTotal(couple.budgetTotal, couple.guests);
  const total = couple.budgetTotal || estimate;
  const [storedLines, setLines] = useState<BudgetLine[]>(budgetLines);
  // A category or post removed a moment ago stays out of sight, and out of
  // the totals, while Fortryd is still on offer; see removeLine.
  const { remove, isPending } = useUndo();
  const lines = useMemo(() => storedLines.filter((l) => !isPending(lineKey(l.id))), [storedLines, isPending]);
  const subItems = useMemo(() => budgetSubItems.filter((s) => !isPending(s.id)), [budgetSubItems, isPending]);
  const [amounts, setAmounts] = useState<Record<string, number>>(
    () => Object.fromEntries(budgetLines.map((b) => [b.id, Math.round((total * b.pct) / 100)])),
  );
  // Per-line workspace fields, mirrored from budget_items once persisted.
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [paids, setPaids] = useState<Record<string, number>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [reminderById, setReminderById] = useState<Record<string, string>>({});
  // Which line's detail panel is open — reminder, note, contract and the
  // actual/paid figures all live there now instead of three inline toggles.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  // Categories folded shut. Everything starts open: the posts under a
  // category are the budget, and hiding them by default hid the budget.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  // The category whose "+ Tilføj post" row is open, and what is typed in it.
  const [addingSubIn, setAddingSubIn] = useState<string | null>(null);
  const [newSubLabel, setNewSubLabel] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const commitSubItem = (category: string, count: number) => {
    const label = newSubLabel.trim();
    if (label) void addBudgetSubItem({ category, label, amount: Math.max(0, Number(newSubAmount) || 0), sort: count });
    setNewSubLabel('');
    setNewSubAmount('');
    if (!label) setAddingSubIn(null);
  };

  // Once anything is persisted, `budget_items` is the source of truth for which
  // categories exist and what they're called — so removing or renaming a
  // standard category sticks. `budgetLines` only supplies the pct/hint defaults.
  useEffect(() => {
    if (budgetItems.length === 0) return;
    const stdById = new Map(budgetLines.map((l) => [l.id, l]));
    const nextLines: BudgetLine[] = budgetItems.map((i) => {
      const std = stdById.get(i.category);
      return {
        id: i.category,
        label: i.label,
        pct: std?.pct ?? 0,
        spent: i.paid_amount,
        hint: std?.hint ?? '',
        icon: i.icon ?? std?.icon ?? 'sparkles',
        color: i.color ?? std?.color ?? BUDGET_COLORS[0],
      };
    });
    setLines(nextLines);
    setAmounts((prev) => {
      const next = { ...prev };
      for (const i of budgetItems) next[i.category] = i.planned_amount;
      return next;
    });
    setActuals(Object.fromEntries(budgetItems.map((i) => [i.category, i.actual_cost])));
    setPaids(Object.fromEntries(budgetItems.map((i) => [i.category, i.paid_amount])));
    setNoteById(Object.fromEntries(budgetItems.map((i) => [i.category, i.notes ?? ''])));
    setReminderById(Object.fromEntries(budgetItems.map((i) => [i.category, i.reminder_at ?? ''])));
  }, [budgetItems]);

  /* The budget is laid out on arrival rather than behind a form. Same shape as
     the checklist's self-seed: a module-scope claim keyed by event, so leaving
     the screen mid-insert cannot start a second batch.

     Deliberately does not write back to the event, the old estimator saved its
     guesses into `budget` and `guest_count`, which overwrote what the couple
     had actually told us with a number derived from it. */
  /* One claim guards all three write paths below. `budget_items` only lands a
     moment after the insert, so without it the auto-seed and a slider dragged
     in that gap would both write the same benchmark rows. */
  const claimSeed = () => {
    if (!event || seeding.has(event.id)) return false;
    seeding.add(event.id);
    return true;
  };

  useEffect(() => {
    if (loading || !event || budgetItems.length > 0 || estimate <= 0) return;
    if (!claimSeed()) return;
    const id = event.id;
    void Promise.all(estimatedLines(estimate).map((l) => saveBudgetItem(l)))
      .catch(() => seeding.delete(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, event, budgetItems.length, estimate, saveBudgetItem]);

  /* Every category starts with its usual posts at 0 kr, once. The flag on the
     row says when that has happened, so a post the couple deleted stays gone;
     a database older than the flag has nothing to seed (see subItemSeeds). */
  useEffect(() => {
    if (loading || !event) return;
    const { rows, categories } = subItemSeeds(budgetItems, budgetSubItems);
    const fresh = categories.filter((c) => !subSeeding.has(`${event.id}:${c}`));
    if (fresh.length === 0) return;
    for (const c of fresh) subSeeding.add(`${event.id}:${c}`);
    const id = event.id;
    void seedBudgetSubItems(rows.filter((r) => fresh.includes(r.category))).then((ok) => {
      if (!ok) { for (const c of fresh) subSeeding.delete(`${id}:${c}`); return; }
      return Promise.all(fresh.map((category) => {
        const line = budgetItems.find((b) => b.category === category);
        return line ? saveBudgetItem({ category, label: line.label, sub_items_seeded: true }) : undefined;
      }));
    });
  }, [loading, event, budgetItems, budgetSubItems, seedBudgetSubItems, saveBudgetItem]);

  /* Hire used to share the venue's line. A budget saved back then still has
     one "Venue & leje" row, so it is split once, on arrival: renamed to Venue,
     with "Leje & udstyr" added underneath at 0 kr. The data says when it is
     done, so there is no flag to keep. */
  useEffect(() => {
    if (loading || !event || splitting.has(event.id)) return;
    const split = rentalSplit(budgetItems);
    if (!split) return;
    const id = event.id;
    splitting.add(id);
    void Promise.all([
      saveBudgetItem({ category: 'venue', label: 'Venue' }),
      saveBudgetItem(split.rental),
      ...split.shifted.map((row) => saveBudgetItem(row)),
    ]).catch(() => splitting.delete(id));
  }, [loading, event, budgetItems, saveBudgetItem]);

  // First mutation while nothing is persisted seeds the whole current list, so
  // budget_items becomes authoritative in one batch (no partial state that the
  // reconcile above would then treat as "the only categories"). Only reachable
  // when the estimate could not be worked out — otherwise the effect got there.
  const seedAll = async (ls: BudgetLine[], amts: Record<string, number>) => {
    if (!claimSeed()) return;
    await Promise.all(
      ls.map((l, idx) =>
        saveBudgetItem({
          category: l.id, label: l.label, planned_amount: amts[l.id] ?? 0,
          paid_amount: l.spent, icon: l.icon, color: l.color, sort: idx,
        })
      )
    );
  };

  const persist = (id: string, amount: number) => {
    if (budgetItems.length === 0) {
      void seedAll(lines, { ...amounts, [id]: amount });
      return;
    }
    const line = lines.find((l) => l.id === id);
    void saveBudgetItem({
      category: id, label: line?.label ?? id, planned_amount: amount,
      icon: line?.icon, color: line?.color,
    });
  };

  // Persist a non-estimate field (actual cost, paid, note, reminder). Seeds the
  // whole list first if nothing is persisted yet, merging the patch into its row.
  const persistField = (
    id: string,
    patch: { actual_cost?: number; paid_amount?: number; notes?: string | null; reminder_at?: string | null },
  ) => {
    const line = lines.find((l) => l.id === id);
    if (budgetItems.length === 0 && claimSeed()) {
      void Promise.all(
        lines.map((l, idx) =>
          saveBudgetItem({
            category: l.id, label: l.label, planned_amount: amounts[l.id] ?? 0,
            paid_amount: l.spent, icon: l.icon, color: l.color, sort: idx,
            ...(l.id === id ? patch : {}),
          }),
        ),
      );
      return;
    }
    void saveBudgetItem({ category: id, label: line?.label ?? id, icon: line?.icon, color: line?.color, ...patch });
  };

  // Deep-link a budget line straight into vendor search for its category.
  const goFind = (id: string) => {
    const hc = BUDGET_TO_HUBCAT[id];
    if (!hc || !onNavigate) return;
    navigateToHub('explore', hc);
    onNavigate('team');
  };

  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState<BudgetIconId>('sparkles');
  const [newColor, setNewColor] = useState<string>(BUDGET_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const allocated = useMemo(
    () => Object.entries(amounts).reduce((a, [id, v]) => (isPending(lineKey(id)) ? a : a + v), 0),
    [amounts, isPending],
  );
  const remaining = total - allocated;
  const spent = lines.reduce((a, b) => a + b.spent, 0);

  const setAmount = (id: string, v: number) => setAmounts((a) => ({ ...a, [id]: v }));

  const addLine = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = `custom-${Date.now()}`;
    const newLine: BudgetLine = {
      id, label, pct: 0, spent: 0, hint: '', icon: newIcon, color: newColor,
    };
    setLines((prev) => [...prev, newLine]);
    setAmounts((prev) => ({ ...prev, [id]: 0 }));
    setNewLabel('');
    setNewIcon('sparkles');
    setNewColor(nextBudgetColor([...lines.map((l) => l.color), newColor]));
    setAddingNew(false);
    if (budgetItems.length === 0) void seedAll([...lines, newLine], { ...amounts, [id]: 0 });
    else void saveBudgetItem({ category: id, label, planned_amount: 0, icon: newIcon, color: newColor });
  };

  // The removal runs when the Fortryd toast closes, so it reads the budget as
  // it is then rather than as it was when the × was pressed.
  const latest = useRef({ lines: storedLines, amounts, persisted: budgetItems.length > 0 });
  useEffect(() => { latest.current = { lines: storedLines, amounts, persisted: budgetItems.length > 0 }; });

  const removeLine = (id: string) => {
    const line = lines.find((b) => b.id === id);
    remove({
      ids: lineKey(id),
      label: t('{label} er fjernet', { label: t(line?.label ?? id) }),
      commit: () => {
        const { lines: now, amounts: nowAmounts, persisted } = latest.current;
        setLines((prev) => prev.filter((b) => b.id !== id));
        setAmounts((prev) => { const next = { ...prev }; delete next[id]; return next; });
        // When nothing is persisted yet, seed everything *except* the removed
        // line so the removal sticks; otherwise delete the persisted row.
        if (!persisted) return seedAll(now.filter((b) => b.id !== id), nowAmounts);
        return deleteBudgetItem(id);
      },
    });
  };

  const removeSubItem = (id: string) => {
    const sub = budgetSubItems.find((s) => s.id === id);
    remove({
      ids: id,
      label: t('{label} er fjernet', { label: sub?.label ?? '' }),
      commit: () => deleteBudgetSubItem(id),
    });
  };

  /** Applies a whole Detaljer draft at once — label, style, the actual/paid
   *  figures, the reminder and the note — as a single write, the same seed-if-
   *  empty fallback as every other budget mutation uses. */
  const saveDetail = (
    id: string,
    patch: { label: string; icon: string; color: string; actual: number; paid: number; reminder: string; note: string },
  ) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, label: patch.label, icon: patch.icon, color: patch.color } : l)));
    setActuals((a) => ({ ...a, [id]: patch.actual }));
    setPaids((p) => ({ ...p, [id]: patch.paid }));
    setReminderById((r) => ({ ...r, [id]: patch.reminder }));
    setNoteById((n) => ({ ...n, [id]: patch.note }));

    const planned = amounts[id] ?? 0;
    const line = lines.find((l) => l.id === id);
    if (budgetItems.length === 0 && claimSeed()) {
      void Promise.all(
        lines.map((l, idx) =>
          saveBudgetItem({
            category: l.id,
            label: l.id === id ? patch.label : l.label,
            planned_amount: amounts[l.id] ?? 0,
            paid_amount: l.id === id ? patch.paid : l.spent,
            icon: l.id === id ? patch.icon : l.icon,
            color: l.id === id ? patch.color : l.color,
            sort: idx,
            ...(l.id === id
              ? { actual_cost: patch.actual, reminder_at: patch.reminder || null, notes: patch.note }
              : {}),
          }),
        ),
      );
      return;
    }
    void saveBudgetItem({
      category: id,
      label: patch.label,
      planned_amount: planned,
      icon: patch.icon,
      color: patch.color,
      paid_amount: patch.paid,
      actual_cost: patch.actual,
      reminder_at: patch.reminder || null,
      notes: patch.note,
      sort: line ? lines.indexOf(line) : undefined,
    });
  };

  /** Applies Ava's whole suggested split at once. A dedicated bulk write
   *  rather than one call to `persist` per line: those each read `amounts` from
   *  closure, so looping them would race — each call seeding or saving
   *  against a version of the total that only reflects the one line before
   *  it. One computed object, one write. Only touches lines Ava actually
   *  advised on — a standard category the couple deleted does not come
   *  back just because Ava has an opinion about it. */
  const applyAdvice = (advice: { category: string; amount: number }[]) => {
    const nextAmounts = { ...amounts };
    for (const l of advice) nextAmounts[l.category] = l.amount;
    setAmounts(nextAmounts);

    if (budgetItems.length === 0) {
      void seedAll(lines, nextAmounts);
      return;
    }
    const advisedIds = new Set(advice.map((l) => l.category));
    void Promise.all(
      lines
        .filter((l) => advisedIds.has(l.id))
        .map((l) =>
          saveBudgetItem({
            category: l.id, label: l.label, planned_amount: nextAmounts[l.id] ?? 0,
            icon: l.icon, color: l.color,
          }),
        ),
    );
  };

  const startAdding = () => {
    setNewColor(nextBudgetColor(lines.map((l) => l.color)));
    setNewIcon('sparkles');
    setAddingNew(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Real payment timeline, derived from the lines that have an agreed cost
  // and/or a reminder date — replacing the old hard-coded schedule.
  const timeline = useMemo(() => {
    return lines
      .map((b) => {
        const actual = actuals[b.id] ?? 0;
        const paid = paids[b.id] ?? 0;
        return {
          id: b.id,
          label: b.label,
          due: reminderById[b.id] ?? '',
          outstanding: Math.max(0, actual - paid),
          fullyPaid: paidState(actual, paid) === 'full',
          hasCost: actual > 0,
        };
      })
      .filter((r) => r.hasCost || r.due)
      .sort((a, b) => (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0));
  }, [lines, actuals, paids, reminderById]);

  const nextDueIdx = timeline.findIndex((r) => !r.fullyPaid && (r.outstanding > 0 || r.due));
  const remainingKnown = timeline.reduce((a, r) => a + r.outstanding, 0);
  const fmtDate = (d: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        title={t('Budget')}
        subtitle={
          <>
            {total > 0
              ? t('Fordelingen er lagt ud fra det I har fortalt, træk i den, så den passer jer.')
              : t('Hold styr på hvad brylluppet koster, og hvad I har tilbage.')}
            {/* Nothing to estimate from. A split of zero would just be a column
                of empty rows pretending to be a plan. */}
            {total === 0 && (
              <span className="mt-1 block text-clay">{t('Sæt et beløb eller et gæsteantal, så regner vi en fordeling ud.')}</span>
            )}
          </>
        }
        guide="budget"
        actions={
          /* Ava needs a total or a headcount to reason from — the same guard
             the API itself enforces, so the button never opens onto an error. */
          total > 0 && event?.id ? (
            <Button icon={MessageCircle} onClick={() => setAssistOpen(true)}>{t('Spørg Ava om fordelingen')}</Button>
          ) : undefined
        }
      />

      <div>
      {/* Totals strip */}
      <div className="grid gap-px overflow-hidden rounded-3xl rule bg-line sm:grid-cols-3">
        <Stat
          label="Samlet budget"
          value={total}
          tone="total"
          onCommit={(next) => void updateEvent({ budget: next > 0 ? String(next) : null })}
        />
        <Stat label="Fordelt" value={allocated} tone="allocated" />
        <Stat label={remaining < 0 ? 'Over budget' : 'Tilbage at fordele'} value={Math.abs(remaining)} tone={remaining < 0 ? 'over' : 'remaining'} />
      </div>

      <p className="mt-4 text-[0.82rem] text-muted">
        {t('Betalt indtil videre:')} <span className="text-ink">{kr(spent)} kr</span> · {t('Ava advarer, hvis I rammer loftet.')}
      </p>

      {/* Stacked allocation bar */}
      <div className="mt-8 flex h-3 overflow-hidden rounded-full bg-shell">
        {lines.map((b) => (
          <motion.div key={b.id}
            initial={{ width: 0 }} animate={{ width: `${((amounts[b.id] ?? 0) / total) * 100}%` }}
            transition={{ duration: 0.5 }}
            style={{ background: b.color }}
            title={t(b.label)}
          />
        ))}
      </div>
      {/* Legend, so the bar actually reads */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {lines.map((b) => {
          const Icon = resolveBudgetIcon(b.icon);
          return (
            <span key={b.id} className="flex items-center gap-1.5 text-[0.72rem] text-muted">
              <span className="flex h-4 w-4 items-center justify-center rounded-full shrink-0"
                style={{ background: b.color }}>
                <Icon size={9} className="text-white" strokeWidth={2.5} />
              </span>
              {t(b.label)} · {Math.round(((amounts[b.id] ?? 0) / total) * 100)}%
            </span>
          );
        })}
      </div>

      {/* Editable lines */}
      <div className="mt-10 divide-y divide-line">
        {lines.map((b) => {
          const est = amounts[b.id] ?? 0;
          const actual = actuals[b.id] ?? 0;
          const paid = paids[b.id] ?? 0;
          const state = paidState(actual, paid);
          const hubCat = BUDGET_TO_HUBCAT[b.id];
          const reminder = reminderById[b.id] ?? '';
          const note = noteById[b.id] ?? '';
          const Icon = resolveBudgetIcon(b.icon);
          const custom = isCustomLine(b.id);
          const subs = subItems.filter((s) => s.category === b.id);
          const subCount = subs.length;
          const subTotal = subs.reduce((a, s) => a + s.amount, 0);
          return (
          <motion.div key={b.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="py-7">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(b.id)}
                  aria-label={collapsedIds.has(b.id) ? t('Vis underposter') : t('Skjul underposter')}
                  aria-expanded={!collapsedIds.has(b.id)}
                  className="shrink-0 -ml-1 rounded-full p-1 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
                >
                  <ChevronDown
                    size={15}
                    className={cn('transition-transform duration-200', collapsedIds.has(b.id) && '-rotate-90')}
                  />
                </button>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: b.color }}
                  aria-hidden
                >
                  <Icon size={15} className="text-white" strokeWidth={2.25} />
                </span>
                {/* Opens the same Detaljer panel as the chevron below — one
                    place to rename a category, not two competing ones. */}
                <button onClick={() => setDetailId(b.id)}
                  className="group flex items-center gap-1.5 text-left cursor-pointer" title={t('Åbn detaljer')}>
                  <span className="font-serif text-[1.2rem] text-ink">{t(b.label)}</span>
                  <Pencil size={12} className="text-muted/0 group-hover:text-muted transition-colors" />
                </button>
                {state === 'full' && <Chip tone="success">{t('Fuldt betalt')}</Chip>}
                {state === 'partial' && (
                  <Chip tone="success">{t('{paid} af {actual} betalt', { paid: kr(paid), actual: kr(actual) })}</Chip>
                )}
              </div>
              <div className="flex items-baseline gap-3 shrink-0">
                <div className="font-serif text-[1.3rem] text-ink tabular-nums">
                  <AnimateNumber value={est} suffix=" kr" />
                </div>
                <button onClick={() => removeLine(b.id)} aria-label={t('Fjern {label}', { label: t(b.label) })}
                  className="text-muted hover:text-terracotta transition-colors cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Estimate slider (primary) */}
            <div className="mt-4 flex items-center gap-4">
              <input
                type="range" min={0} max={Math.round(total * 0.45)} step={500}
                value={amounts[b.id] ?? 0} onChange={(e) => setAmount(b.id, Number(e.target.value))}
                onPointerUp={(e) => persist(b.id, Number((e.target as HTMLInputElement).value))}
                onBlur={(e) => persist(b.id, Number(e.target.value))}
                className="kalas-range flex-1"
                aria-label={t('Justér {label}', { label: t(b.label) })}
              />
              <span className="w-12 shrink-0 text-right text-[0.78rem] text-muted tabular-nums">
                {Math.round(((amounts[b.id] ?? 0) / total) * 100)}%
              </span>
            </div>

            {/* Betalinger, at a glance — click the row to open Detaljer, where
                the reminder, the note and the contract review live now
                instead of three separate icon-toggles. No labeled button:
                the whole strip is the target, and the only affordance is a
                chevron that slides in on hover — the numbers should not have
                to share space with a control that says what they already do. */}
            <button
              type="button"
              onClick={() => setDetailId(b.id)}
              aria-label={t('Åbn detaljer for {label}', { label: t(b.label) })}
              className="group -mx-2.5 mt-5 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-shell cursor-pointer"
            >
              <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem]">
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-muted">{t('Faktisk')}</span>
                  <span className="font-semibold text-ink tabular-nums">{actual > 0 ? kr(actual) : '–'}</span>
                </span>
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-muted">{t('Betalt')}</span>
                  <span className="font-semibold text-ink tabular-nums">{paid > 0 ? kr(paid) : '–'}</span>
                </span>
                {actual > 0 && (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="text-muted">{t('Rest')}</span>
                    <span className={cn('font-semibold tabular-nums', actual - paid > 0 ? 'text-terracotta' : 'text-success')}>
                      {kr(Math.max(0, actual - paid))}
                    </span>
                  </span>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                {subCount > 0 && <span className="text-[0.72rem] text-muted">{tn(subCount, '{n} post', '{n} poster')}</span>}
                {reminder && <Bell size={12} className="text-clay" aria-hidden />}
                {note && <StickyNote size={12} className="text-clay" aria-hidden />}
                <ChevronRight
                  size={16}
                  className="-translate-x-1 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </button>

            {/* The posts that make up this category, out by default: each with
                a tick for paid, its vendor and its price. A row opens Detaljer
                for the rest; a new post can be added right here. */}
            {!collapsedIds.has(b.id) && (
              <div className="mt-3 overflow-hidden rounded-2xl rule bg-card">
                {subs.map((s, idx) => (
                  <div
                    key={s.id}
                    className={cn('group flex items-center gap-3 px-4 transition-colors hover:bg-shell', idx > 0 && 'border-t border-line')}
                  >
                    {/* Only once the database knows about paid (0037). */}
                    {s.paid !== undefined && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.paid}
                        aria-label={s.paid ? t("Markér '{title}' som ikke betalt", { title: s.label }) : t("Markér '{title}' som betalt", { title: s.label })}
                        onClick={() => void updateBudgetSubItem(s.id, { paid: !s.paid })}
                        className="shrink-0 cursor-pointer py-3 transition-transform hover:scale-105"
                      >
                        <CheckDot done={s.paid} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailId(b.id)}
                      aria-label={t('Rediger {label}', { label: s.label })}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left cursor-pointer"
                    >
                      {/* The parent's own icon and colour, so a post reads as
                          belonging to this category rather than floating loose. */}
                      <Icon size={13} className="shrink-0" style={{ color: b.color }} strokeWidth={2.25} aria-hidden />
                      <span className={cn('min-w-0 flex-1 truncate text-[0.88rem]', s.paid ? 'text-muted line-through decoration-line-strong' : 'text-ink')}>
                        {t(s.label)}
                        {s.vendor && <span className="text-muted"> · {s.vendor}</span>}
                      </span>
                      <span className={cn('shrink-0 text-[0.88rem] font-semibold tabular-nums', s.amount > 0 ? 'text-ink' : 'text-muted')}>
                        {kr(s.amount)} kr
                      </span>
                      <ChevronRight size={13} aria-hidden
                        className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </div>
                ))}

                {addingSubIn === b.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); commitSubItem(b.id, subCount); }}
                    className={cn('flex items-center gap-2 px-3 py-2', subCount > 0 && 'border-t border-line')}
                  >
                    <input
                      autoFocus
                      value={newSubLabel}
                      onChange={(e) => setNewSubLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setAddingSubIn(null); setNewSubLabel(''); setNewSubAmount(''); } }}
                      placeholder={t('Ny post, fx sko')}
                      aria-label={t('Navn på ny underpost')}
                      className="min-w-0 flex-1 rounded-lg bg-shell px-3 py-2 text-[0.85rem] text-ink placeholder:text-muted/60 focus:outline-none"
                    />
                    <input
                      type="number" min={0} step={100}
                      value={newSubAmount}
                      onChange={(e) => setNewSubAmount(e.target.value)}
                      placeholder="0"
                      aria-label={t('Beløb')}
                      className="w-24 shrink-0 rounded-lg bg-shell px-3 py-2 text-right text-[0.85rem] text-ink tabular-nums placeholder:text-muted/60 focus:outline-none"
                    />
                    <button type="submit" disabled={!newSubLabel.trim()}
                      className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[0.75rem] font-semibold text-canvas disabled:opacity-40 cursor-pointer">
                      {t('Tilføj')}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAddingSubIn(b.id); setNewSubLabel(''); setNewSubAmount(''); }}
                    className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-left text-[0.8rem] text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer', subCount > 0 && 'border-t border-line')}
                  >
                    <Plus size={13} /> {t('Tilføj post')}
                  </button>
                )}

                {subCount > 0 && (
                  <div className="flex items-center justify-between border-t border-line bg-shell/60 px-4 py-2.5">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                      {t('I alt')}
                      {subs.some((x) => x.paid !== undefined) && (
                        <span className="ml-2 normal-case tracking-normal">
                          · {t('{n} af {total} betalt', { n: subs.filter((x) => x.paid).length, total: subCount })}
                        </span>
                      )}
                    </span>
                    <span className="text-[0.85rem] font-semibold text-ink tabular-nums">{kr(subTotal)} kr</span>
                  </div>
                )}
              </div>
            )}

            {hubCat && (
              <button onClick={() => goFind(b.id)}
                className="mt-3 text-[0.82rem] text-ink underline underline-offset-2 hover:text-ink-soft transition-colors cursor-pointer">
                {b.id === 'venue' ? t('Se venues der matcher jer') : t('Se top matches')}
              </button>
            )}


            {b.hint && <p className="mt-1.5 text-[0.78rem] text-muted">{b.hint}</p>}
          </motion.div>
          );
        })}

        {/* Add new category */}
        {addingNew ? (
          <div className="py-5 space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: newColor }}
                aria-hidden
              >
                {(() => { const Preview = resolveBudgetIcon(newIcon); return <Preview size={16} className="text-white" strokeWidth={2.25} />; })()}
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder={t('Kategorinavn, fx. Transport')}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLine();
                  if (e.key === 'Escape') { setAddingNew(false); setNewLabel(''); }
                }}
                className="flex-1 bg-transparent font-serif text-[1.2rem] text-ink placeholder:text-muted/50 focus:outline-none border-b border-line-strong pb-1"
              />
              <button onClick={addLine}
                className="h-8 rounded-full bg-ink px-3 text-xs font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                {t('Tilføj')}
              </button>
              <button onClick={() => { setAddingNew(false); setNewLabel(''); }}
                className="text-muted hover:text-ink transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <StylePicker
              icon={newIcon}
              color={newColor}
              onIcon={(icon) => setNewIcon(icon)}
              onColor={setNewColor}
            />
          </div>
        ) : (
          <div className="py-5">
            <button onClick={startAdding}
              className="flex items-center gap-2 text-[0.82rem] font-medium text-muted hover:text-ink transition-colors cursor-pointer">
              <Plus size={15} /> {t('Tilføj kategori')}
            </button>
          </div>
        )}
      </div>

      {/* Payment timeline */}
      <div className="mt-14 rule-t pt-10">
        <Eyebrow>{t('Betalingstidslinje')}</Eyebrow>
        <h2 className="display mt-3 text-[clamp(1.8rem,3.5vw,2.6rem)] text-ink">
          {t('Hvornår skal')} <span className="italic">{t('pengene bruges?')}</span>
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-8 rule rounded-2xl bg-card px-5 py-6 text-[0.85rem] text-muted">
            {t('Tilføj en faktisk pris og en påmindelse på en kategori, så bygger vi jeres betalingsplan her.')}
          </p>
        ) : (
          <>
            <div className="mt-8 space-y-0 divide-y divide-line rule rounded-2xl overflow-hidden">
              {timeline.map((p, i) => {
                const isNext = i === nextDueIdx;
                const overdueDays = daysUntil(p.due);
                return (
                <motion.div key={p.id}
                  initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex items-center gap-4 px-5 py-4 ${isNext ? 'bg-sage-tint/50' : 'bg-card'}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${p.fullyPaid ? 'bg-sage-tint' : isNext ? 'bg-sage' : 'bg-shell'}`}>
                    {p.fullyPaid
                      ? <span className="h-2 w-2 rounded-full bg-sage" />
                      : <span className={`h-2 w-2 rounded-full ${isNext ? 'bg-ink' : 'bg-line-strong'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[0.88rem] ${p.fullyPaid ? 'text-muted line-through' : 'text-ink'}`}>
                      {t(p.label)}
                      {isNext && (
                        <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-canvas align-middle">
                          {t('Næste')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.outstanding > 0 && (
                      <p className={`font-serif text-[0.95rem] ${p.fullyPaid ? 'text-muted' : 'text-ink'}`}>
                        {kr(p.outstanding)} kr
                      </p>
                    )}
                    <p className={`text-[0.68rem] uppercase tracking-[0.14em] mt-0.5 ${!p.fullyPaid && overdueDays != null && overdueDays < 0 ? 'text-terracotta' : 'text-muted'}`}>
                      {p.due ? fmtDate(p.due) : t('ingen dato')}
                    </p>
                  </div>
                </motion.div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.78rem] text-muted">
              {t('Udestående betalinger:')}{' '}
              <span className="text-ink font-medium">{kr(remainingKnown)} kr</span>
              {' '}{t('· baseret på faktiske priser I har indtastet')}
            </p>
          </>
        )}
      </div>

      {detailId && (() => {
        const b = lines.find((l) => l.id === detailId);
        if (!b) return null;
        const hubCat = BUDGET_TO_HUBCAT[b.id];
        return (
          <BudgetLineDetail
            eventId={event?.id ?? null}
            categoryId={b.id}
            label={t(b.label)}
            icon={b.icon}
            color={b.color}
            custom={isCustomLine(b.id)}
            planned={amounts[b.id] ?? 0}
            actual={actuals[b.id] ?? 0}
            paid={paids[b.id] ?? 0}
            reminder={reminderById[b.id] ?? ''}
            note={noteById[b.id] ?? ''}
            findLabel={hubCat ? (b.id === 'venue' ? t('Se venues der matcher jer') : t('Se top matches')) : undefined}
            onFindVendors={hubCat ? () => { goFind(b.id); setDetailId(null); } : undefined}
            onClose={() => setDetailId(null)}
            onSave={(patch) => saveDetail(b.id, patch)}
            onDelete={() => { removeLine(b.id); setDetailId(null); }}
            onContractApply={(patch) => {
              if (patch.actual_cost != null) setActuals((a) => ({ ...a, [b.id]: patch.actual_cost! }));
              if (patch.reminder_at) setReminderById((r) => ({ ...r, [b.id]: patch.reminder_at! }));
              persistField(b.id, patch);
            }}
            subItems={subItems.filter((s) => s.category === b.id)}
            onAddSubItem={(item) => void addBudgetSubItem({ category: b.id, ...item })}
            onUpdateSubItem={(id, patch) => void updateBudgetSubItem(id, patch)}
            onDeleteSubItem={removeSubItem}
          />
        );
      })()}

      {assistOpen && event?.id && (
        <BudgetAvaAssistant
          eventId={event.id}
          guests={couple.guests}
          region={couple.region}
          onClose={() => setAssistOpen(false)}
          onApply={applyAdvice}
        />
      )}

      <style>{`
        .kalas-range { -webkit-appearance: none; appearance: none; height: 2px; background: var(--color-line-strong); border-radius: 999px; cursor: pointer; }
        .kalas-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 999px; background: var(--color-sage); border: 2px solid var(--color-canvas); box-shadow: 0 1px 4px rgba(46,51,37,0.2); cursor: pointer; }
        .kalas-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 999px; background: var(--color-sage); border: 2px solid var(--color-canvas); cursor: pointer; }
        .kalas-date { color: #24413a; }
        .kalas-date::-webkit-datetime-edit,
        .kalas-date::-webkit-datetime-edit-fields-wrapper,
        .kalas-date::-webkit-datetime-edit-text,
        .kalas-date::-webkit-datetime-edit-month-field,
        .kalas-date::-webkit-datetime-edit-day-field,
        .kalas-date::-webkit-datetime-edit-year-field { color: #24413a; }
        .kalas-date::-webkit-calendar-picker-indicator { filter: invert(19%) sepia(18%) saturate(1200%) hue-rotate(60deg); }
      `}</style>
      </div>
    </Page>
  );
}

const STAT_STYLES = {
  total:     { bg: 'bg-ink',          label: '!text-canvas/50',  value: 'text-canvas' },
  allocated: { bg: 'bg-sage-tint',    label: '!text-ink/50',     value: 'text-ink' },
  remaining: { bg: 'bg-terracotta-wash',   label: '!text-clay/70',    value: 'text-clay' },
  over:      { bg: 'bg-terracotta-wash',   label: '!text-red-700/70', value: 'text-red-700' },
} as const;

function StylePicker({
  icon,
  color,
  onIcon,
  onColor,
}: {
  icon: string;
  color: string;
  onIcon: (id: BudgetIconId) => void;
  onColor: (hex: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="mt-4 space-y-3 rule rounded-2xl bg-shell px-4 py-3.5">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted mb-2">{t('Ikon')}</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_ICON_IDS.map((id) => {
            const I = resolveBudgetIcon(id);
            const selected = icon === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onIcon(id)}
                aria-label={t('Vælg ikon')}
                aria-pressed={selected}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer',
                  selected ? 'bg-ink text-canvas' : 'bg-card text-ink-soft hover:text-ink rule',
                )}
              >
                <I size={14} strokeWidth={2.25} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted mb-2">{t('Farve')}</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_COLORS.map((hex) => {
            const selected = color.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onColor(hex)}
                aria-label={t('Vælg farve')}
                aria-pressed={selected}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform cursor-pointer',
                  selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas scale-105' : 'hover:scale-105',
                )}
                style={{ background: hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* The totals. `onCommit` makes one of them the couple's own figure rather
   than a read-out: the budget was settable only by asking Ava, while this tile
   sat here showing the number it would not let them change. */
function Stat({ label, value, tone, onCommit }: {
  label: string; value: number; tone: keyof typeof STAT_STYLES;
  onCommit?: (next: number) => void;
}) {
  const { t } = useLang();
  const s = STAT_STYLES[tone];
  const [editing, setEditing] = useState(false);

  const commit = (raw: string) => {
    setEditing(false);
    const digits = raw.replace(/[^\d]/g, '');
    const next = digits ? Number.parseInt(digits, 10) : 0;
    if (next !== value) onCommit?.(next);
  };

  return (
    <div className={cn('px-6 py-7', s.bg)}>
      <Eyebrow className={s.label}>{t(label)}</Eyebrow>
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          defaultValue={value > 0 ? kr(value) : ''}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={t(label)}
          className={cn(
            'mt-2 w-full border-b border-current/30 bg-transparent font-serif text-[2rem] focus:outline-none',
            s.value,
          )}
        />
      ) : onCommit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={t('Ret det samlede budget')}
          className={cn(
            'mt-2 flex w-full items-center gap-2 text-left font-serif text-[2rem] cursor-pointer',
            s.value,
          )}
        >
          <AnimateNumber value={value} suffix=" kr" />
          <Pencil size={15} className="shrink-0 opacity-50" />
        </button>
      ) : (
        <div className={cn('mt-2 font-serif text-[2rem]', s.value)}>
          <AnimateNumber value={value} suffix=" kr" />
        </div>
      )}
    </div>
  );
}
