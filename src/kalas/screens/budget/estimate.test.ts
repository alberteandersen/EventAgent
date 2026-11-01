import { describe, it, expect } from 'vitest';
import { budgetLines } from '@/lib/budget/benchmarks';
import { EN } from '../../strings';
import {
  estimatedTotal, estimatedLines, DK_AVG_PER_GUEST, venueBudget,
  LEGACY_VENUE_LABEL, rentalSplit, subItemSuggestions, subItemSeeds, SUGGESTED_SUB_ITEMS,
} from './estimate';

describe('estimatedTotal', () => {
  it('uses the couple’s own number when they gave one', () => {
    expect(estimatedTotal(250000, 80)).toBe(250000);
  });

  it('falls back to the headcount, rounded to the nearest 10.000', () => {
    // 80 × 1850 = 148.000 → 150.000
    expect(estimatedTotal(0, 80)).toBe(150000);
    expect(estimatedTotal(0, 1)).toBe(0); // 1850 rounds down to nothing
    expect(estimatedTotal(0, 50)).toBe(90000); // 92.500 → 90.000
  });

  it('is zero when we know neither, so nothing gets seeded', () => {
    expect(estimatedTotal(0, 0)).toBe(0);
  });

  it('keeps the per-guest average in one place', () => {
    expect(estimatedTotal(0, 100)).toBe(Math.round((100 * DK_AVG_PER_GUEST) / 10000) * 10000);
  });
});

describe('estimatedLines', () => {
  it('returns one row per benchmark line, in order', () => {
    const lines = estimatedLines(200000);
    expect(lines).toHaveLength(budgetLines.length);
    expect(lines.map((l) => l.category)).toEqual(budgetLines.map((b) => b.id));
    expect(lines.map((l) => l.sort)).toEqual(budgetLines.map((_, i) => i));
  });

  it('splits the whole total, give or take rounding', () => {
    const total = 250000;
    const sum = estimatedLines(total).reduce((n, l) => n + l.planned_amount, 0);
    expect(Math.abs(sum - total)).toBeLessThanOrEqual(budgetLines.length);
  });

  it('carries the styling, so a seeded line does not look like Juno added it', () => {
    // Rows saved without icon/color fall back to a generic sparkle in Budget.tsx.
    for (const line of estimatedLines(100000)) {
      expect(line.icon).toBeTruthy();
      expect(line.color).toMatch(/^#/);
    }
  });

  it('is all zeroes at a zero total rather than throwing', () => {
    expect(estimatedLines(0).every((l) => l.planned_amount === 0)).toBe(true);
  });
});

describe('budgetLines', () => {
  it('adds up to a whole budget', () => {
    expect(budgetLines.reduce((n, b) => n + b.pct, 0)).toBe(100);
  });
});

describe('venueBudget', () => {
  it('uses the line the couple actually allocated', () => {
    const items = [
      { category: 'venue', planned_amount: 72_500 },
      { category: 'catering', planned_amount: 74_250 },
    ];
    // Not the 275.000 total — that would let a venue eat the whole wedding.
    expect(venueBudget(items, 275_000)).toBe(72_500);
  });

  it('falls back to the benchmark share, never the total', () => {
    expect(venueBudget([], 300_000)).toBe(78_000); // 26%
    expect(venueBudget([{ category: 'catering', planned_amount: 80_000 }], 300_000)).toBe(78_000);
  });

  it('ignores a venue line set to zero', () => {
    expect(venueBudget([{ category: 'venue', planned_amount: 0 }], 300_000)).toBe(78_000);
  });

  it('is null when there is no budget to work from', () => {
    expect(venueBudget([], 0)).toBeNull();
    expect(venueBudget([{ category: 'venue', planned_amount: 0 }], 0)).toBeNull();
  });
});

describe('rentalSplit', () => {
  const legacy = [
    { category: 'venue', label: LEGACY_VENUE_LABEL, sort: 0 },
    { category: 'catering', label: 'Mad & drikke', sort: 1 },
    { category: 'photo', label: 'Foto & film', sort: 2 },
  ];

  it('adds hire straight under the venue, at nothing', () => {
    const split = rentalSplit(legacy);
    expect(split?.rental).toMatchObject({ category: 'rental', label: 'Leje & udstyr', planned_amount: 0, sort: 1 });
    expect(split?.rental.icon).toBe('tent');
  });

  it('moves every line below the venue down one place', () => {
    expect(rentalSplit(legacy)?.shifted).toEqual([
      { category: 'catering', label: 'Mad & drikke', sort: 2 },
      { category: 'photo', label: 'Foto & film', sort: 3 },
    ]);
  });

  it('leaves a budget alone once it has a hire line', () => {
    expect(rentalSplit([...legacy, { category: 'rental', label: 'Leje', sort: 9 }])).toBeNull();
  });

  it('leaves a venue line the couple renamed alone', () => {
    expect(rentalSplit([{ category: 'venue', label: 'Slottet', sort: 0 }])).toBeNull();
  });

  it('does nothing without a venue line', () => {
    expect(rentalSplit([])).toBeNull();
    expect(rentalSplit(legacy.slice(1))).toBeNull();
  });
});

describe('subItemSuggestions', () => {
  it('offers the common hire posts', () => {
    expect(subItemSuggestions('rental', [])).toContain('Telt');
  });

  it('skips a post the category already has, whatever the case', () => {
    expect(subItemSuggestions('rental', [{ label: ' telt ' }])).not.toContain('Telt');
  });

  it('is empty for a category without suggestions', () => {
    expect(subItemSuggestions('custom-1', [])).toEqual([]);
  });

  it('has suggestions for every standard category, all in English too', () => {
    for (const line of budgetLines) expect(SUGGESTED_SUB_ITEMS[line.id]?.length, line.id).toBeGreaterThan(0);
    for (const label of Object.values(SUGGESTED_SUB_ITEMS).flat()) expect(EN[label], label).toBeTruthy();
  });
});

describe('subItemSeeds', () => {
  it('adds the usual posts to a category that never had them, at 0 kr', () => {
    const { rows, categories } = subItemSeeds([{ category: 'photo', sub_items_seeded: false }], []);
    expect(rows.map((r) => r.label)).toEqual(['Fotograf', 'Videograf', 'Fotoboks']);
    expect(rows.every((r) => r.amount === 0)).toBe(true);
    expect(categories).toEqual(['photo']);
  });

  it('skips posts the category already has, and sorts after them', () => {
    const { rows } = subItemSeeds(
      [{ category: 'photo', sub_items_seeded: false }],
      [{ category: 'photo', label: 'fotograf' }],
    );
    expect(rows).toEqual([
      { category: 'photo', label: 'Videograf', amount: 0, sort: 1 },
      { category: 'photo', label: 'Fotoboks', amount: 0, sort: 2 },
    ]);
  });

  it('never seeds a category twice', () => {
    expect(subItemSeeds([{ category: 'photo', sub_items_seeded: true }], [])).toEqual({ rows: [], categories: [] });
  });

  it('does nothing on a database older than the flag', () => {
    expect(subItemSeeds([{ category: 'photo' }], [])).toEqual({ rows: [], categories: [] });
  });

  it('marks a custom category done without adding anything', () => {
    expect(subItemSeeds([{ category: 'custom-1', sub_items_seeded: false }], [])).toEqual({ rows: [], categories: ['custom-1'] });
  });
});
