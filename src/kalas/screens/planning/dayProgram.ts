/* The wedding day itself, minute by minute — pure logic behind the
 * Bryllupsdagen tab, kept separate from the component so the "done / now /
 * upcoming" arithmetic can be tested without a clock, a session, or a DOM.
 *
 * Status only ever reads as anything but "upcoming" on the actual wedding
 * day — browsing next month's plan a year in advance should never show a
 * moment as "Nu" just because its time-of-day happens to match right now.
 */

export type ProgramStatus = 'done' | 'now' | 'upcoming';

export interface ProgramItemLike {
  time: string; // "HH:MM"
}

/**
 * The status of `items[index]` at `nowHHMM`, given the items are already
 * sorted ascending by time. A moment is "now" once its own time has passed
 * and the next moment's has not — the last moment stays "now" for the rest
 * of the day, since there is nothing after it to hand off to.
 */
export function statusOf(sortedItems: ProgramItemLike[], index: number, nowHHMM: string, isToday: boolean): ProgramStatus {
  if (!isToday) return 'upcoming';
  const item = sortedItems[index];
  const next = sortedItems[index + 1];
  if (nowHHMM < item.time) return 'upcoming';
  if (next && nowHHMM >= next.time) return 'done';
  return 'now';
}

/** Sorted ascending by time — every caller (rendering, statusOf, the copy/PDF
 *  export) needs the same order, so it lives in one place. */
export function sortByTime<T extends ProgramItemLike>(items: T[]): T[] {
  return [...items].sort((a, b) => a.time.localeCompare(b.time));
}

export interface ProgramItemText {
  time: string;
  title: string;
  subtitle?: string | null;
}

/** The plain-text block the Kopiér button copies to the clipboard. */
export function formatProgramText(items: ProgramItemText[], heading?: string): string {
  const lines = sortByTime(items).map((i) =>
    i.subtitle ? `${i.time}  ${i.title} — ${i.subtitle}` : `${i.time}  ${i.title}`,
  );
  return heading ? [heading, '', ...lines].join('\n') : lines.join('\n');
}
