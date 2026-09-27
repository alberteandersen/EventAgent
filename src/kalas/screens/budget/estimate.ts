/* The opening budget. A couple should not have to fill in a form before the
   screen shows them anything, everything needed is already in the event row,
   so the seven benchmark lines are worked out and saved on arrival, and the
   couple pushes them up and down from there. */

import { budgetLines } from '@/lib/budget/benchmarks';

/** kr per guest, Danish average — the fallback when only a headcount is known. */
export const DK_AVG_PER_GUEST = 1850;

/**
 * What we can responsibly guess the wedding costs, from what the couple has
 * already told us. Their own number wins; a headcount is the fallback, rounded
 * to the nearest 10.000 because it is an estimate and shouldn't pretend to be
 * exact. Zero when we know neither — a number with nothing behind it is worse
 * than no number, so the caller shows a prompt instead of seeding.
 */
export function estimatedTotal(budgetTotal: number, guests: number): number {
  if (budgetTotal > 0) return budgetTotal;
  if (guests > 0) return Math.round((guests * DK_AVG_PER_GUEST) / 10000) * 10000;
  return 0;
}

export type EstimatedLine = {
  category: string;
  label: string;
  planned_amount: number;
  icon: string;
  color: string;
  sort: number;
};

/**
 * The benchmark split as rows ready for `saveBudgetItem`. `budgetLines` in
 * data.ts is the single source of the percentages, labels and styling — the
 * old estimator kept a second copy of the same seven lines that had already
 * drifted in ordering.
 */
export function estimatedLines(total: number): EstimatedLine[] {
  return budgetLines.map((line, i) => ({
    category: line.id,
    label: line.label,
    planned_amount: Math.round((total * line.pct) / 100),
    icon: line.icon,
    color: line.color,
    sort: i,
  }));
}

/**
 * What the couple has set aside for the venue itself.
 *
 * The venue search used to seed its budget filter from the WHOLE wedding
 * budget, which is meaningless: a venue costing all 275.000 kr leaves nothing
 * for food, photographer or flowers. What matters is the line they allocated
 * to it — 72.500 kr of that 275.000.
 *
 * Falls back to the benchmark share (`budgetLines`, venue = 33%) when they
 * have not split their budget yet, and to null when there is no budget at
 * all. Never to the total.
 */
export function venueBudget(
  items: { category: string; planned_amount: number }[],
  total: number
): number | null {
  const line = items.find((b) => b.category === "venue");
  if (line && line.planned_amount > 0) return line.planned_amount;
  const pct = budgetLines.find((l) => l.id === "venue")?.pct ?? 0;
  if (total > 0 && pct > 0) return Math.round((total * pct) / 100);
  return null;
}

/* ── Venue and hire, apart ─────────────────────────────────────────────── */

/** What the venue line was called while it also held the hire. */
export const LEGACY_VENUE_LABEL = 'Venue & leje';

/**
 * The smaller posts each standard category is usually made of. Every budget
 * starts with them at 0 kr (see `subItemSeeds`), and any the couple deleted
 * are offered again as one-tap chips in Detaljer.
 */
export const SUGGESTED_SUB_ITEMS: Record<string, string[]> = {
  venue: ['Lokaleleje', 'Vielsessted', 'Overnatning', 'Rengøring'],
  rental: ['Telt', 'Borde & stole', 'Service & glas', 'Duge', 'Belysning', 'Dansegulv', 'Toiletvogn', 'Varmelamper'],
  catering: ['Menu', 'Vinpakke & drikkevarer', 'Bryllupskage', 'Natmad', 'Personale'],
  photo: ['Fotograf', 'Videograf', 'Fotoboks'],
  florals: ['Brudebuket', 'Bordpynt', 'Ceremonipynt', 'Knaphulsblomster'],
  music: ['Musik til vielsen', 'DJ', 'Sanger/band', 'Toastmaster', 'Fyrværkeri'],
  attire: ['Brudekjole', 'Jakkesæt', 'Sko', 'Hår & makeup', 'Tilbehør', 'Vielsesringe'],
  misc: ['Invitationer', 'Bordkort & menukort', 'Gaver til gæsterne', 'Transport'],
};

/** The suggestions for a category that it does not already have a post for. */
export function subItemSuggestions(category: string, existing: { label: string }[]): string[] {
  const have = new Set(existing.map((s) => s.label.trim().toLowerCase()));
  return (SUGGESTED_SUB_ITEMS[category] ?? []).filter((label) => !have.has(label.toLowerCase()));
}

/**
 * The usual posts to add to categories that have never had them: one row per
 * missing post at 0 kr, and the categories to mark as done so it happens once.
 *
 * Only a row that says `sub_items_seeded === false` qualifies. Undefined means
 * the database is older than the flag, and seeding then would add the posts
 * again on every visit. A post the couple already has, under any case, is
 * skipped; a category with no suggestions (a custom one) is still marked.
 */
export function subItemSeeds(
  items: { category: string; sub_items_seeded?: boolean }[],
  subItems: { category: string; label: string }[],
): { rows: { category: string; label: string; amount: number; sort: number }[]; categories: string[] } {
  const pending = items.filter((i) => i.sub_items_seeded === false);
  const rows = pending.flatMap((item) => {
    const existing = subItems.filter((s) => s.category === item.category);
    return subItemSuggestions(item.category, existing).map((label, i) => ({
      category: item.category, label, amount: 0, sort: existing.length + i,
    }));
  });
  return { rows, categories: pending.map((i) => i.category) };
}

export type RentalSplit = {
  /** The new hire line, slotted in straight after the venue. */
  rental: EstimatedLine;
  /** Lines below the venue, each moved one place down to make room. */
  shifted: { category: string; label: string; sort: number }[];
};

/**
 * Budgets saved before hire had a line of its own still carry one combined
 * "Venue & leje" row. This works out the one-time split: rename that row to
 * "Venue" and add "Leje & udstyr" directly under it.
 *
 * The new line starts at 0 kr. Moving part of the venue figure across would be
 * guessing how much of what the couple entered was hire, so the money stays
 * where they put it. Null when there is nothing to split: no combined row (a
 * new budget, or one the couple renamed or removed), or a hire line already.
 */
export function rentalSplit(
  items: { category: string; label: string; sort: number }[]
): RentalSplit | null {
  const venue = items.find((i) => i.category === 'venue');
  if (!venue || venue.label !== LEGACY_VENUE_LABEL) return null;
  if (items.some((i) => i.category === 'rental')) return null;
  const std = budgetLines.find((l) => l.id === 'rental');
  if (!std) return null;
  return {
    rental: {
      category: 'rental', label: std.label, planned_amount: 0,
      icon: std.icon, color: std.color, sort: venue.sort + 1,
    },
    shifted: items
      .filter((i) => i.category !== 'venue' && i.sort > venue.sort)
      .map((i) => ({ category: i.category, label: i.label, sort: i.sort + 1 })),
  };
}
