import { matchGuest } from '@/lib/rsvp';
import type {
  GuestRow, RegistryClaimRow, RegistryItemRow, ThankYouRow, ThankMethod,
} from '@/lib/db/types';

/* The thank-you list is DERIVED, not stored. It merges two sources the app
   already has, who came, and who gave something, and layers the couple's
   own annotations (thank_yous rows) on top. Keeping it derived means a guest
   added or a gift claimed after the fact simply shows up. */

export type ThankSubject = 'guest' | 'claim' | 'manual';

export function subjectKey(kind: ThankSubject, id: string): string {
  return `${kind}:${id}`;
}

export type ThankEntry = {
  key: string;
  name: string;
  email: string | null;
  /** What they gave, if anything — prefilled from the registry claim. */
  gift: string | null;
  /** The note the guest wrote when reserving the gift. */
  message: string | null;
  /** True when this person attended (rsvp === 'ja'). */
  attended: boolean;
  thankedAt: string | null;
  method: ThankMethod | null;
  note: string | null;
};

type GuestLike = Pick<GuestRow, 'id' | 'name' | 'email' | 'rsvp' | 'rsvp_token'>;
type ClaimLike = Pick<RegistryClaimRow, 'id' | 'item_id' | 'guest_name' | 'guest_email' | 'message' | 'quantity'>;
type ItemLike = Pick<RegistryItemRow, 'id' | 'title'>;

/** Joins claims to their item title: "Stelton kande × 2". */
function giftLabel(claim: ClaimLike, items: ItemLike[]): string {
  const title = items.find((i) => i.id === claim.item_id)?.title ?? 'Gave';
  return claim.quantity > 1 ? `${title} × ${claim.quantity}` : title;
}

/** Merges multiple gifts from the same person into one line. */
function joinGifts(existing: string | null, next: string): string {
  return existing ? `${existing}, ${next}` : next;
}

/**
 * Build the thank-you list.
 *
 * A claim that matches a guest merges into that guest's entry — the couple
 * should thank a person once, not once per gift. Only claims matching nobody
 * get their own entry, which is the common case for gift-givers who never
 * RSVP'd. Manual overlay rows (people the couple added by hand) always
 * survive, since nothing else can produce them.
 */
export function buildThankList(
  guests: GuestLike[],
  claims: ClaimLike[],
  items: ItemLike[],
  overlays: Pick<ThankYouRow, 'subject_key' | 'label' | 'gift' | 'thanked_at' | 'method' | 'note'>[]
): ThankEntry[] {
  const byKey = new Map<string, ThankEntry>();

  // Everyone who said yes is worth thanking, gift or no gift.
  for (const g of guests) {
    if (g.rsvp !== 'ja') continue;
    byKey.set(subjectKey('guest', g.id), {
      key: subjectKey('guest', g.id),
      name: g.name,
      email: g.email,
      gift: null,
      message: null,
      attended: true,
      thankedAt: null,
      method: null,
      note: null,
    });
  }

  for (const c of claims) {
    const match = matchGuest(guests, { email: c.guest_email, name: c.guest_name });
    const gift = giftLabel(c, items);

    if (match) {
      const key = subjectKey('guest', match.id);
      const existing = byKey.get(key);
      if (existing) {
        existing.gift = joinGifts(existing.gift, gift);
        // Keep the first non-empty message rather than concatenating notes.
        existing.message ??= c.message;
        existing.email ??= c.guest_email;
        continue;
      }
      // Matched a guest who declined or is still pending — they sent a gift
      // without coming, so they belong on the list under their guest key.
      const guest = guests.find((g) => g.id === match.id);
      byKey.set(key, {
        key, name: guest?.name ?? c.guest_name, email: guest?.email ?? c.guest_email,
        gift, message: c.message, attended: guest?.rsvp === 'ja',
        thankedAt: null, method: null, note: null,
      });
      continue;
    }

    const key = subjectKey('claim', c.id);
    byKey.set(key, {
      key, name: c.guest_name, email: c.guest_email,
      gift, message: c.message, attended: false,
      thankedAt: null, method: null, note: null,
    });
  }

  // Overlay the couple's own annotations, and revive manual entries.
  for (const o of overlays) {
    const existing = byKey.get(o.subject_key);
    if (existing) {
      existing.thankedAt = o.thanked_at;
      existing.method = o.method;
      existing.note = o.note;
      if (o.gift) existing.gift = o.gift;
      continue;
    }
    // A guest/claim row that has since been deleted keeps its denormalized
    // label — losing the couple's "already thanked" mark would be worse.
    byKey.set(o.subject_key, {
      key: o.subject_key,
      name: o.label,
      email: null,
      gift: o.gift,
      message: null,
      attended: false,
      thankedAt: o.thanked_at,
      method: o.method,
      note: o.note,
    });
  }

  return [...byKey.values()].sort(sortEntries);
}

/** Not thanked first, then gift-givers, then alphabetically by Danish name. */
function sortEntries(a: ThankEntry, b: ThankEntry): number {
  if (!a.thankedAt !== !b.thankedAt) return a.thankedAt ? 1 : -1;
  if (!!a.gift !== !!b.gift) return a.gift ? -1 : 1;
  return a.name.localeCompare(b.name, 'da');
}

export function thankProgress(entries: ThankEntry[]): { done: number; total: number } {
  return { done: entries.filter((e) => e.thankedAt).length, total: entries.length };
}

export const THANK_METHODS: { id: ThankMethod; label: string }[] = [
  { id: 'kort', label: 'Takkekort' },
  { id: 'besked', label: 'Besked' },
  { id: 'personligt', label: 'Personligt' },
  { id: 'ringet', label: 'Ringet' },
];

export function methodLabel(method: ThankMethod | null): string | null {
  return THANK_METHODS.find((m) => m.id === method)?.label ?? null;
}
