/* The guest hub's two lookups a guest can make without signing in: which
 * table am I at, and may I leave a message. Pure, so the rules that stand
 * between the public page and the couple's data are tested on their own.
 */

import { matchGuest } from "@/lib/rsvp";
import { seatOf, type SeatingPlan } from "@/kalas/screens/seating/model";
import type { GuestRow } from "@/lib/db/types";

export type SeatAnswer =
  | { status: "found"; table: string }
  | { status: "not-seated" }
  | { status: "unknown" }
  /** Two guests share the name: saying either table would be a guess. */
  | { status: "ambiguous" };

/**
 * A guest's table, from their personal link's token or their full name as it
 * stands on the list. Only ever the table's name: nothing about who else sits
 * there, and nothing for a name that is not on the list.
 */
export function findSeat(
  guests: Pick<GuestRow, "id" | "name" | "email" | "rsvp_token">[],
  plan: SeatingPlan,
  query: { name?: string | null; token?: string | null },
): SeatAnswer {
  const name = (query.name ?? "").trim();
  if (!query.token && name.length < 2) return { status: "unknown" };

  if (!query.token) {
    const same = guests.filter((g) => g.name.trim().toLowerCase() === name.toLowerCase());
    if (same.length > 1) return { status: "ambiguous" };
  }
  const match = matchGuest(guests, { token: query.token ?? null, email: null, name });
  if (!match) return { status: "unknown" };

  const at = seatOf(plan, match.id);
  const table = at ? plan.tables.find((t) => t.id === at.tableId) : null;
  return table ? { status: "found", table: table.name } : { status: "not-seated" };
}

export const GUESTBOOK_NAME_MAX = 60;
export const GUESTBOOK_MESSAGE_MAX = 500;

/** A guestbook entry as posted, trimmed and checked, or why it was refused. */
export function readGuestbookEntry(body: unknown): { name: string; message: string } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!name) return { error: "name is required" };
  if (!message) return { error: "message is required" };
  if (name.length > GUESTBOOK_NAME_MAX) return { error: "name is too long" };
  if (message.length > GUESTBOOK_MESSAGE_MAX) return { error: "message is too long" };
  return { name, message };
}
