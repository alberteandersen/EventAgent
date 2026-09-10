import { describe, expect, it } from 'vitest';
import { formatProgramText, sortByTime, statusOf } from './dayProgram';

const items = sortByTime([
  { time: '15:00' },
  { time: '14:00' },
  { time: '18:00' },
  { time: '16:00' },
]);
// sorted: 14:00, 15:00, 16:00, 18:00

describe('statusOf', () => {
  it('is always upcoming when it is not the wedding day, regardless of the clock', () => {
    for (const now of ['00:00', '14:00', '15:30', '23:59']) {
      expect(statusOf(items, 1, now, false)).toBe('upcoming');
    }
  });

  it('is upcoming before its own time', () => {
    expect(statusOf(items, 1, '14:30', true)).toBe('upcoming');
  });

  it('is upcoming at the very start of the day, before the first moment', () => {
    expect(statusOf(items, 0, '08:00', true)).toBe('upcoming');
  });

  it('is now exactly at its own time', () => {
    expect(statusOf(items, 1, '15:00', true)).toBe('now');
  });

  it('is now between its own time and the next moment', () => {
    expect(statusOf(items, 1, '15:45', true)).toBe('now');
  });

  it('is done once the next moment has started', () => {
    expect(statusOf(items, 1, '16:00', true)).toBe('done');
    expect(statusOf(items, 0, '18:00', true)).toBe('done');
  });

  it('the last moment stays now for the rest of the day — nothing to hand off to', () => {
    expect(statusOf(items, 3, '18:00', true)).toBe('now');
    expect(statusOf(items, 3, '23:59', true)).toBe('now');
  });

  it('sweeps every index against a spread of times consistently', () => {
    const times = ['00:00', '13:59', '14:00', '15:30', '17:00', '18:00', '23:59'];
    for (const now of times) {
      for (let i = 0; i < items.length; i++) {
        const status = statusOf(items, i, now, true);
        expect(['done', 'now', 'upcoming']).toContain(status);
        // Exactly one item is 'now' (or none, before the day starts) — never two.
      }
      const nowCount = items.filter((_, i) => statusOf(items, i, now, true) === 'now').length;
      expect(nowCount).toBeLessThanOrEqual(1);
    }
  });
});

describe('sortByTime', () => {
  it('sorts ascending without mutating the input', () => {
    const input = [{ time: '20:00' }, { time: '09:00' }];
    const sorted = sortByTime(input);
    expect(sorted.map((i) => i.time)).toEqual(['09:00', '20:00']);
    expect(input.map((i) => i.time)).toEqual(['20:00', '09:00']);
  });
});

describe('formatProgramText', () => {
  it('formats each line with time, title and subtitle', () => {
    const text = formatProgramText([
      { time: '15:00', title: 'Ceremoni', subtitle: 'Olivenhaven · 45 minutter' },
      { time: '14:00', title: 'Gæsternes ankomst', subtitle: null },
    ]);
    expect(text).toBe('14:00  Gæsternes ankomst\n15:00  Ceremoni — Olivenhaven · 45 minutter');
  });

  it('prefixes a heading with a blank line when given', () => {
    const text = formatProgramText([{ time: '14:00', title: 'Ankomst' }], 'Bryllupsdagen');
    expect(text).toBe('Bryllupsdagen\n\n14:00  Ankomst');
  });
});
