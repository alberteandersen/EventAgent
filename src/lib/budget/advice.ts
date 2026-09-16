/* The arithmetic behind Ava's budget suggestion — pulled out of the API
 * route so it can be tested without a live Gemini call or a signed-in
 * session. Never trust a model's percentages at face value: this is what
 * turns whatever it returned into something that actually sums to 100 and
 * never recommends less than a category the couple has already spent money
 * in.
 */

export interface StandardLine {
  id: string;
  label: string;
  pct: number;
}

export interface RawAdviceLine {
  category: string;
  pct: number;
  rationale?: string;
}

export interface AdviceLine {
  category: string;
  label: string;
  pct: number;
  amount: number;
  rationale: string;
}

/**
 * Largest-remainder apportionment: rounds a list of fractional shares to
 * whole numbers that sum to exactly `target`. Rounding each share
 * independently (plain Math.round on every one) drifts the total off target
 * by a point or two whenever the fractions don't happen to cancel out — this
 * floors every share, then hands the leftover to the entries whose
 * fractional part was closest to rounding up. The same method used to
 * apportion parliament seats.
 */
function apportion(shares: number[], target: number): number[] {
  const floors = shares.map((s) => Math.floor(s));
  let remainder = target - floors.reduce((a, b) => a + b, 0);
  const byFraction = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k++, remainder--) {
    result[byFraction[k].i] += 1;
  }
  return result;
}

/**
 * Normalises Gemini's suggested split against the couple's real total.
 *
 * - Unknown categories are dropped; a category the model skipped falls back
 *   to that category's own benchmark percentage, never to zero.
 * - Negative percentages are clamped to zero.
 * - The known subset is rescaled to sum to 100 before rounding, and the
 *   rounding itself is apportioned rather than done line-by-line, so the
 *   result always sums to exactly 100 — never the 97 or 103 that rounding
 *   independent percentages would otherwise occasionally produce.
 * - Every line's amount is computed here, in kroner, from the couple's own
 *   total — never taken from the model.
 */
export function normaliseAdvice(
  standard: StandardLine[],
  raw: RawAdviceLine[],
  total: number,
): AdviceLine[] {
  const knownIds = new Set(standard.map((l) => l.id));
  const known = new Map(
    raw
      .filter((l) => knownIds.has(l.category))
      .map((l) => [l.category, { pct: Math.max(0, l.pct), rationale: l.rationale ?? '' }]),
  );

  // A category the model skipped keeps its own benchmark share, untouched —
  // so the known ones must be rescaled to fill only what is left over, not
  // simply rescaled to 100 and stacked on top of the skipped ones' shares.
  // (Scaling known to 100 by itself and adding the skipped benchmarks on top
  // is the bug a first pass at this got wrong: with two of the categories
  // known, the "known" pair alone would already claim the full 100, and the
  // other five would add their benchmarks on top of that.)
  const skippedBenchmarkTotal = standard
    .filter((l) => !known.has(l.id))
    .reduce((a, l) => a + l.pct, 0);
  const availableForKnown = Math.max(0, 100 - skippedBenchmarkTotal);
  const knownRawSum = [...known.values()].reduce((a, l) => a + l.pct, 0);
  const scale = knownRawSum > 0 ? availableForKnown / knownRawSum : 0;

  const shares = standard.map((l) => {
    const k = known.get(l.id);
    return k ? k.pct * scale : l.pct;
  });
  const pcts = apportion(shares, 100);

  return standard.map((l, i) => ({
    category: l.id,
    label: l.label,
    pct: pcts[i],
    amount: Math.round((total * pcts[i]) / 100),
    rationale: known.get(l.id)?.rationale || '',
  }));
}
