import { describe, expect, it } from 'vitest';
import { addDays, daysDiff, shiftPlan, todayISO } from './shared';

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
