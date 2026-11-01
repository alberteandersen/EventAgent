// Pure venue/vendor ranking. Extracted so it can be unit-tested without the
// Gemini/Supabase machinery around the search pipeline.

import { budgetFitScore, capacityFitScore, capacityOf, estimatedTotal, type VenueFacts } from "./venue/facts";

export interface RankableExtracted {
  capacity?: string | null;
  description?: string | null;
  why_fit?: string | null;
}

export interface RankablePlace {
  rating?: number;
  userRatingCount?: number;
}

/** Bayesian-smoothed rating so a 5.0 with 3 reviews doesn't beat a 4.8 with 400. */
export function ratingScore(rating?: number, reviewCount?: number): number {
  if (!rating) return 4.1; // unrated: just below the prior, not buried
  const n = reviewCount ?? 0;
  return (rating * n + 4.2 * 10) / (n + 10);
}

export interface RankOptions {
  /** Structured facts, when the caller has them. Scores capacity and budget
   *  on the same curves the explore page's filter uses, so Juno and the
   *  couple rank a venue the same way. */
  facts?: VenueFacts | null;
  /** The couple's venue budget, in local currency. */
  budget?: number | null;
}

export function rankScore(
  candidate: { extracted: RankableExtracted; place: RankablePlace | null },
  guestCount: number | null | undefined,
  vibes: string[],
  opts: RankOptions = {}
): number {
  let score = ratingScore(candidate.place?.rating, candidate.place?.userRatingCount);

  if (opts.facts) {
    score += capacityFitScore(capacityOf(opts.facts), guestCount);
    score += budgetFitScore(estimatedTotal(opts.facts, guestCount), opts.budget);
  } else if (guestCount && candidate.extracted.capacity) {
    // No structured facts: fall back to any number in the capacity text that
    // covers the guest count.
    const numbers = candidate.extracted.capacity.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.some((n) => n >= guestCount)) score += 0.1;
  }

  // Vibe keywords appearing in the description / fit sentence.
  const text = `${candidate.extracted.description ?? ""} ${candidate.extracted.why_fit ?? ""}`.toLowerCase();
  const hits = vibes.filter((v) => text.includes(v.toLowerCase())).length;
  score += Math.min(hits, 3) * 0.05;

  return score;
}
