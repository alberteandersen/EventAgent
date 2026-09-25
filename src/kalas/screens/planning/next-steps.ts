/* "Det næste": the handful of things the Overblik tab puts in front of the
   couple, out of fourteen milestones and two hundred checklist items. In
   order: what is late, what the rest of the app says is already done (a tick
   away), the milestones coming up soon, then the checklist items that belong
   to this phase, earliest first. */

import type { TimelineTaskRow } from '@/lib/db/types';
import { PHASES, currentPhase, isDueBy, phaseOf, type Phase } from './checklist-data';
import { daysDiff, isCheck, isMilestone } from './shared';

export type NextStepWhy = 'overdue' | 'looks-done' | 'soon' | 'phase';

export interface NextStep {
  row: TimelineTaskRow;
  why: NextStepWhy;
  /** For 'looks-done': the reason, a Danish source string. */
  reason?: string;
  /** For a checklist item: its phase, when it has one. */
  phase?: Phase | null;
}

/** How far ahead a milestone counts as coming up soon. */
export const SOON_DAYS = 45;

export function nextSteps(
  rows: TimelineTaskRow[],
  opts: {
    today: string;
    weddingISO: string | null;
    /** Why a milestone looks done already, or null (see planning-signals). */
    looksDone: (title: string) => string | null;
    limit?: number;
  },
): NextStep[] {
  const limit = opts.limit ?? 5;
  const open = rows.filter((r) => !r.done && r.category !== 'wedding_day');
  const byDate = (a: TimelineTaskRow, b: TimelineTaskRow) => (a.due_date ?? '').localeCompare(b.due_date ?? '');
  const out: NextStep[] = [];
  const taken = new Set<string>();
  const add = (step: NextStep) => {
    if (out.length >= limit || taken.has(step.row.id)) return;
    taken.add(step.row.id);
    out.push(step);
  };

  // 1. Late: anything with a date that has passed, milestone or dated check.
  for (const r of open.filter((r) => r.due_date && r.due_date < opts.today).sort(byDate)) {
    const reason = isMilestone(r) ? opts.looksDone(r.title) : null;
    add(reason ? { row: r, why: 'looks-done', reason } : { row: r, why: 'overdue' });
  }

  // 2. Done in all but the tick.
  for (const r of open.filter(isMilestone).sort(byDate)) {
    const reason = opts.looksDone(r.title);
    if (reason) add({ row: r, why: 'looks-done', reason });
  }

  // 3. Coming up: the next milestone however far off, so there is always
  //    something ahead to see, and any other date within SOON_DAYS.
  const ahead = open.filter((r) => r.due_date && r.due_date >= opts.today).sort(byDate);
  ahead.forEach((r, i) => {
    if (i === 0 || daysDiff(r.due_date!, opts.today) <= SOON_DAYS) add({ row: r, why: 'soon' });
  });

  // 4. The checklist for this phase and any earlier one still open. Without
  //    a date there is no "now": start from the beginning of the plan.
  const now = opts.weddingISO ? currentPhase(daysDiff(opts.weddingISO, opts.today)) : PHASES[0].id;
  const rank = (p: Phase) => PHASES.findIndex((x) => x.id === p);
  const checks = open
    .filter(isCheck)
    .map((r) => ({ r, phase: phaseOf(r.title) }))
    .filter((x): x is { r: TimelineTaskRow; phase: Phase } => x.phase !== null && isDueBy(x.phase, now))
    .sort((a, b) => rank(a.phase) - rank(b.phase) || a.r.sort - b.r.sort);
  for (const { r, phase } of checks) add({ row: r, why: 'phase', phase });

  return out;
}
