/* The wedding day itself, minute by minute — pure logic behind the
 * Bryllupsdagen tab, kept out of the component so the arithmetic can be
 * tested without a clock, a session, or a DOM.
 *
 * Two things here are easy to get wrong and are the reason this is a module
 * and not a handful of inline expressions:
 *
 *  1. A wedding runs past midnight. "01:00 Natmad" belongs at the END of the
 *     day, not sorted first — so ordering runs on `sortKey`, which pushes
 *     anything before DAY_START into the following night.
 *  2. Status only ever reads as anything but "upcoming" on the actual wedding
 *     day. Browsing next June's plan today should never claim a moment is
 *     happening right now just because the wall clock matches.
 */

export type ProgramStatus = 'done' | 'now' | 'upcoming';

export interface ProgramItemLike {
  time: string; // "HH:MM"
  duration_min?: number;
}

/** Anything earlier than this belongs to the night after the wedding, not the
 *  morning before it. 05:00 is late enough for a 04:00 last dance and early
 *  enough that a 06:00 hair appointment still reads as the morning it is. */
const DAY_START_MIN = 5 * 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

export function toHHMM(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Minutes from the start of the wedding day, with after-midnight times
 *  carried past 1440 so they sort and compare last. */
export function sortKey(hhmm: string): number {
  const min = toMinutes(hhmm);
  return min < DAY_START_MIN ? min + 1440 : min;
}

/** Sorted along the day, not by string — see sortKey. Never mutates. */
export function sortByTime<T extends ProgramItemLike>(items: T[]): T[] {
  return [...items].sort((a, b) => sortKey(a.time) - sortKey(b.time));
}

/** When a moment is over, on the same carried scale as sortKey. */
export function endKey(item: ProgramItemLike): number {
  return sortKey(item.time) + Math.max(0, item.duration_min ?? 0);
}

/**
 * The status of `sortedItems[index]` at `nowHHMM`. A moment is "now" once its
 * own time has passed and the next one's has not — the last moment stays "now"
 * for the rest of the day, since there is nothing after it to hand off to.
 */
export function statusOf(sortedItems: ProgramItemLike[], index: number, nowHHMM: string, isToday: boolean): ProgramStatus {
  if (!isToday) return 'upcoming';
  const now = sortKey(nowHHMM);
  const item = sortedItems[index];
  const next = sortedItems[index + 1];
  if (now < sortKey(item.time)) return 'upcoming';
  if (next && now >= sortKey(next.time)) return 'done';
  return 'now';
}

/** Minutes between the end of `sortedItems[i]` and the start of the next one.
 *  Negative means they overlap. Null when there is no next moment. */
export function gapAfter(sortedItems: ProgramItemLike[], i: number): number | null {
  const next = sortedItems[i + 1];
  if (!next) return null;
  return sortKey(next.time) - endKey(sortedItems[i]);
}

export interface DaySpan {
  start: string;
  end: string;
  totalMin: number;
  gaps: number;
  overlaps: number;
}

/** The shape of the whole day: when it starts, when the last moment ends, how
 *  long that is, and how many seams have a hole or a collision in them. */
export function daySpan(items: ProgramItemLike[]): DaySpan | null {
  if (items.length === 0) return null;
  const sorted = sortByTime(items);
  const startKey = sortKey(sorted[0].time);
  const lastEnd = Math.max(...sorted.map(endKey));
  let gaps = 0;
  let overlaps = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = gapAfter(sorted, i);
    if (gap == null) continue;
    if (gap > 0) gaps += 1;
    else if (gap < 0) overlaps += 1;
  }
  return {
    start: sorted[0].time,
    end: toHHMM(lastEnd),
    totalMin: Math.max(0, lastEnd - startKey),
    gaps,
    overlaps,
  };
}

/** "45 min", "1t", "2t 30m" — never "0 min", which reads as an error. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours}t` : `${hours}t ${rest}m`;
}

/**
 * Push `sortedItems[fromIndex]` and everything after it by `deltaMin` — the
 * run-of-show move: the ceremony starts twenty minutes late, and the whole
 * rest of the evening slides with it rather than being re-typed row by row.
 * Returns only the rows whose time actually changes.
 */
export function shiftFrom(
  sortedItems: (ProgramItemLike & { id: string })[],
  fromIndex: number,
  deltaMin: number,
): { id: string; time: string }[] {
  if (deltaMin === 0) return [];
  return sortedItems.slice(fromIndex).map((item) => ({
    id: item.id,
    time: toHHMM(toMinutes(item.time) + deltaMin),
  }));
}

export interface ProgramItemText {
  time: string;
  title: string;
  subtitle?: string | null;
  duration_min?: number;
  owner?: string | null;
}

/** The plain-text block the Kopiér button puts on the clipboard — the version
 *  that gets pasted into a message to the photographer. */
export function formatProgramText(items: ProgramItemText[], heading?: string): string {
  const lines = sortByTime(items).map((i) => {
    const meta = [
      i.duration_min ? formatDuration(i.duration_min) : '',
      i.subtitle ?? '',
      i.owner ? `(${i.owner})` : '',
    ].filter(Boolean).join(' · ');
    return meta ? `${i.time}  ${i.title} — ${meta}` : `${i.time}  ${i.title}`;
  });
  return heading ? [heading, '', ...lines].join('\n') : lines.join('\n');
}
