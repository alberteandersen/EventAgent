/* What the kitchen and the venue need to know about the guest list, counted:
 * how many are eating, how many are children, who must not eat what (kept
 * apart from who prefers a different menu, since one is a safety matter),
 * what guests chose on the RSVP form, who is staying the night and who is not
 * drinking, and what each table needs.
 *
 * Pure, so the numbers a caterer plans a menu around are tested rather than
 * trusted. Guests who declined never count. Guests who have not answered only
 * count when the couple asks for it, because a caterer quotes on confirmed
 * covers and adds the rest later.
 */

import { DIETARY_TAGS, isAllergyTag, parseLegacyDietary, tagLabel } from './dietary';
import { ageGroupOf, AGE_GROUPS } from './household';
import { seatOf, type SeatingPlan } from '../seating/model';
import type { AgeGroup, GuestRow } from '@/lib/db/types';

type Guest = Pick<GuestRow, 'id' | 'name' | 'rsvp' | 'dietary' | 'dietary_tags' | 'overnight' | 'no_alcohol'>
  & Partial<Pick<GuestRow, 'age_group' | 'meal'>>;

export type Named = { id: string; name: string };

/** One of the list's quick filters, shared by the report and the guest list. */
export type GuestNeed = 'diet' | 'allergy' | 'overnight' | 'noAlcohol' | 'children';

export interface CateringReport {
  /** Guests the figures below are for. */
  counted: number;
  /** Not answered yet, and not in `counted` unless included. */
  pending: number;
  declined: number;
  ages: Record<AgeGroup, number>;
  /** Children and babies by name; a baby needs a high chair, not a cover. */
  children: (Named & { age: AgeGroup })[];
  /** Allergy and intolerance tags anyone has, in the dialog's order. */
  allergies: { id: string; label: string; guests: Named[] }[];
  /** Diet tags anyone has (vegetarian, halal…), in the dialog's order. */
  diets: { id: string; label: string; guests: Named[] }[];
  /** What was typed by hand. Read as an allergy until someone says otherwise:
   *  the kitchen would rather ask than guess. */
  other: { guest: Named; text: string }[];
  /** Guests with an allergy tag or anything typed. */
  withAllergies: number;
  /** Guests with a diet tag. */
  withDiets: number;
  /** What guests chose on the RSVP form ("kød", "fisk"), most chosen first. */
  meals: { label: string; guests: Named[] }[];
  overnight: Named[];
  noAlcohol: Named[];
  /** Per table on the seating plan, what the counted guests there need. */
  tables: {
    id: string; name: string; seated: number;
    allergies: { label: string; count: number }[];
    diets: { label: string; count: number }[];
    other: string[];
  }[];
}

/**
 * A guest's dietary needs as tags and free text. A guest whose needs were only
 * ever typed (the public RSVP form writes text, never tags) is read for the
 * tags that text names, the same way the guest dialog reads it.
 */
export function needsOf(guest: Pick<Guest, 'dietary' | 'dietary_tags'>): { tags: string[]; text: string } {
  if (guest.dietary_tags?.length) return { tags: guest.dietary_tags, text: (guest.dietary ?? '').trim() };
  const legacy = parseLegacyDietary(guest.dietary);
  return { tags: legacy.tags, text: legacy.rest };
}

export function hasNeed(guest: Guest, need: GuestNeed): boolean {
  if (need === 'overnight') return guest.overnight;
  if (need === 'noAlcohol') return guest.no_alcohol;
  if (need === 'children') return ageGroupOf(guest) !== 'adult';
  const { tags, text } = needsOf(guest);
  if (need === 'allergy') return tags.some(isAllergyTag) || text.length > 0;
  return tags.length > 0 || text.length > 0;
}

export function cateringReport(
  guests: Guest[],
  plan: SeatingPlan,
  { includePending = false }: { includePending?: boolean } = {},
): CateringReport {
  const counts = (g: Guest) => g.rsvp === 'ja' || (includePending && g.rsvp === 'afventer');
  const counted = guests.filter(counts);
  const named = (g: Guest): Named => ({ id: g.id, name: g.name });

  const ages = Object.fromEntries(AGE_GROUPS.map((a) => [a.id, 0])) as Record<AgeGroup, number>;
  const children: CateringReport['children'] = [];
  const byTag = new Map<string, Named[]>();
  const byMeal = new Map<string, { label: string; guests: Named[] }>();
  const other: CateringReport['other'] = [];
  let withAllergies = 0;
  let withDiets = 0;

  for (const g of counted) {
    const age = ageGroupOf(g);
    ages[age] += 1;
    if (age !== 'adult') children.push({ ...named(g), age });
    const { tags, text } = needsOf(g);
    if (tags.some(isAllergyTag) || text) withAllergies += 1;
    if (tags.some((tag) => !isAllergyTag(tag))) withDiets += 1;
    for (const tag of tags) byTag.set(tag, [...(byTag.get(tag) ?? []), named(g)]);
    if (text) other.push({ guest: named(g), text });
    const meal = (g.meal ?? '').trim();
    if (meal) {
      const key = meal.toLowerCase();
      const entry = byMeal.get(key) ?? { label: meal.charAt(0).toUpperCase() + meal.slice(1), guests: [] };
      entry.guests.push(named(g));
      byMeal.set(key, entry);
    }
  }

  // The dialog's order first, then any tag this version does not know.
  const known = DIETARY_TAGS.map((t) => t.id);
  const tagOrder = [...known, ...[...byTag.keys()].filter((id) => !known.includes(id))];
  const entries = (allergy: boolean) => tagOrder
    .filter((id) => byTag.has(id) && isAllergyTag(id) === allergy)
    .map((id) => ({ id, label: tagLabel(id), guests: byTag.get(id)! }));

  const tables = plan.tables.flatMap((table) => {
    const here = counted.filter((g) => seatOf(plan, g.id)?.tableId === table.id);
    if (here.length === 0) return [];
    const tally = new Map<string, number>();
    const typed: string[] = [];
    for (const g of here) {
      const { tags, text } = needsOf(g);
      for (const tag of tags) tally.set(tag, (tally.get(tag) ?? 0) + 1);
      if (text) typed.push(`${g.name}: ${text}`);
    }
    const counts = (allergy: boolean) => tagOrder
      .filter((id) => tally.has(id) && isAllergyTag(id) === allergy)
      .map((id) => ({ label: tagLabel(id), count: tally.get(id)! }));
    return [{ id: table.id, name: table.name, seated: here.length, allergies: counts(true), diets: counts(false), other: typed }];
  });

  return {
    counted: counted.length,
    pending: guests.filter((g) => g.rsvp === 'afventer').length,
    declined: guests.filter((g) => g.rsvp === 'nej').length,
    ages,
    children,
    allergies: entries(true),
    diets: entries(false),
    other,
    withAllergies,
    withDiets,
    meals: [...byMeal.values()].sort((a, b) => b.guests.length - a.guests.length),
    overnight: counted.filter((g) => g.overnight).map(named),
    noAlcohol: counted.filter((g) => g.no_alcohol).map(named),
    tables,
  };
}
