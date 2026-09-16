// The wedding facts a couple can change after onboarding, from Settings:
// where, how many, how much, and the rough "when" for a date not yet fixed.
// Kept apart from the route so the rules are testable without a request.

import { weddingTitle } from "@/lib/onboarding";

export const MAX_GUESTS = 2000;
/** 100 million kr: past this it is a typo, not a wedding. */
export const MAX_BUDGET = 100_000_000;

export type DetailsPatch = { patch: Record<string, unknown>; error?: undefined } | { patch?: undefined; error: string };

/**
 * The event columns a Settings save may write, validated. Fields left out of
 * the body are left alone; an empty string or null clears a field. The first
 * invalid field fails the whole save, so a couple never gets half an update.
 */
export function eventDetailsPatch(body: Record<string, unknown>): DetailsPatch {
  const patch: Record<string, unknown> = {};

  if ("location" in body) {
    if (body.location !== null && typeof body.location !== "string") return { error: "location must be text" };
    const v = (body.location ?? "").trim();
    if (v.length > 120) return { error: "location is too long" };
    patch.location = v || null;
  }

  if ("guest_count" in body) {
    const raw = body.guest_count;
    if (raw === null || raw === "") patch.guest_count = null;
    else {
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
      if (!Number.isInteger(n) || n < 0 || n > MAX_GUESTS) {
        return { error: `guest_count must be a whole number from 0 to ${MAX_GUESTS}` };
      }
      patch.guest_count = n;
    }
  }

  if ("budget" in body) {
    const raw = body.budget;
    if (raw === null || raw === "") patch.budget = null;
    else {
      // "180.000 kr" and 180000 both mean the same budget; keep the digits.
      const digits = typeof raw === "number" ? String(Math.round(raw)) : typeof raw === "string" ? raw.replace(/[^\d]/g, "") : "";
      if (!digits || Number(digits) > MAX_BUDGET) return { error: "budget must be an amount in kroner" };
      patch.budget = String(Number(digits));
    }
  }

  if ("date_hint" in body) {
    if (body.date_hint !== null && typeof body.date_hint !== "string") return { error: "date_hint must be text" };
    const v = (body.date_hint ?? "").trim();
    if (v.length > 60) return { error: "date_hint is too long" };
    patch.date_hint = v || null;
  }

  if ("names" in body) {
    const names = body.names as { name?: unknown; partner?: unknown } | null;
    const name = typeof names?.name === "string" ? names.name.trim() : "";
    const partner = typeof names?.partner === "string" ? names.partner.trim() : "";
    if (!name) return { error: "a name is required" };
    // The event's own title follows the names, so nothing still says the old ones.
    patch.title = weddingTitle(name, partner);
  }

  return { patch };
}
