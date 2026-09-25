/* The plan, phase by phase: the one view that holds the milestones and the
   checklist together. Every row, milestone or to-do, is placed in one of the
   guide's phases (12–18 måneder før … Efter brylluppet), so a couple sees the
   big thing and the small things for the same stretch of time side by side,
   instead of a timeline of fourteen and a checklist of two hundred. */

import type { TimelineTaskRow } from '@/lib/db/types';
import { PHASES, currentPhase, phaseOf, type Phase } from './checklist-data';
import { CHECKLIST_AREAS, addDays, areaOf, daysDiff, isCheck, isMilestone } from './shared';

/** How far back the first phase is drawn: eighteen months. */
const FIRST_PHASE_DAYS = 548;

/** Where the couple is: by their date, or the start of the plan without one. */
export function phaseNow(weddingISO: string | null, today: string): Phase {
  return weddingISO ? currentPhase(daysDiff(weddingISO, today)) : PHASES[0].id;
}

/**
 * The phase a row belongs to. A date wins, since the couple put it there or
 * it is a milestone laid out from the wedding day. A default checklist item
 * without one goes by its seeded phase. Anything else, an item of their own
 * with no date, sits in `fallback`: the phase they are in now, where they
 * will see it.
 */
export function phaseOfRow(
  row: Pick<TimelineTaskRow, 'title' | 'due_date' | 'category' | 'kind'>,
  weddingISO: string | null,
  fallback: Phase,
): Phase {
  if (row.category === 'wedding_day') return 'dagen';
  if (row.due_date && weddingISO) return currentPhase(daysDiff(weddingISO, row.due_date));
  return (isCheck(row) ? phaseOf(row.title) : null) ?? fallback;
}

/** The calendar dates a phase covers, for a heading like "okt. 2026 – jan. 2027". */
export function phaseWindow(phase: Phase, weddingISO: string): { from: string; to: string } {
  if (phase === 'efter') return { from: addDays(weddingISO, 1), to: addDays(weddingISO, 60) };
  const i = PHASES.findIndex((p) => p.id === phase);
  const upper = i === 0 ? FIRST_PHASE_DAYS : PHASES[i - 1].minDays; // days left, exclusive
  const lower = PHASES[i].minDays; // days left, inclusive
  return { from: addDays(weddingISO, -(upper - 1)), to: addDays(weddingISO, -lower) };
}

export interface PhaseGroup<T> {
  phase: Phase;
  /** The big dated moments, in date order. */
  milestones: T[];
  /** The to-dos, in area order and then the couple's own order. */
  todos: T[];
  done: number;
  total: number;
}

/** Every phase with what belongs to it, in plan order (empty ones included,
 *  so the phase bar always has all its steps). */
export function planByPhase<T extends TimelineTaskRow>(
  rows: T[],
  weddingISO: string | null,
  today: string,
): PhaseGroup<T>[] {
  const now = phaseNow(weddingISO, today);
  const groups = new Map<Phase, PhaseGroup<T>>(
    PHASES.map((p) => [p.id, { phase: p.id, milestones: [], todos: [], done: 0, total: 0 }]),
  );
  for (const row of rows) {
    const g = groups.get(phaseOfRow(row, weddingISO, now))!;
    (isMilestone(row) ? g.milestones : g.todos).push(row);
    g.total += 1;
    if (row.done) g.done += 1;
  }
  const areaRank = new Map(CHECKLIST_AREAS.map((a, i) => [a.id, i]));
  for (const g of groups.values()) {
    g.milestones.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.sort - b.sort);
    g.todos.sort((a, b) => (areaRank.get(areaOf(a))! - areaRank.get(areaOf(b))!) || a.sort - b.sort);
  }
  return [...groups.values()];
}
