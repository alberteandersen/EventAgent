/* Age and household: the two parts of a guest that only mean something
 * across the whole list.
 *
 * A household is one level deep on purpose. A guest either heads one, belongs
 * to one, or stands alone. Allowing a member to head their own household would
 * make "who is in this envelope" a tree walk, and no invitation works that way.
 * These helpers are what keep it one level: the dialog only offers heads that
 * are not themselves members, and never offers a head to a guest who already
 * has members of their own.
 */

import type { AgeGroup, GuestRow } from '@/lib/db/types';

type Guest = Pick<GuestRow, 'id' | 'name'> & Partial<Pick<GuestRow, 'age_group' | 'household_head'>>;

export const AGE_GROUPS: { id: AgeGroup; label: string }[] = [
  { id: 'adult', label: 'Voksen' },
  { id: 'child', label: 'Barn' },
  { id: 'baby', label: 'Baby' },
];

/** "1 barn", "4 børn": the Danish source string for a count of one age group. */
export function ageCountLabel(id: AgeGroup, n: number): string {
  const one = n === 1;
  if (id === 'child') return one ? '{n} barn' : '{n} børn';
  if (id === 'baby') return one ? '{n} baby' : '{n} babyer';
  return one ? '{n} voksen' : '{n} voksne';
}

/** Missing or unknown reads as an adult, which is what the list assumed before. */
export function ageGroupOf(guest: Partial<Pick<GuestRow, 'age_group'>>): AgeGroup {
  return guest.age_group === 'child' || guest.age_group === 'baby' ? guest.age_group : 'adult';
}

export function ageCounts(guests: Partial<Pick<GuestRow, 'age_group'>>[]): Record<AgeGroup, number> {
  const out: Record<AgeGroup, number> = { adult: 0, child: 0, baby: 0 };
  for (const g of guests) out[ageGroupOf(g)] += 1;
  return out;
}

/** Everyone who counts `headId` as the head of their household. */
export function householdMembers<T extends Guest>(guests: T[], headId: string): T[] {
  return guests.filter((g) => g.household_head === headId && g.id !== headId);
}

/**
 * Who `selfId` could join as a household. Not themselves, not someone who is
 * already a member elsewhere, and nobody at all when `selfId` heads a household
 * of their own — that would nest one inside another. `selfId` is null for a
 * guest not saved yet, who can join anyone who is not a member.
 */
export function householdHeadOptions<T extends Guest>(guests: T[], selfId: string | null): T[] {
  if (selfId && householdMembers(guests, selfId).length > 0) return [];
  return guests
    .filter((g) => g.id !== selfId && !g.household_head)
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * The list in household order: each head followed straight away by their
 * members, everyone else where they were. A member whose head is filtered out
 * of `guests` (a search, an RSVP filter) stays in place as an ordinary row, so
 * filtering never hides anyone who matched.
 */
export function orderByHousehold<T extends Guest>(guests: T[]): { guest: T; member: boolean }[] {
  const present = new Set(guests.map((g) => g.id));
  const out: { guest: T; member: boolean }[] = [];
  for (const g of guests) {
    if (g.household_head && present.has(g.household_head)) continue;
    out.push({ guest: g, member: false });
    for (const m of householdMembers(guests, g.id)) out.push({ guest: m, member: true });
  }
  return out;
}
