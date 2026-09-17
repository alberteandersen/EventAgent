import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM, ZOOMS, fitZoom, planExtent, stepZoom } from './zoom';
import type { SeatingPlan } from './model';

describe('stepZoom', () => {
  it('steps from the nearest stop, even off a stop', () => {
    expect(stepZoom(0.5, -1)).toBe(0.35);
    expect(stepZoom(0.52, 1)).toBe(0.65);
    expect(stepZoom(ZOOMS[0], -1)).toBe(ZOOMS[0]);
  });
});

describe('planExtent', () => {
  it('reaches the outermost chair or element', () => {
    const plan: SeatingPlan = {
      version: 2,
      tables: [{ id: 't', name: 'Bord 1', shape: 'round', seats: 8, x: 300, y: 300, seated: Array(8).fill(null) }],
      elements: [{ id: 'e', kind: 'kage', label: 'Kage', x: 1400, y: 200, w: 120, h: 120 }],
    };
    const ext = planExtent(plan);
    expect(ext.right).toBe(1460);
    expect(ext.bottom).toBeGreaterThan(300);
  });

  it('is zero for an empty plan', () => {
    expect(planExtent({ version: 2, tables: [] })).toEqual({ right: 0, bottom: 0 });
  });
});

describe('fitZoom', () => {
  const viewport = { w: 800, h: 568 };

  it('keeps the zoom when everything already shows', () => {
    expect(fitZoom({ right: 900, bottom: 600 }, viewport, DEFAULT_ZOOM)).toBe(DEFAULT_ZOOM);
  });

  it('steps out just far enough for a table put beyond the edge', () => {
    // 1900 wide at 0.5 is 970px, past 800; at 0.35 it is 679px and fits.
    expect(fitZoom({ right: 1900, bottom: 600 }, viewport, 0.5)).toBe(0.35);
  });

  it('never zooms in, however much room there is', () => {
    expect(fitZoom({ right: 100, bottom: 100 }, viewport, 0.35)).toBe(0.35);
  });

  it('stops at the furthest stop for a plan too big to fit', () => {
    expect(fitZoom({ right: 9000, bottom: 9000 }, viewport, 0.5)).toBe(ZOOMS[0]);
  });
});
