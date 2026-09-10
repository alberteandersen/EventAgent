/* Who the public wedding site says it belongs to, and how the day is written.
 *
 * Pulled out of the page so it can be tested: the date was formatted with a
 * hard-coded da-DK three lines above where the couple's language is resolved,
 * so an English couple's guests read "14. juni 2027" on an English page. It
 * also feeds the link preview, which is the first thing anyone sees.
 */

import type { AppLanguage, EventRow, ProfileRow } from "@/lib/db/types";

export interface PublicCouple {
  a: string;
  b: string;
  dateISO: string | null;
  dateLabel: string;
}

type EventLike = Pick<EventRow, "title" | "event_date" | "date_hint">;
type ProfileLike = Pick<ProfileRow, "display_name" | "partner_name" | "language">;

export function siteLanguage(profile: ProfileLike | null): AppLanguage {
  return profile?.language === "en" ? "en" : "da";
}

export function publicCouple(event: EventLike, profile: ProfileLike | null): PublicCouple {
  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const dateISO = event.event_date;
  const locale = siteLanguage(profile) === "en" ? "en-GB" : "da-DK";
  const dateLabel = dateISO
    ? new Date(dateISO).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    // No firm date: whatever they told us, in their own words.
    : event.date_hint ?? "";
  return { a, b, dateISO, dateLabel };
}

/** "Alberte & Espen" — one name is a complete answer when there is only one. */
export function coupleNames(couple: Pick<PublicCouple, "a" | "b">): string {
  if (couple.a && couple.b) return `${couple.a} & ${couple.b}`;
  return couple.a || couple.b || "";
}

/**
 * What the link says when it lands in the family group chat. Falls back to
 * the product name only when there is genuinely no couple to name — better
 * than "'s bryllup" with a hole where the names should be.
 */
export function siteTitle(couple: Pick<PublicCouple, "a" | "b">, language: AppLanguage): string {
  const names = coupleNames(couple);
  if (!names) return "Kalas";
  return language === "en" ? `${names}'s wedding` : `${names}s bryllup`;
}
