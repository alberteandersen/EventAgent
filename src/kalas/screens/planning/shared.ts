import type { LucideIcon } from 'lucide-react';
import {
  Building2, Church, UtensilsCrossed, Shirt, Mail, Scale, PartyPopper,
  HeartHandshake, CircleDashed, Wallet, Camera, Users, CalendarClock,
} from 'lucide-react';
import type { TaskKind, TimelineTaskRow } from '@/lib/db/types';

/* ── Tabs ─────────────────────────────────────────────────────────────── */

export type PlanTab = 'tidslinje' | 'tjekliste' | 'bryllupsdagen';

const PLAN_TAB_KEY = 'kalas_planning_tab';
const PLAN_TABS: PlanTab[] = ['tidslinje', 'tjekliste', 'bryllupsdagen'];

export function readPlanTab(): PlanTab {
  if (typeof window === 'undefined') return 'tidslinje';
  const stored = sessionStorage.getItem(PLAN_TAB_KEY);
  return (PLAN_TABS as string[]).includes(stored ?? '') ? (stored as PlanTab) : 'tidslinje';
}

export function writePlanTab(tab: PlanTab) {
  if (typeof window !== 'undefined') sessionStorage.setItem(PLAN_TAB_KEY, tab);
}

/** Marks that one event has been topped up with the newest default items.
 *  Kept client-side on purpose: it must not resurrect items the couple has
 *  deliberately deleted, and it is not worth a column. */
export function topUpKey(eventId: string): string {
  return `kalas_checklist_topup_${eventId}`;
}

/* ── Kind ─────────────────────────────────────────────────────────────── */

/** Never trust the column: a client running ahead of migration 0020 sees
 *  `undefined` here, and everything degrading to 'milestone' is the safe
 *  fallback — it keeps the Tidslinje tab working instead of blanking it. */
export function kindOf(row: Pick<TimelineTaskRow, 'kind'>): TaskKind {
  return row.kind === 'check' ? 'check' : 'milestone';
}

export const isMilestone = (row: Pick<TimelineTaskRow, 'kind'>) => kindOf(row) === 'milestone';
export const isCheck = (row: Pick<TimelineTaskRow, 'kind'>) => kindOf(row) === 'check';

/**
 * Everything with a place in time: the milestones, plus any checklist item the
 * couple has put a date on. The two tabs overlap here on purpose — giving a
 * check a date means "put this in the calendar", and before this it meant
 * nothing at all.
 *
 * Deliberately NOT folded into `kindOf`: isMilestone/isCheck must stay each
 * other's complement, because they also drive the milestone seed gate in
 * Planning.tsx and the two tab counters.
 */
export function onTimeline(row: Pick<TimelineTaskRow, 'kind' | 'due_date'>): boolean {
  return isMilestone(row) || row.due_date != null;
}

/* ── Checklist areas ──────────────────────────────────────────────────── */

export type ChecklistArea =
  | 'okonomi' | 'venue' | 'ceremoni' | 'mad' | 'stil' | 'foto' | 'papir'
  | 'gaester' | 'jura' | 'optil' | 'dagen' | 'efter' | 'ovrigt';

/** Ids are stable ASCII — they are stored in the DB, so they must never be
 *  Danish labels with æ/ø/å. The label lives here so it stays translatable.
 *  Order is the render order on the Tjekliste tab: roughly the order a couple
 *  meets the work, ending with what happens after the wedding. */
export const CHECKLIST_AREAS: { id: ChecklistArea; label: string; Icon: LucideIcon }[] = [
  { id: 'okonomi', label: 'Økonomi & budget', Icon: Wallet },
  { id: 'venue', label: 'Sted & overnatning', Icon: Building2 },
  { id: 'ceremoni', label: 'Ceremoni & vielse', Icon: Church },
  { id: 'mad', label: 'Mad & drikke', Icon: UtensilsCrossed },
  { id: 'stil', label: 'Tøj & styling', Icon: Shirt },
  { id: 'foto', label: 'Foto & film', Icon: Camera },
  { id: 'papir', label: 'Papir & invitationer', Icon: Mail },
  { id: 'gaester', label: 'Gæster & bordplan', Icon: Users },
  { id: 'jura', label: 'Jura & praktik', Icon: Scale },
  { id: 'optil', label: 'Op til dagen', Icon: CalendarClock },
  { id: 'dagen', label: 'Dagen selv', Icon: PartyPopper },
  { id: 'efter', label: 'Efter brylluppet', Icon: HeartHandshake },
  { id: 'ovrigt', label: 'Øvrigt', Icon: CircleDashed },
];

const AREA_IDS = new Set<string>(CHECKLIST_AREAS.map((a) => a.id));

export function areaOf(row: Pick<TimelineTaskRow, 'category'>): ChecklistArea {
  return row.category && AREA_IDS.has(row.category) ? (row.category as ChecklistArea) : 'ovrigt';
}

/**
 * True when the row's category actually names an area. Stricter than `areaOf`,
 * which falls back to 'ovrigt' — that fallback is right for a check (it has to
 * land somewhere) and wrong for a milestone: one with no area, with the
 * 'wedding_day' sentinel, or with Ava's free-text category must stay off the
 * checklist rather than pile up under Øvrigt.
 */
export function hasArea(row: Pick<TimelineTaskRow, 'category'>): boolean {
  return row.category != null && AREA_IDS.has(row.category);
}

export function areaLabel(id: ChecklistArea): string {
  return CHECKLIST_AREAS.find((a) => a.id === id)?.label ?? 'Øvrigt';
}

/* ── Which areas are unfolded ─────────────────────────────────────────── */

/**
 * Every area starts folded away on a fresh load, so the twelve groups fit on
 * one screen instead of 205 rows, and you open the one you want to work in.
 *
 * Module scope rather than storage: switching to the Tidslinje tab unmounts the
 * checklist, and losing your place on the way back would be its own annoyance —
 * but the choice is not worth surviving a reload. Deliberately not
 * sessionStorage, which kept areas open across reloads.
 */
let openAreasMemo = new Set<ChecklistArea>();

export function readOpenAreas(): Set<ChecklistArea> {
  return new Set(openAreasMemo);
}

export function writeOpenAreas(open: Set<ChecklistArea>) {
  openAreasMemo = new Set(open);
}

/** Groups rows by area, preserving CHECKLIST_AREAS order. Areas with no rows
 *  are dropped, so an untouched 'ovrigt' bucket never renders. Within an area a
 *  milestone comes first — it is the big decision the small print hangs off. */
export function groupByArea<T extends Pick<TimelineTaskRow, 'category' | 'sort' | 'created_at' | 'kind'>>(
  rows: T[],
): { area: ChecklistArea; items: T[] }[] {
  const buckets = new Map<ChecklistArea, T[]>();
  for (const row of rows) {
    const area = areaOf(row);
    const bucket = buckets.get(area);
    if (bucket) bucket.push(row);
    else buckets.set(area, [row]);
  }
  return CHECKLIST_AREAS.flatMap(({ id }) => {
    const items = buckets.get(id);
    if (!items || items.length === 0) return [];
    // Milestone first, then the couple's own order. The two kinds run separate
    // `sort` series (0-13 and 0-204), so comparing them numerically is meaningless.
    items.sort((a, b) =>
      (Number(isCheck(a)) - Number(isCheck(b)))
      || a.sort - b.sort
      || a.created_at.localeCompare(b.created_at));
    return [{ area: id, items }];
  });
}

/* ── Dates & status ───────────────────────────────────────────────────── */

/**
 * The real local calendar day, as ISO.
 *
 * Deliberately not `TODAY` from data.ts: that constant is frozen at
 * 2026-06-14 to anchor the mock content, and the planning screen was reading
 * it as the current date — so every "Forsinket" / "Snart" / "I dag" label, and
 * the countdown on the Tidslinje tab, was answering as of a day in June.
 * Built from local parts rather than toISOString(), which would report
 * yesterday for anyone east of UTC late in the evening.
 */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` (default: today) to `dateISO`, negative for the past.
 *  Both sides are parsed at local midnight, so the result is a count of
 *  calendar days and never drifts by an hour across a DST boundary. */
export function daysDiff(dateISO: string, from: string = todayISO()): number {
  const target = new Date(`${dateISO}T00:00:00`).getTime();
  const origin = new Date(`${from}T00:00:00`).getTime();
  return Math.round((target - origin) / 86400000);
}

export function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${d}.${m}.${y}`;
}

export type Status = 'done' | 'overdue' | 'planned' | 'wedding' | 'undated';

export function statusOf(task: { done: boolean; dateISO: string | null; weddingDay: boolean }): Status {
  if (task.done) return 'done';
  if (task.weddingDay) return 'wedding';
  if (!task.dateISO) return 'undated';
  return daysDiff(task.dateISO) < 0 ? 'overdue' : 'planned';
}

export function statusLabel(
  task: { done: boolean; dateISO: string | null; weddingDay: boolean },
  t: (s: string, params?: Record<string, string | number>) => string,
): string {
  const status = statusOf(task);
  if (status === 'done') return t('Færdig');
  if (status === 'wedding') return t('Dagen');
  if (status === 'overdue') return t('Forsinket');
  if (status === 'undated') return t('Ingen dato');
  const diff = daysDiff(task.dateISO as string);
  if (diff === 0) return t('I dag');
  if (diff > 0 && diff <= 14) return t('Snart');
  return t('Planlagt');
}

/* ── Timeline bands ───────────────────────────────────────────────────── */

/**
 * A month that holds dated tasks, or the empty stretch between two such
 * months. The Tidslinje tab draws these down a single spine, so time reads
 * continuously: an eight-month lull is visible as an eight-month lull, not as
 * two rows sitting next to each other.
 */
export type TimelineBand<T> =
  | { kind: 'month'; key: string; monthISO: string; items: T[]; todayIndex: number | null }
  | { kind: 'gap'; key: string; months: number };

/** Months since year 0 — the arithmetic that makes month distance subtraction. */
function monthIndex(dateISO: string): number {
  const [y, m] = dateISO.split('-');
  return Number(y) * 12 + (Number(m) - 1);
}

function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function monthISOFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Group dated tasks into month bands, with the empty months between them
 * collapsed into gap bands that state how long the lull is.
 *
 * `todayISO` always gets a band of its own even when nothing is planned that
 * month — the marker is the reader's "you are here", and it cannot sit inside
 * a gap without claiming that month is empty *and* current at once.
 *
 * Items are expected sorted ascending by date; the caller already sorts them
 * to render, and sorting twice would be the only reason to copy the array.
 * `todayIndex` is how many of the month's items fall before today, so the
 * marker can be drawn between two rows rather than always above them.
 */
export function buildTimelineBands<T extends { dateISO: string | null }>(
  items: T[],
  todayISO: string,
): TimelineBand<T>[] {
  const dated = items.filter((i): i is T & { dateISO: string } => i.dateISO != null);
  if (dated.length === 0) return [];

  const byMonth = new Map<string, T[]>();
  for (const item of dated) {
    const key = monthKeyOf(item.dateISO);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(item);
    else byMonth.set(key, [item]);
  }

  const todayKey = monthKeyOf(todayISO);
  const occupied = [...new Set([...byMonth.keys(), todayKey])].sort();

  const bands: TimelineBand<T>[] = [];
  let previous: number | null = null;

  for (const key of occupied) {
    const index = monthIndex(`${key}-01`);
    if (previous !== null && index - previous > 1) {
      bands.push({ kind: 'gap', key: `gap-${previous}`, months: index - previous - 1 });
    }
    const monthItems = byMonth.get(key) ?? [];
    bands.push({
      kind: 'month',
      key,
      monthISO: monthISOFromIndex(index),
      items: monthItems,
      todayIndex:
        key === todayKey
          ? monthItems.filter((i) => (i.dateISO as string) < todayISO).length
          : null,
    });
    previous = index;
  }

  return bands;
}

/* ── Filters (shared by both tabs) ────────────────────────────────────── */

export type Filter = 'alle' | 'kommende' | 'færdige';

export const FILTER_LABELS: Record<Filter, string> = {
  alle: 'Alle',
  kommende: 'Kommende',
  færdige: 'Færdige',
};

/** Next `sort` value for an append into a given bucket. `sort` is an int, so
 *  there is no fractional insert — the checklist is append-only by design. */
export function nextSort(rows: Pick<TimelineTaskRow, 'sort'>[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort), -1) + 1;
}
