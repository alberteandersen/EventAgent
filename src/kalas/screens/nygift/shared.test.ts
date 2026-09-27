import { describe, it, expect } from 'vitest';
import { daysMarried } from './shared';

describe('daysMarried', () => {
  const today = new Date(2026, 8, 26, 14, 30); // 26 Sep 2026, mid-afternoon

  it('counts whole days since the date, ignoring the time of day', () => {
    expect(daysMarried('2026-09-12', today)).toBe(14);
    expect(daysMarried('2026-09-12T15:00:00', today)).toBe(14);
  });

  it('is zero on the day itself', () => {
    expect(daysMarried('2026-09-26', today)).toBe(0);
  });

  it('has nothing to say before the wedding, or without a date', () => {
    expect(daysMarried('2026-10-01', today)).toBeNull();
    expect(daysMarried(null, today)).toBeNull();
    expect(daysMarried('', today)).toBeNull();
    expect(daysMarried('sommer 2027', today)).toBeNull();
  });

  it('does not lose a day across a daylight-saving change', () => {
    // Danish clocks go back on 25 Oct 2026.
    expect(daysMarried('2026-10-20', new Date(2026, 9, 30, 9))).toBe(10);
  });
});
