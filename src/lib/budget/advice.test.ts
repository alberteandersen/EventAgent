import { describe, it, expect } from 'vitest';
import { normaliseAdvice, type StandardLine } from './advice';

const STANDARD: StandardLine[] = [
  { id: 'venue', label: 'Venue & leje', pct: 33 },
  { id: 'catering', label: 'Mad & drikke', pct: 27 },
  { id: 'photo', label: 'Foto & film', pct: 11 },
  { id: 'florals', label: 'Blomster & dekoration', pct: 9 },
  { id: 'music', label: 'Musik & underholdning', pct: 7 },
  { id: 'attire', label: 'Tøj & beauty', pct: 8 },
  { id: 'misc', label: 'Invitationer & andet', pct: 5 },
];

describe('normaliseAdvice', () => {
  it('turns each pct into a kroner amount from the couple\'s own total', () => {
    const lines = normaliseAdvice(
      STANDARD,
      STANDARD.map((l) => ({ category: l.id, pct: l.pct })),
      100_000,
    );
    expect(lines.find((l) => l.category === 'venue')?.amount).toBe(33_000);
    expect(lines.find((l) => l.category === 'catering')?.amount).toBe(27_000);
  });

  it('rescales a split that does not sum to 100 rather than showing 97 or 103', () => {
    // Sums to 90.
    const raw = [
      { category: 'venue', pct: 30 }, { category: 'catering', pct: 25 },
      { category: 'photo', pct: 10 }, { category: 'florals', pct: 8 },
      { category: 'music', pct: 7 }, { category: 'attire', pct: 6 },
      { category: 'misc', pct: 4 },
    ];
    const lines = normaliseAdvice(STANDARD, raw, 200_000);
    const sum = lines.reduce((a, l) => a + l.pct, 0);
    expect(sum).toBe(100);
  });

  it('drops a category the model invented and never named in the standard set', () => {
    const raw = [
      { category: 'venue', pct: 40 },
      { category: 'honeymoon', pct: 20 }, // not one of the seven
    ];
    const lines = normaliseAdvice(STANDARD, raw, 100_000);
    expect(lines.map((l) => l.category)).toEqual(STANDARD.map((l) => l.id));
    // The other six keep their own benchmark (unaffected by "honeymoon"),
    // so venue gets whatever share that leaves rather than the 40 it asked
    // for, or the 100 a naive "rescale the known ones to fill 100" would
    // have given it.
    const skipped = STANDARD.filter((l) => l.id !== 'venue').reduce((a, l) => a + l.pct, 0);
    expect(lines.find((l) => l.category === 'venue')?.pct).toBe(100 - skipped);
    expect(lines.find((l) => l.category === 'catering')?.pct).toBe(27);
  });

  it('falls back to the benchmark share for a category the model skipped entirely', () => {
    const raw = [{ category: 'venue', pct: 100 }]; // says nothing about the other six
    const lines = normaliseAdvice(STANDARD, raw, 100_000);
    // The skipped ones keep their own benchmark rather than going to 0...
    expect(lines.find((l) => l.category === 'catering')?.pct).toBe(27);
    // ...and venue — the only known one — gets whatever is left over once
    // those six have theirs, not the 100 it literally asked for: honouring
    // "venue=100" at face value would mean the other six get nothing, and
    // they were never touched.
    const skipped = STANDARD.filter((l) => l.id !== 'venue').reduce((a, l) => a + l.pct, 0);
    expect(lines.find((l) => l.category === 'venue')?.pct).toBe(100 - skipped);
    expect(lines.reduce((a, l) => a + l.pct, 0)).toBe(100);
  });

  it('clamps a negative percentage to zero instead of subtracting from the total', () => {
    const raw = [
      { category: 'venue', pct: -10 }, { category: 'catering', pct: 30 },
      { category: 'photo', pct: 10 }, { category: 'florals', pct: 10 },
      { category: 'music', pct: 10 }, { category: 'attire', pct: 10 },
      { category: 'misc', pct: 10 },
    ];
    const lines = normaliseAdvice(STANDARD, raw, 100_000);
    expect(lines.find((l) => l.category === 'venue')?.pct).toBe(0);
    expect(lines.reduce((a, l) => a + l.pct, 0)).toBe(100);
  });

  it('keeps the rationale attached to its own category through the rescale', () => {
    const raw = [{ category: 'venue', pct: 50, rationale: 'Fyn er dyrere om sommeren.' }];
    const lines = normaliseAdvice(STANDARD, raw, 100_000);
    expect(lines.find((l) => l.category === 'venue')?.rationale).toBe('Fyn er dyrere om sommeren.');
    expect(lines.find((l) => l.category === 'catering')?.rationale).toBe('');
  });

  it('falls back to 100% on the whole set when the model returns nothing usable', () => {
    // A pathological reply — every category unknown or the array empty —
    // must never divide by zero.
    const lines = normaliseAdvice(STANDARD, [], 100_000);
    expect(lines.map((l) => l.pct)).toEqual(STANDARD.map((l) => l.pct));
    expect(lines.reduce((a, l) => a + l.pct, 0)).toBe(100);
  });


  it('always sums to exactly 100, across a spread of odd splits', () => {
    // Property check for the apportionment: percentages that don't divide
    // evenly are exactly the case naive per-line rounding gets wrong.
    const cases: { category: string; pct: number }[][] = [
      [{ category: 'venue', pct: 33 }, { category: 'catering', pct: 33 }, { category: 'photo', pct: 34 }],
      [{ category: 'venue', pct: 14 }, { category: 'catering', pct: 14 }, { category: 'photo', pct: 14 },
       { category: 'florals', pct: 14 }, { category: 'music', pct: 14 }, { category: 'attire', pct: 15 },
       { category: 'misc', pct: 15 }],
      [{ category: 'venue', pct: 1 }, { category: 'catering', pct: 1 }],
      [],
    ];
    for (const raw of cases) {
      const lines = normaliseAdvice(STANDARD, raw, 173_500);
      expect(lines.reduce((a, l) => a + l.pct, 0)).toBe(100);
    }
  });
});