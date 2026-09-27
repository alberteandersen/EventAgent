import type { GuestRow } from "@/lib/db/types";

/**
 * Match a public RSVP submission to an existing guest row. Priority: the
 * per-guest token (from a personal link) → case-insensitive email → exact
 * case-insensitive name. Returns null when the guest is new (self-added).
 * Pure so it can be unit-tested without a database.
 */
export function matchGuest(
  guests: Pick<GuestRow, "id" | "name" | "email" | "rsvp_token">[],
  input: { token?: string | null; email?: string | null; name: string }
): { id: string; reason: "token" | "email" | "name" } | null {
  if (input.token) {
    const byToken = guests.find((g) => g.rsvp_token === input.token);
    if (byToken) return { id: byToken.id, reason: "token" };
  }
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const byEmail = guests.find((g) => g.email?.trim().toLowerCase() === email);
    if (byEmail) return { id: byEmail.id, reason: "email" };
  }
  const name = input.name.trim().toLowerCase();
  if (name) {
    const byName = guests.find((g) => g.name.trim().toLowerCase() === name);
    if (byName) return { id: byName.id, reason: "name" };
  }
  return null;
}
