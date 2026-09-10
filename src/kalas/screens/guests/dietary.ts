/* What a guest eats, as structured choices rather than a sentence.
 *
 * The tags live in `guests.dietary_tags`; the free-text `guests.dietary`
 * column stays exactly as it was, because two things outside this screen
 * still read it as prose: the public RSVP form a guest fills in themselves,
 * and the seating plan's "Kostbehov" badge. So the tags carry the common
 * choices and the free text carries everything else — an allergy, a
 * preference nobody has a chip for.
 *
 * Ids are stable ASCII on purpose: they are stored in the database, so they
 * must never be the Danish labels. Same rule the checklist areas follow in
 * planning/shared.ts.
 */

export interface DietaryTag {
  id: string;
  label: string;
  /** Words that mean this tag when a couple has typed it by hand. */
  aliases: string[];
}

export const DIETARY_TAGS: DietaryTag[] = [
  { id: 'vegetarian', label: 'Vegetarisk', aliases: ['vegetar', 'vegetarisk', 'vegetarian'] },
  { id: 'vegan', label: 'Vegansk', aliases: ['vegan', 'vegansk'] },
  { id: 'gluten_free', label: 'Glutenfri', aliases: ['gluten', 'glutenfri', 'gluten-fri', 'cøliaki'] },
  { id: 'dairy_free', label: 'Mælkefri', aliases: ['mælkefri', 'laktose', 'laktosefri', 'dairy free'] },
  { id: 'nut_free', label: 'Nøddefri', aliases: ['nødder', 'nøddefri', 'nøddeallergi', 'nut free'] },
  { id: 'halal', label: 'Halal', aliases: ['halal'] },
  { id: 'kosher', label: 'Kosher', aliases: ['kosher'] },
  { id: 'pescatarian', label: 'Pescetarisk', aliases: ['pescetar', 'pescetarisk', 'pescatarian'] },
];

const BY_ID = new Map(DIETARY_TAGS.map((tag) => [tag.id, tag]));

export function tagLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/**
 * One readable line for a guest's needs — the tags first, then whatever was
 * typed by hand. Used on the guest row and by the seating plan, so a guest
 * who only has chips still counts as having a dietary need.
 */
export function dietarySummary(tags: string[] | null | undefined, freeText: string | null | undefined): string {
  const parts = (tags ?? []).map(tagLabel);
  const rest = (freeText ?? '').trim();
  if (rest) parts.push(rest);
  return parts.join(' · ');
}

/**
 * Reads chips out of text a couple already typed, so opening the dialog on an
 * existing guest lights up "Vegetarisk" rather than making them re-enter it.
 * Whatever is not recognised comes back as `rest` and stays free text — this
 * never silently drops something it did not understand.
 */
export function parseLegacyDietary(text: string | null | undefined): { tags: string[]; rest: string } {
  const raw = (text ?? '').trim();
  if (!raw) return { tags: [], rest: '' };

  const tags: string[] = [];
  const leftovers: string[] = [];

  for (const piece of raw.split(/[,;·]/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const hit = DIETARY_TAGS.find((tag) => tag.aliases.some((a) => lower === a || lower.includes(a)));
    if (hit && !tags.includes(hit.id)) tags.push(hit.id);
    else if (!hit) leftovers.push(trimmed);
  }

  return { tags, rest: leftovers.join(', ') };
}
