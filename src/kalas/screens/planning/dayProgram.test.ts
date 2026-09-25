import { describe, expect, it } from 'vitest';
import {
  calendarRange, daySpan, formatDuration, formatProgramText, gapAfter, layoutLanes, shiftFrom, snapMinutes,
  sortByTime, statusOf, toHHMM,
} from './dayProgram';

const items = sortByTime([
  { time: '15:00' },
  { time: '14:00' },
  { time: '18:00' },
  { time: '16:00' },
]);
// sorted: 14:00, 15:00, 16:00, 18:00

describe('statusOf', () => {
  it('is always upcoming when it is not the wedding day, regardless of the clock', () => {
    for (const now of ['06:00', '14:00', '15:30', '23:59']) {
      expect(statusOf(items, 1, now, false)).toBe('upcoming');
    }
  });

  it('is upcoming before its own time', () => {
    expect(statusOf(items, 1, '14:30', true)).toBe('upcoming');
  });

  it('is now exactly at its own time, and between it and the next', () => {
    expect(statusOf(items, 1, '15:00', true)).toBe('now');
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

  it('never marks two moments as now at once, across a spread of times', () => {
    for (const now of ['06:00', '13:59', '14:00', '15:30', '17:00', '18:00', '23:59']) {
      const live = items.filter((_, i) => statusOf(items, i, now, true) === 'now');
      expect(live.length).toBeLessThanOrEqual(1);
    }
  });

  it('treats an after-midnight moment as the end of the night, not the start of it', () => {
    const night = sortByTime([{ time: '01:00' }, { time: '22:00' }, { time: '14:00' }]);
    expect(night.map((i) => i.time)).toEqual(['14:00', '22:00', '01:00']);
    // At half past midnight the 22:00 moment is over and the 01:00 one has not started.
    expect(statusOf(night, 1, '00:30', true)).toBe('now');
    expect(statusOf(night, 2, '00:30', true)).toBe('upcoming');
    // And at 01:15 the last one is running.
    expect(statusOf(night, 2, '01:15', true)).toBe('now');
    expect(statusOf(night, 1, '01:15', true)).toBe('done');
  });
});

describe('sortByTime', () => {
  it('sorts along the day without mutating the input', () => {
    const input = [{ time: '20:00' }, { time: '09:00' }];
    expect(sortByTime(input).map((i) => i.time)).toEqual(['09:00', '20:00']);
    expect(input.map((i) => i.time)).toEqual(['20:00', '09:00']);
  });
});

describe('gapAfter', () => {
  const withDuration = sortByTime([
    { time: '14:00', duration_min: 30 },
    { time: '15:00', duration_min: 45 },
    { time: '15:30', duration_min: 60 },
  ]);

  it('reports the hole between one moment ending and the next starting', () => {
    expect(gapAfter(withDuration, 0)).toBe(30); // 14:30 → 15:00
  });

  it('reports an overlap as a negative gap', () => {
    expect(gapAfter(withDuration, 1)).toBe(-15); // 15:45 runs into 15:30
  });

  it('is null for the last moment', () => {
    expect(gapAfter(withDuration, 2)).toBeNull();
  });
});

describe('daySpan', () => {
  it('is null for an empty day', () => {
    expect(daySpan([])).toBeNull();
  });

  it('spans from the first moment to the end of the last', () => {
    const span = daySpan([
      { time: '14:00', duration_min: 30 },
      { time: '18:00', duration_min: 150 },
    ]);
    expect(span).toMatchObject({ start: '14:00', end: '20:30', totalMin: 390, gaps: 1, overlaps: 0 });
  });

  it('counts overlaps separately from gaps', () => {
    const span = daySpan([
      { time: '14:00', duration_min: 90 },
      { time: '15:00', duration_min: 30 },
    ]);
    expect(span).toMatchObject({ gaps: 0, overlaps: 1 });
  });

  it('carries a past-midnight ending rather than wrapping the total to nothing', () => {
    const span = daySpan([{ time: '22:00', duration_min: 60 }, { time: '00:30', duration_min: 30 }]);
    expect(span).toMatchObject({ start: '22:00', end: '01:00', totalMin: 180 });
  });
});

describe('shiftFrom', () => {
  const withIds = sortByTime([
    { id: 'a', time: '14:00' },
    { id: 'b', time: '15:00' },
    { id: 'c', time: '18:00' },
  ]);

  it('pushes the chosen moment and everything after it', () => {
    expect(shiftFrom(withIds, 1, 20)).toEqual([
      { id: 'b', time: '15:20' },
      { id: 'c', time: '18:20' },
    ]);
  });

  it('pulls the day earlier with a negative delta', () => {
    expect(shiftFrom(withIds, 0, -15)[0]).toEqual({ id: 'a', time: '13:45' });
  });

  it('changes nothing at all for a zero shift', () => {
    expect(shiftFrom(withIds, 0, 0)).toEqual([]);
  });

  it('wraps past midnight instead of producing a 25th hour', () => {
    expect(shiftFrom([{ id: 'x', time: '23:30' }], 0, 60)).toEqual([{ id: 'x', time: '00:30' }]);
  });
});

describe('toHHMM', () => {
  it('pads and wraps', () => {
    expect(toHHMM(9 * 60 + 5)).toBe('09:05');
    expect(toHHMM(1500)).toBe('01:00');
    expect(toHHMM(-30)).toBe('23:30');
  });
});

describe('formatDuration', () => {
  it('reads as a human would say it', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1t');
    expect(formatDuration(150)).toBe('2t 30m');
  });
});

describe('formatProgramText', () => {
  it('carries duration, detail and owner into the shared version', () => {
    const text = formatProgramText([
      { time: '15:00', title: 'Ceremoni', subtitle: 'Olivenhaven', duration_min: 45, owner: 'Præst' },
      { time: '14:00', title: 'Gæsternes ankomst' },
    ]);
    expect(text).toBe('14:00  Gæsternes ankomst\n15:00  Ceremoni — 45 min · Olivenhaven · (Præst)');
  });

  it('prefixes a heading with a blank line when given', () => {
    expect(formatProgramText([{ time: '14:00', title: 'Ankomst' }], 'Bryllupsdagen'))
      .toBe('Bryllupsdagen\n\n14:00  Ankomst');
  });
});

describe('the day as a calendar', () => {
  const item = (id: string, time: string, duration_min = 0) => ({ id, time, duration_min });

  it('shows whole hours around the day, and an evening when it is empty', () => {
    expect(calendarRange([])).toEqual({ from: 840, to: 1440 });
    expect(calendarRange([item('a', '14:30', 45), item('b', '00:30', 45)])).toEqual({ from: 840, to: 1440 + 120 });
  });

  it('puts overlapping moments side by side and the rest full width', () => {
    const lanes = layoutLanes([
      item('arrive', '14:00', 45),
      item('photos', '16:00', 90),
      item('dinner', '17:00', 150),
      item('dance', '21:00', 30),
    ]);
    expect(lanes.get('arrive')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get('photos')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('dinner')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('dance')).toEqual({ lane: 0, lanes: 1 });
  });

  it('gives a moment without a length room enough to be seen', () => {
    const lanes = layoutLanes([item('speech', '19:00', 0), item('cake', '19:15', 15)]);
    expect(lanes.get('cake')).toEqual({ lane: 1, lanes: 2 });
  });

  it('snaps to five minutes', () => {
    expect(snapMinutes(903)).toBe(905);
    expect(snapMinutes(902)).toBe(900);
    expect(snapMinutes(907, 15)).toBe(900);
  });
});
