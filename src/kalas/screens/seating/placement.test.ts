import { describe, expect, it } from 'vitest';
import { findFreeSpot, occupied } from './placement';
import { tableBounds, type SeatingPlan, type SeatingTable } from './model';

const table = (id: string, x: number, y: number): SeatingTable =>
  ({ id, name: id, shape: 'round', seats: 8, x, y, seated: Array(8).fill(null) });

const FRAME = { x: 0, y: 0, w: 1700, h: 1100 }; // a desktop canvas at 50%

describe('findFreeSpot', () => {
  it('puts the first piece near the top left of what is visible', () => {
    const spot = findFreeSpot({ version: 2, tables: [] }, { w: 200, h: 200 }, FRAME);
    expect(spot).toEqual({ x: 140, y: 140 });
  });

  it('keeps clear of what is already there', () => {
    const plan: SeatingPlan = { version: 2, tables: [table('a', 260, 260), table('b', 620, 260)] };
    const size = tableBounds(table('new', 0, 0));
    const spot = findFreeSpot(plan, size, FRAME)!;
    const box = { x: spot.x - size.w / 2, y: spot.y - size.h / 2, w: size.w, h: size.h };
    for (const o of occupied(plan)) {
      const apart = box.x >= o.x + o.w || o.x >= box.x + box.w || box.y >= o.y + o.h || o.y >= box.y + box.h;
      expect(apart).toBe(true);
    }
    // Still inside the frame, so nothing has to zoom.
    expect(box.x + box.w).toBeLessThanOrEqual(FRAME.w);
    expect(box.y + box.h).toBeLessThanOrEqual(FRAME.h);
  });

  it('looks inside the part of the plan that is scrolled into view', () => {
    const spot = findFreeSpot({ version: 2, tables: [] }, { w: 100, h: 100 }, { x: 800, y: 400, w: 600, h: 400 })!;
    expect(spot.x).toBeGreaterThanOrEqual(800);
    expect(spot.y).toBeGreaterThanOrEqual(400);
  });

  it('says so when there is no room left in the frame', () => {
    const plan: SeatingPlan = { version: 2, tables: [table('a', 200, 200)] };
    expect(findFreeSpot(plan, { w: 200, h: 200 }, { x: 0, y: 0, w: 420, h: 420 })).toBeNull();
  });
});
