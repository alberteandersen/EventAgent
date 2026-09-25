import { describe, expect, it } from 'vitest';
import { addDays, buildTimelineBands, daysDiff, shiftPlan, todayISO } from './shared';

type Item = { id: string; dateISO: string | null };
const at = (id: string, dateISO: string | null): Item => ({ id, dateISO });

/** Bands as a compact shape, so the assertions read like the rendered spine. */
function shape(bands: ReturnType<typeof buildTimelineBands<Item>>) {
  return bands.map((b) =>
    b.kind === 'gap' ? `gap:${b.months}` : `${b.key}:${b.items.map((i) => i.id).join(',')}`,
  );
}

describe('buildTimelineBands', () => {
  it('returns nothing when no task carries a date', () => {
    expect(buildTimelineBands([at('a', null), at('b', null)], '2026-08-26')).toEqual([]);
  });

  it('groups tasks into the month they fall in', () => {
    const bands = buildTimelineBands(
      [at('a', '2026-08-03'), at('b', '2026-08-20'), at('c', '2026-09-01')],
      '2026-08-26',
    );
    expect(shape(bands)).toEqual(['2026-08:a,b', '2026-09:c']);
  });

  it('collapses the empty months between two bands into one gap', () => {
    const bands = buildTimelineBands([at('a', '2026-08-10'), at('b', '2027-01-12')], '2026-08-26');
    // Sep, Oct, Nov, Dec — four months of nothing planned.
    expect(shape(bands)).toEqual(['2026-08:a', 'gap:4', '2027-01:b']);
  });

  it('puts no gap between adjacent months', () => {
    const bands = buildTimelineBands([at('a', '2026-08-10'), at('b', '2026-09-02')], '2026-08-26');
    expect(shape(bands)).toEqual(['2026-08:a', '2026-09:b']);
  });

  it('gives today a band of its own even when that month is empty', () => {
    const bands = buildTimelineBands([at('a', '2026-06-10'), at('b', '2026-12-12')], '2026-08-26');
    expect(shape(bands)).toEqual(['2026-06:a', 'gap:1', '2026-08:', 'gap:3', '2026-12:b']);
  });

  it('marks how many of the tasks in a month fall before today', () => {
    const bands = buildTimelineBands(
      [at('a', '2026-08-01'), at('b', '2026-08-20'), at('c', '2026-08-30')],
      '2026-08-26',
    );
    const august = bands[0];
    expect(august.kind).toBe('month');
    if (august.kind === 'month') expect(august.todayIndex).toBe(2);
  });

  it('leaves todayIndex null on every month but the current one', () => {
    const bands = buildTimelineBands([at('a', '2026-09-01'), at('b', '2026-10-01')], '2026-08-26');
    const months = bands.filter((b) => b.kind === 'month');
    expect(months.filter((b) => b.kind === 'month' && b.todayIndex !== null)).toHaveLength(1);
  });

  it('extends the range when today is past the last dated task', () => {
    const bands = buildTimelineBands([at('a', '2026-05-10')], '2026-08-26');
    expect(shape(bands)).toEqual(['2026-05:a', 'gap:2', '2026-08:']);
  });

  it('counts a year-crossing gap in months, not in calendar years', () => {
    const bands = buildTimelineBands([at('a', '2026-11-10'), at('b', '2027-02-10')], '2026-11-01');
    expect(shape(bands)).toEqual(['2026-11:a', 'gap:2', '2027-02:b']);
  });

  it('ignores undated tasks rather than bunching them into a month', () => {
    const bands = buildTimelineBands(
      [at('a', '2026-08-10'), at('x', null), at('b', '2026-08-11')],
      '2026-08-26',
    );
    expect(shape(bands)).toEqual(['2026-08:a,b']);
  });
});

describe('todayISO', () => {
  it('reports the local calendar day, not a UTC-shifted one', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayISO()).toBe(expected);
  });
});

describe('daysDiff', () => {
  it('counts calendar days in both directions', () => {
    expect(daysDiff('2026-08-26', '2026-08-26')).toBe(0);
    expect(daysDiff('2026-08-27', '2026-08-26')).toBe(1);
    expect(daysDiff('2026-08-25', '2026-08-26')).toBe(-1);
  });

  it('counts across a month and a year boundary', () => {
    expect(daysDiff('2026-09-01', '2026-08-26')).toBe(6);
    expect(daysDiff('2027-01-01', '2026-12-25')).toBe(7);
  });

  it('stays whole across a DST change', () => {
    // Denmark falls back on 25 October 2026 — a 25-hour day.
    expect(daysDiff('2026-10-26', '2026-10-24')).toBe(2);
  });

  it('defaults to today, so a past date is negative', () => {
    expect(daysDiff('2000-01-01')).toBeLessThan(0);
  });
});

describe('shiftPlan', () => {
  const row = (id: string, due_date: string | null, extra: { done?: boolean; category?: string | null } = {}) =>
    ({ id, due_date, done: extra.done ?? false, category: extra.category ?? null });

  it('moves every open dated row by the same number of days, and the day itself onto the new date', () => {
    const rows = [
      row('venue', '2026-09-11'),
      row('photo', '2026-11-11'),
      row('day', '2027-09-11', { category: 'wedding_day' }),
    ];
    // Three months earlier: 2027-09-11 → 2027-06-12 is 91 days.
    expect(shiftPlan(rows, '2027-09-11', '2027-06-12')).toEqual([
      { id: 'venue', due_date: '2026-06-12' },
      { id: 'photo', due_date: '2026-08-12' },
      { id: 'day', due_date: '2027-06-12' },
    ]);
  });

  it('leaves ticked-off and undated rows where they are', () => {
    const rows = [
      row('budget', '2026-07-11', { done: true }),
      row('someday', null),
      row('day', '2027-09-11', { category: 'wedding_day' }),
    ];
    expect(shiftPlan(rows, '2027-09-11', '2027-10-02')).toEqual([{ id: 'day', due_date: '2027-10-02' }]);
  });

  it('counts calendar days across a daylight-saving change', () => {
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-10-30', 2)).toBe('2027-11-01');
    expect(daysDiff('2027-06-12', '2027-09-11')).toBe(-91);
  });
});
