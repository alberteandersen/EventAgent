import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Plus, X, Pencil, Bell, StickyNote, ChevronRight, ChevronDown, MessageCircle, ArrowRight, CalendarClock } from 'lucide-react';
import BudgetLineDetail from './BudgetLineDetail';
import BudgetJunoAssistant from './BudgetJunoAssistant';
import { budgetLines, type BudgetLine } from '@/lib/budget/benchmarks';
import {
  BUDGET_COLORS,
  BUDGET_ICON_IDS,
  nextBudgetColor,
  resolveBudgetIcon,
  type BudgetIconId,
} from '../lib/budget-style';
import { Button, Eyebrow, Chip, CheckDot, Page, PageHeader, PageLoader, cn, inputClass } from '../ui';
import AnimateNumber from '../AnimateNumber';
import { useWedding } from '../useWedding';
import { useUndo } from '../undo';
import { useLang } from '../i18n';
import { navigateToHub, type NavigateTarget } from '../lib/hub-nav';
import { estimatedTotal, estimatedLines, rentalSplit, subItemSeeds } from './budget/estimate';
import CategoryMark from './budget/CategoryMark';
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
/** The unit after a figure. A no-break space: an ordinary one at the start of
 *  AnimateNumber's suffix is dropped, and the figure read "225.000kr". */
const KR = '\u00a0kr';
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the editable draft follows the saved rows as they change
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

  // Sliders that have been moved since their last save. A slider that was
  // only tabbed past saves nothing: its own value is rounded to its step and
  // capped at its max, which would quietly overwrite a typed amount.
  const slid = useRef<Set<string>>(new Set());
  const commitSlider = (id: string, value: number) => {
    if (!slid.current.delete(id)) return;
    persist(id, value);
  };

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

  /** Applies Juno's whole suggested split at once. A dedicated bulk write
   *  rather than one call to `persist` per line: those each read `amounts` from
   *  closure, so looping them would race — each call seeding or saving
   *  against a version of the total that only reflects the one line before
   *  it. One computed object, one write. Only touches lines Juno actually
   *  advised on — a standard category the couple deleted does not come
   *  back just because Juno has an opinion about it. */
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

  /** A category's share of the whole budget, in whole percent. */
  const share = (amount: number) => (total > 0 ? Math.round((amount / total) * 100) : 0);

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
              <span className="mt-1 block text-clay-ink">{t('Sæt et beløb eller et gæsteantal, så regner vi en fordeling ud.')}</span>
            )}
          </>
        }
        guide="budget"
        actions={
          /* Juno needs a total or a headcount to reason from — the same guard
             the API itself enforces, so the button never opens onto an error. */
          total > 0 && event?.id ? (
            <Button icon={MessageCircle} onClick={() => setAssistOpen(true)}>{t('Spørg Juno om fordelingen')}</Button>
          ) : undefined
        }
      />

      {/* The totals, and under them how the money is spread: one block, so
          the bar reads as part of the figures rather than a stripe adrift on
          the page. */}
      <section className="@container overflow-hidden rounded-3xl rule bg-card">
        {/* On a phone the total takes the row and the other two share the
            next, so the three figures do not fill the whole first screen. */}
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
          <Stat
            label="Samlet budget"
            value={total}
            tone="total"
            onCommit={(next) => void updateEvent({ budget: next > 0 ? String(next) : null })}
          />
          <Stat label="Fordelt" value={allocated} tone="allocated" />
          <Stat label={remaining < 0 ? 'Over budget' : 'Tilbage at fordele'} value={Math.abs(remaining)} tone={remaining < 0 ? 'over' : 'remaining'} />
        </div>

        <div className="border-t border-line px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Eyebrow>{t('Fordeling')}</Eyebrow>
            <p className="text-meta text-muted">
              {t('Betalt indtil videre:')} <span className="font-semibold text-ink tabular-nums">{kr(spent)} kr</span> · {t('Juno advarer, hvis I rammer loftet.')}
            </p>
          </div>

          {total > 0 && (
            <>
              {/* The legend below says the same in words, so the bar is for the eye only. */}
              <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-shell" aria-hidden>
                {lines.filter((b) => (amounts[b.id] ?? 0) > 0).map((b) => (
                  <span key={b.id}
                    className="min-w-0 transition-[flex-grow] duration-500 ease-out"
                    style={{ flexGrow: amounts[b.id], flexBasis: 0, background: b.color }}
                    title={t(b.label)}
                  />
                ))}
                {remaining > 0 && <span className="min-w-0" style={{ flexGrow: remaining, flexBasis: 0 }} />}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 @2xl:grid-cols-3 @5xl:grid-cols-4">
                {lines.map((b) => (
                  <li key={b.id} className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{t(b.label)}</span>
                    <span className="shrink-0 font-semibold text-ink tabular-nums">{share(amounts[b.id] ?? 0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* One card per category, built like the block above: its figures in
          labelled tiles, then the posts that make it up. */}
      <div className="@container flex flex-col gap-4">
        {lines.map((b) => {
          const est = amounts[b.id] ?? 0;
          const actual = actuals[b.id] ?? 0;
          const paid = paids[b.id] ?? 0;
          const state = paidState(actual, paid);
          const rest = Math.max(0, actual - paid);
          const hubCat = BUDGET_TO_HUBCAT[b.id];
          const reminder = reminderById[b.id] ?? '';
          const note = noteById[b.id] ?? '';
          const overdue = state !== 'full' && (daysUntil(reminder) ?? 0) < 0;
          const subs = subItems.filter((s) => s.category === b.id);
          const subCount = subs.length;
          const subTotal = subs.reduce((a, s) => a + s.amount, 0);
          const open = !collapsedIds.has(b.id);
          const adding = addingSubIn === b.id;
          // The slider reaches 45% of the budget, or as far as the saved
          // figure when that is more, so a typed amount is never out of range.
          const saved = budgetItems.find((i) => i.category === b.id)?.planned_amount ?? 0;
          const sliderMax = Math.max(Math.round(total * 0.45), saved);
          return (
          <motion.section key={b.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[22px] border border-line bg-card">
            <div className="flex items-center gap-3 py-4 pl-5 pr-3 sm:pl-6 sm:pr-4">
              <CategoryMark icon={b.icon} color={b.color} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {/* Opens Detaljer, the one place to rename a category. */}
                  <h2 className="min-w-0">
                    <button type="button" onClick={() => setDetailId(b.id)}
                      className="group/name flex max-w-full cursor-pointer items-center gap-1.5 text-left" title={t('Åbn detaljer')}>
                      <span className="truncate font-serif text-title text-ink">{t(b.label)}</span>
                      <Pencil size={12} aria-hidden className="shrink-0 text-muted opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100" />
                    </button>
                  </h2>
                  {state === 'full' && <Chip tone="success">{t('Fuldt betalt')}</Chip>}
                  {state === 'partial' && (
                    <Chip tone="success">{t('{paid} af {actual} betalt', { paid: kr(paid), actual: kr(actual) })}</Chip>
                  )}
                </div>
                {(subCount > 0 || reminder || note) && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {subCount > 0 && <span>{tn(subCount, '{n} post', '{n} poster')}</span>}
                    {reminder && (
                      <span className={cn('inline-flex items-center gap-1', overdue ? 'text-terracotta' : 'text-clay-ink')}>
                        <Bell size={12} aria-hidden /> {fmtDate(reminder)}
                      </span>
                    )}
                    {note && (
                      <span className="inline-flex text-clay-ink" title={t('Noter')}>
                        <StickyNote size={12} aria-hidden />
                        <span className="sr-only">{t('Noter')}</span>
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => removeLine(b.id)} aria-label={t('Fjern {label}', { label: t(b.label) })}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-terracotta-tint hover:text-terracotta">
                <X size={15} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => toggleCollapsed(b.id)}
                aria-label={open ? t('Skjul underposter') : t('Vis underposter')}
                aria-expanded={open}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink"
              >
                <ChevronDown size={17} aria-hidden className={cn('transition-transform duration-200', !open && '-rotate-90')} />
              </button>
            </div>

            {/* The figures, in the same tiles as the totals. Budgetteret is
                theirs to set, by the slider or by typing; the other three
                open Detaljer, where the actual price and what is paid are
                kept as a draft until saved. */}
            <div className="grid grid-cols-3 gap-px border-y border-line bg-line @3xl:grid-cols-5">
              <div className="col-span-3 bg-sage-wash px-5 py-4 sm:px-6 @3xl:col-span-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Eyebrow className="!text-ink-soft">{t('Budgetteret')}</Eyebrow>
                  {total > 0 && <span className="text-xs text-ink-soft tabular-nums">{t('{n}% af budgettet', { n: share(est) })}</span>}
                </div>
                <MoneyFigure
                  value={est}
                  label={t('Ret beløbet for {label}', { label: t(b.label) })}
                  onCommit={(next) => { setAmount(b.id, next); persist(b.id, next); }}
                  className="mt-1.5 text-[1.6rem] leading-tight text-ink"
                />
                {total > 0 && (
                  <input
                    type="range" min={0} max={sliderMax} step={500}
                    value={est}
                    onChange={(e) => { slid.current.add(b.id); setAmount(b.id, Number(e.target.value)); }}
                    onPointerUp={(e) => commitSlider(b.id, Number(e.currentTarget.value))}
                    onKeyUp={(e) => commitSlider(b.id, Number(e.currentTarget.value))}
                    onBlur={(e) => commitSlider(b.id, Number(e.currentTarget.value))}
                    className="budget-range mt-2"
                    style={{ '--ratio': sliderMax > 0 ? Math.min(1, est / sliderMax) : 0, '--tone': b.color } as CSSProperties}
                    aria-label={t('Justér {label}', { label: t(b.label) })}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailId(b.id)}
                title={t('Åbn detaljer')}
                className="group/figs col-span-3 grid cursor-pointer grid-cols-3 gap-px bg-line text-left focus-visible:-outline-offset-2!"
              >
                <FigureTile label={t('Faktisk')} value={actual > 0 ? actual : null} />
                <FigureTile label={t('Betalt')} value={paid > 0 ? paid : null} />
                <FigureTile
                  label={t('Rest')}
                  value={actual > 0 ? rest : null}
                  tone={actual > 0 ? (rest > 0 ? 'due' : 'settled') : undefined}
                />
                <span className="sr-only">{t('Åbn detaljer for {label}', { label: t(b.label) })}</span>
              </button>
            </div>

            {/* The posts that make up this category, out by default: each with
                a tick for paid, its vendor and its price. A row opens Detaljer
                for the rest; a new post can be added right here. */}
            {open && (
              <div>
                {/* Two columns once the card is wide enough: a list of posts
                    is short lines, and one column left most of each row empty. */}
                <div className="grid gap-px bg-line-soft @4xl:grid-cols-2">
                {subs.map((s) => (
                  <div
                    key={s.id}
                    className="group/post flex items-center gap-3 bg-card pl-5 transition-colors hover:bg-paper sm:pl-6"
                  >
                    {/* Only once the database knows about paid (0037). */}
                    {s.paid !== undefined && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.paid}
                        aria-label={s.paid ? t("Markér '{title}' som ikke betalt", { title: s.label }) : t("Markér '{title}' som betalt", { title: s.label })}
                        onClick={() => void updateBudgetSubItem(s.id, { paid: !s.paid })}
                        className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105"
                      >
                        <CheckDot done={s.paid} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailId(b.id)}
                      aria-label={t('Rediger {label}', { label: s.label })}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3.5 pr-5 text-left sm:pr-6 focus-visible:-outline-offset-2!"
                    >
                      <span className={cn('min-w-0 flex-1 truncate text-sm', s.paid ? 'text-muted line-through decoration-line-strong' : 'text-ink')}>
                        {t(s.label)}
                        {s.vendor && <span className="text-muted"> · {s.vendor}</span>}
                      </span>
                      <span className={cn('shrink-0 text-sm tabular-nums', s.amount > 0 ? 'font-semibold text-ink' : 'text-muted')}>
                        {kr(s.amount)} kr
                      </span>
                      <ChevronRight size={14} aria-hidden
                        className="hidden shrink-0 text-muted opacity-0 transition-opacity group-hover/post:opacity-100 sm:block" />
                    </button>
                  </div>
                ))}
                {/* An odd count leaves a hole in the second column; fill it,
                    or the grid's own rule colour shows through. */}
                {subCount % 2 === 1 && <div className="hidden bg-card @4xl:block" aria-hidden />}
                </div>

                {adding && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); commitSubItem(b.id, subCount); }}
                    className={cn('flex items-center gap-2 px-5 py-3 sm:px-6', subCount > 0 && 'border-t border-line-soft')}
                  >
                    <input
                      autoFocus
                      value={newSubLabel}
                      onChange={(e) => setNewSubLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setAddingSubIn(null); setNewSubLabel(''); setNewSubAmount(''); } }}
                      placeholder={t('Ny post, fx sko')}
                      aria-label={t('Navn på ny underpost')}
                      className={cn(inputClass, 'min-w-0 flex-1')}
                    />
                    <input
                      type="number" min={0} step={100}
                      value={newSubAmount}
                      onChange={(e) => setNewSubAmount(e.target.value)}
                      placeholder="0"
                      aria-label={t('Beløb')}
                      className={cn(inputClass, 'w-24! shrink-0 text-right tabular-nums')}
                    />
                    <Button type="submit" disabled={!newSubLabel.trim()}>{t('Tilføj')}</Button>
                  </form>
                )}

                {b.hint && <p className="border-t border-line-soft px-5 py-3 text-xs text-muted sm:px-6">{b.hint}</p>}

                <div className={cn('flex flex-wrap items-center gap-x-1 gap-y-2 bg-paper px-2.5 py-2.5 sm:px-3.5', (subCount > 0 || adding || b.hint) && 'border-t border-line')}>
                  {!adding && (
                    <Button variant="ghost" size="sm" icon={Plus}
                      onClick={() => { setAddingSubIn(b.id); setNewSubLabel(''); setNewSubAmount(''); }}>
                      {t('Tilføj post')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDetailId(b.id)}>{t('Detaljer')}</Button>
                  {hubCat && (
                    <Button variant="ghost" size="sm" iconEnd={ArrowRight} onClick={() => goFind(b.id)}>
                      {b.id === 'venue' ? t('Se venues der matcher jer') : t('Se top matches')}
                    </Button>
                  )}
                  {subCount > 0 && (
                    <p className="ml-auto flex items-baseline gap-3 px-2.5 text-xs text-muted">
                      {subs.some((x) => x.paid !== undefined) && (
                        <span>{t('{n} af {total} betalt', { n: subs.filter((x) => x.paid).length, total: subCount })}</span>
                      )}
                      <span className="font-semibold uppercase tracking-[0.14em]">{t('I alt')}</span>
                      <span className="text-sm font-semibold text-ink tabular-nums">{kr(subTotal)} kr</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.section>
          );
        })}

        {/* Add new category */}
        {addingNew ? (
          <div className="rounded-[22px] border border-line bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <CategoryMark icon={newIcon} color={newColor} />
              <input
                ref={inputRef}
                type="text"
                placeholder={t('Kategorinavn, fx. Transport')}
                aria-label={t('Kategorinavn, fx. Transport')}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLine();
                  if (e.key === 'Escape') { setAddingNew(false); setNewLabel(''); }
                }}
                className="min-w-0 flex-1 border-b border-line-strong bg-transparent pb-1 font-serif text-title text-ink placeholder:text-muted/70 focus:outline-none"
              />
              <Button size="sm" onClick={addLine} disabled={!newLabel.trim()}>{t('Tilføj')}</Button>
              <button type="button" onClick={() => { setAddingNew(false); setNewLabel(''); }} aria-label={t('Annuller')}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink">
                <X size={16} aria-hidden />
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
          <button type="button" onClick={startAdding}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[22px] border border-dashed border-line-strong px-5 py-4 text-meta font-semibold text-muted transition-colors hover:border-ink hover:bg-card hover:text-ink">
            <Plus size={15} aria-hidden /> {t('Tilføj kategori')}
          </button>
        )}
      </div>

      {/* Payment timeline */}
      <section className="mt-6 rule-t pt-9">
        <Eyebrow>{t('Betalingstidslinje')}</Eyebrow>
        <h2 className="display mt-2.5 text-[1.75rem] text-ink">
          {t('Hvornår skal')} <span className="italic">{t('pengene bruges?')}</span>
        </h2>
        {timeline.length === 0 ? (
          <div className="mt-6 flex items-center gap-4 rounded-[22px] border border-line bg-card px-5 py-5 sm:px-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-shell text-ink-soft" aria-hidden>
              <CalendarClock size={18} strokeWidth={1.9} />
            </span>
            <p className="max-w-xl text-meta text-muted">
              {t('Tilføj en faktisk pris og en påmindelse på en kategori, så bygger vi jeres betalingsplan her.')}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] border border-line">
              {timeline.map((p, i) => {
                const isNext = i === nextDueIdx;
                const overdueDays = daysUntil(p.due);
                return (
                <motion.div key={p.id}
                  initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className={cn('flex items-center gap-4 px-5 py-4 sm:px-6', isNext ? 'bg-sage-wash' : 'bg-card')}>
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', p.fullyPaid ? 'bg-sage-tint' : isNext ? 'bg-sage' : 'bg-shell')}>
                    {p.fullyPaid
                      ? <span className="h-2 w-2 rounded-full bg-sage" />
                      : <span className={cn('h-2 w-2 rounded-full', isNext ? 'bg-ink' : 'bg-line-strong')} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', p.fullyPaid ? 'text-muted line-through' : 'text-ink')}>
                      {t(p.label)}
                      {isNext && (
                        <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-[0.58rem] font-bold uppercase tracking-[0.12em] text-canvas">
                          {t('Næste')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.outstanding > 0 && (
                      <p className={cn('font-serif text-[1.15rem] leading-tight tabular-nums', p.fullyPaid ? 'text-muted' : 'text-ink')}>
                        {kr(p.outstanding)} kr
                      </p>
                    )}
                    <p className={cn('mt-0.5 text-[0.68rem] uppercase tracking-[0.14em]', !p.fullyPaid && overdueDays != null && overdueDays < 0 ? 'text-terracotta' : 'text-muted')}>
                      {p.due ? fmtDate(p.due) : t('ingen dato')}
                    </p>
                  </div>
                </motion.div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              {t('Udestående betalinger:')}{' '}
              <span className="font-semibold text-ink tabular-nums">{kr(remainingKnown)} kr</span>
              {' '}{t('· baseret på faktiske priser I har indtastet')}
            </p>
          </>
        )}
      </section>

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
        <BudgetJunoAssistant
          eventId={event.id}
          guests={couple.guests}
          region={couple.region}
          onClose={() => setAssistOpen(false)}
          onApply={applyAdvice}
        />
      )}

      {/* The slider: a track filled to the thumb in the category's colour.
          --ratio is how far along it is; the thumb's centre travels between
          half a thumb from each end, and the fill follows it there. */}
      <style>{`
        .budget-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 20px; margin: 0; background: transparent; cursor: pointer; --track: color-mix(in srgb, var(--color-ink) 14%, transparent); --fill: calc(10px + (100% - 20px) * var(--ratio, 0)); }
        .budget-range::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, var(--tone) var(--fill), var(--track) var(--fill)); }
        .budget-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; margin-top: -7px; border-radius: 999px; background: var(--color-card); border: 1.5px solid var(--tone); box-shadow: 0 1px 3px rgb(18 51 43 / 0.2); transition: transform 150ms ease-out; }
        .budget-range:active::-webkit-slider-thumb { transform: scale(1.12); }
        .budget-range::-moz-range-track { height: 6px; border-radius: 999px; background: var(--track); }
        .budget-range::-moz-range-progress { height: 6px; border-radius: 999px; background: var(--tone); }
        .budget-range::-moz-range-thumb { width: 17px; height: 17px; border-radius: 999px; background: var(--color-card); border: 1.5px solid var(--tone); box-shadow: 0 1px 3px rgb(18 51 43 / 0.2); }
        .kalas-date { color: #24413a; }
        .kalas-date::-webkit-datetime-edit,
        .kalas-date::-webkit-datetime-edit-fields-wrapper,
        .kalas-date::-webkit-datetime-edit-text,
        .kalas-date::-webkit-datetime-edit-month-field,
        .kalas-date::-webkit-datetime-edit-day-field,
        .kalas-date::-webkit-datetime-edit-year-field { color: #24413a; }
        .kalas-date::-webkit-calendar-picker-indicator { filter: invert(19%) sepia(18%) saturate(1200%) hue-rotate(60deg); }
      `}</style>
    </Page>
  );
}

const STAT_STYLES = {
  total:     { bg: 'bg-ink',          label: '!text-canvas/75',  value: 'text-canvas' },
  allocated: { bg: 'bg-sage-tint',    label: '!text-ink-soft',   value: 'text-ink' },
  remaining: { bg: 'bg-terracotta-wash',   label: '!text-clay-ink',   value: 'text-clay-ink' },
  over:      { bg: 'bg-terracotta-wash',   label: '!text-terracotta', value: 'text-terracotta' },
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

/* A figure that is the couple's to set, changed where it stands: the number
   with a pencil, and on a click a field of the same size in its place. Used
   for the whole budget and for each category's share of it. */
function MoneyFigure({ value, label, title, onCommit, className }: {
  value: number;
  /** What the figure is, for a screen reader: the button and the field. */
  label: string;
  title?: string;
  onCommit: (next: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  const commit = (raw: string) => {
    setEditing(false);
    const digits = raw.replace(/[^\d]/g, '');
    const next = digits ? Number.parseInt(digits, 10) : 0;
    if (next !== value) onCommit(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        inputMode="numeric"
        defaultValue={value > 0 ? kr(value) : ''}
        // Selected, so typing replaces the figure rather than adding to it.
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={label}
        className={cn('block w-full border-b border-current/30 bg-transparent font-serif tabular-nums focus:outline-none', className)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={title ?? label}
      className={cn('group/fig flex max-w-full cursor-pointer items-center gap-2 border-b border-transparent text-left font-serif', className)}
    >
      <AnimateNumber value={value} suffix={KR} />
      <Pencil size={14} aria-hidden className="shrink-0 opacity-40 transition-opacity group-hover/fig:opacity-80" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/* One of a category's read-only figures, in the totals' own tile: a tracked
   label over a serif number. A span, because the three of them sit inside
   the one button that opens Detaljer. */
function FigureTile({ label, value, tone }: {
  label: string;
  /** Null when there is nothing to show yet, which is not the same as 0 kr. */
  value: number | null;
  tone?: 'due' | 'settled';
}) {
  return (
    <span className={cn(
      'flex min-w-0 flex-col gap-1.5 px-4 py-4 transition-colors sm:px-6',
      tone === 'due' ? 'bg-terracotta-wash' : tone === 'settled' ? 'bg-sage-wash' : 'bg-paper group-hover/figs:bg-shell',
    )}>
      <span className={cn('eyebrow', tone === 'due' && '!text-clay-ink')}>{label}</span>
      <span className={cn(
        'font-serif text-[1.2rem] leading-tight tabular-nums @xl:text-[1.45rem] @3xl:text-[1.6rem]',
        value == null ? 'text-muted' : tone === 'due' ? 'text-clay-ink' : tone === 'settled' ? 'text-success' : 'text-ink',
      )}>
        {value == null ? '–' : `${kr(value)}${KR}`}
      </span>
    </span>
  );
}

/* The totals. `onCommit` makes one of them the couple's own figure rather
   than a read-out: the budget was settable only by asking Juno, while this tile
   sat here showing the number it would not let them change. */
function Stat({ label, value, tone, onCommit }: {
  label: string; value: number; tone: keyof typeof STAT_STYLES;
  onCommit?: (next: number) => void;
}) {
  const { t } = useLang();
  const s = STAT_STYLES[tone];
  // The total is the wide one on a phone and keeps its size there.
  const size = tone === 'total' ? 'text-[2rem]' : 'text-[1.5rem] sm:text-[2rem]';
  return (
    <div className={cn(
      'flex min-w-0 flex-col justify-between overflow-hidden px-5 sm:px-6 sm:py-7',
      tone === 'total' ? 'col-span-2 py-6 sm:col-span-1' : 'py-5',
      s.bg,
    )}>
      <Eyebrow className={s.label}>{t(label)}</Eyebrow>
      {onCommit ? (
        <MoneyFigure
          value={value}
          label={t(label)}
          title={t('Ret det samlede budget')}
          onCommit={onCommit}
          className={cn('mt-2', size, s.value)}
        />
      ) : (
        <div className={cn('mt-2 border-b border-transparent font-serif', size, s.value)}>
          <AnimateNumber value={value} suffix={KR} />
        </div>
      )}
    </div>
  );
}
