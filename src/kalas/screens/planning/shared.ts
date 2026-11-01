import type { LucideIcon } from 'lucide-react';
import {
  Building2, Church, UtensilsCrossed, Shirt, Mail, Scale, PartyPopper,
  HeartHandshake, CircleDashed, Wallet, Camera, Users, CalendarClock,
} from 'lucide-react';
import type { TaskAssignee, TaskKind, TaskPriority, TimelineTaskRow } from '@/lib/db/types';
import type { ScreenId } from '../../Shell';
import type { HubCat, HubTab } from '../team/shared';

/* ── Tabs ─────────────────────────────────────────────────────────────── */

export type PlanTab = 'planen' | 'bryllupsdagen';

const PLAN_TAB_KEY = 'kalas_planning_tab';
const PLAN_TABS: PlanTab[] = ['planen', 'bryllupsdagen'];

export function readPlanTab(): PlanTab {
  if (typeof window === 'undefined') return 'planen';
  const stored = sessionStorage.getItem(PLAN_TAB_KEY);
  return (PLAN_TABS as string[]).includes(stored ?? '') ? (stored as PlanTab) : 'planen';
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

/* ── Where a milestone is done ─────────────────────────────────────────── */

export type MilestoneAction =
  | { kind: 'screen'; label: string; screen: ScreenId; hub?: { tab: HubTab; cat?: HubCat } }
  | { kind: 'guide'; label: string; slug: string };

/** The screen (or guide) each default milestone is carried out on, so an
 *  overdue "Book venue" leads to the venues instead of just turning red.
 *  Keyed on the seeded titles, like MILESTONE_AREA in milestones.ts; the
 *  labels are Danish source strings for t(). */
export const MILESTONE_ACTIONS: Record<string, MilestoneAction> = {
  'Sæt budget & gæsteliste': { kind: 'screen', label: 'Åbn budgettet', screen: 'budget' },
  'Book venue': { kind: 'screen', label: 'Find lokaler', screen: 'team', hub: { tab: 'explore', cat: 'venue' } },
  'Save-the-dates': { kind: 'screen', label: 'Åbn invitationer', screen: 'invites' },
  'Book fotograf': { kind: 'screen', label: 'Find fotograf', screen: 'team', hub: { tab: 'explore', cat: 'fotografi' } },
  'Florist & dekoration': { kind: 'screen', label: 'Find florist', screen: 'team', hub: { tab: 'explore', cat: 'blomster' } },
  'Musik / DJ / band': { kind: 'screen', label: 'Find musik', screen: 'team', hub: { tab: 'explore', cat: 'musik' } },
  'Kage & dessert': { kind: 'screen', label: 'Find konditor', screen: 'team', hub: { tab: 'explore', cat: 'kage' } },
  'Vielsesattest & jura': { kind: 'guide', label: 'Sådan bliver I gift', slug: 'saadan-bliver-i-gift' },
  'Bordplan & menu låst': { kind: 'screen', label: 'Åbn bordplanen', screen: 'seating' },
  'Invitationer sendt': { kind: 'screen', label: 'Åbn invitationer', screen: 'invites' },
  'Koordinering med leverandører': { kind: 'screen', label: 'Åbn indbakken', screen: 'inbox' },
};

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
 * 'wedding_day' sentinel, or with Juno's free-text category must stay off the
 * checklist rather than pile up under Øvrigt.
 */
export function hasArea(row: Pick<TimelineTaskRow, 'category'>): boolean {
  return row.category != null && AREA_IDS.has(row.category);
}

/* ── Priority & who has it ────────────────────────────────────────────── */

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Mellem' },
  { id: 'high', label: 'Høj' },
];

/** Never trust the column, same as `kindOf`: anything else reads as unset. */
export function priorityOf(row: Pick<TimelineTaskRow, 'priority'>): TaskPriority | null {
  return PRIORITIES.some((p) => p.id === row.priority) ? (row.priority as TaskPriority) : null;
}

/**
 * Who a task is on, in words, or null when nobody has it. The couple is passed
 * in rather than read, so the stored 'a'/'b' follow a rename in Settings; an
 * empty name falls back to "Dig"/"Din partner" instead of a blank chip.
 */
export function assigneeName(
  assignee: TaskAssignee | null | undefined,
  couple: { a: string; b: string },
): string | null {
  if (assignee === 'a') return couple.a.trim() || 'Dig';
  if (assignee === 'b') return couple.b.trim() || 'Din partner';
  if (assignee === 'both') return 'Begge';
  return null;
}

/** One or two letters for the row's chip: "E", "F", or "EF" for both. */
export function assigneeInitials(
  assignee: TaskAssignee | null | undefined,
  couple: { a: string; b: string },
): string | null {
  const first = (name: string, fallback: string) => (name.trim()[0] ?? fallback).toUpperCase();
  if (assignee === 'a') return first(couple.a, 'D');
  if (assignee === 'b') return first(couple.b, 'P');
  if (assignee === 'both') return first(couple.a, 'D') + first(couple.b, 'P');
  return null;
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

/** `dateISO` moved by `days`, counted on the calendar (noon UTC, so a
 *  daylight-saving change can never tip it onto the neighbouring day). */
export function addDays(dateISO: string, days: number): string {
  const t = new Date(`${dateISO}T12:00:00Z`).getTime() + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The plan follows the wedding when the couple moves it. Every date still
 * ahead of them (not done, has a date) moves by the same number of days, so
 * "book the photographer ten months out" stays ten months out; "Jeres dag"
 * lands on the new date itself. Ticked-off rows keep the date they were done
 * by. Returns only the rows whose date changes.
 */
export function shiftPlan(
  rows: Pick<TimelineTaskRow, 'id' | 'due_date' | 'done' | 'category'>[],
  fromISO: string,
  toISO: string,
): { id: string; due_date: string }[] {
  const days = daysDiff(toISO, fromISO);
  const out: { id: string; due_date: string }[] = [];
  for (const r of rows) {
    if (r.category === 'wedding_day') {
      if (r.due_date !== toISO) out.push({ id: r.id, due_date: toISO });
    } else if (!r.done && r.due_date && days !== 0) {
      out.push({ id: r.id, due_date: addDays(r.due_date, days) });
    }
  }
  return out;
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
