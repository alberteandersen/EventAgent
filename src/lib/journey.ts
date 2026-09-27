// The wedding journey: derived stages, not stored state.
// events.status remains the venue-outreach pipeline; journey stages are
// computed from facts (location, guest_count, chosen_venue_id, date) plus
// manual overrides in events.journey_overrides (e.g. {"venue": "complete"}
// when the couple booked a venue outside Kalas).

import type { EventRow, VendorCategory } from "@/lib/db/types";

export type JourneyStageKey = "basics" | "venue" | "vendors" | "invites";
export type StageStatus = "complete" | "active" | "locked";

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
  emoji: string;
  status: StageStatus;
  /** Short line under the label: progress when active, unlock rule when locked. */
  hint: string;
  /** Where the stage's CTA goes (workspace deep link etc.). */
  href: string;
  cta: string;
}

export interface JourneyExtras {
  likedVenues: number;
  quotesIn: number;
  /** The invitation card has been exported for print (invitations.status 'published'). */
  invitationExported?: boolean;
  /** Count of booked vendors per category (from venues.booked_at). */
  bookedByCategory?: Partial<Record<VendorCategory, number>>;
  /** Count of contacted vendors per category (has an outreach email). */
  contactedByCategory?: Partial<Record<VendorCategory, number>>;
  /** Unread vendor replies across the wedding. */
  unreadReplies?: number;
}

/** Display metadata for vendor categories (badges, hub chips, prompts). */
export const CATEGORY_META: Record<
  Exclude<VendorCategory, "venue">,
  { label: string; emoji: string; prompt: string }
> = {
  florist: {
    label: "Florist",
    emoji: "🌸",
    prompt: "Find wedding florists near our venue.",
  },
  photographer: {
    label: "Photographer",
    emoji: "📷",
    prompt: "Find wedding photographers and videographers near our venue.",
  },
  musician: {
    label: "Music",
    emoji: "🎶",
    prompt: "Find wedding bands, musicians and DJs near our venue.",
  },
  caterer: {
    label: "Catering",
    emoji: "🍽️",
    prompt: "Find wedding caterers near our venue.",
  },
  planner: {
    label: "Planner",
    emoji: "📋",
    prompt: "Find wedding planners near our venue.",
  },
  accommodation: {
    label: "Accommodation",
    emoji: "🛏️",
    prompt: "Find hotels and accommodation for our guests near our venue.",
  },
  other: {
    label: "Vendor",
    emoji: "✨",
    prompt: "Find wedding vendors near our venue.",
  },
};

export function venueChosen(event: EventRow): boolean {
  return (
    Boolean(event.chosen_venue_id) || event.journey_overrides?.venue === "complete"
  );
}

export function dateKnown(event: EventRow): boolean {
  return Boolean(event.event_date) || event.date_precision !== "undecided";
}

const NON_VENUE_CATEGORIES: VendorCategory[] = [
  "florist",
  "photographer",
  "musician",
  "caterer",
  "planner",
  "other",
];

export function computeJourney(event: EventRow, extras: JourneyExtras): JourneyStage[] {
  const basicsComplete = Boolean(event.location && event.guest_count);
  const venueComplete = venueChosen(event);
  const vendorsUnlocked = venueComplete;
  const invitesUnlocked = venueComplete && dateKnown(event);

  // A non-venue category is "engaged" once the couple has liked or contacted a
  // vendor in it. Vendors are complete when every engaged category has a
  // booking (and at least one category is engaged) — or via manual override.
  const booked = extras.bookedByCategory ?? {};
  const contacted = extras.contactedByCategory ?? {};
  const engagedCategories = NON_VENUE_CATEGORIES.filter(
    (c) => (contacted[c] ?? 0) > 0 || (booked[c] ?? 0) > 0
  );
  const vendorsComplete =
    event.journey_overrides?.vendors === "complete" ||
    (engagedCategories.length > 0 &&
      engagedCategories.every((c) => (booked[c] ?? 0) > 0));

  const invitesComplete =
    event.journey_overrides?.invites === "complete" || Boolean(extras.invitationExported);

  const vendorsHint = vendorsComplete
    ? "All your vendors are booked 🎉"
    : engagedCategories.length > 0
      ? engagedCategories
          .map((c) => {
            const meta = CATEGORY_META[c as Exclude<VendorCategory, "venue">];
            const label = meta?.label ?? c;
            if ((booked[c] ?? 0) > 0) return `${label} booked`;
            return `${label} ${contacted[c] ?? 0} contacted`;
          })
          .join(" · ")
      : "Flowers, photos, music and catering, all local to your venue";

  const workspace = `/events/${event.id}`;

  const stages: JourneyStage[] = [
    {
      key: "basics",
      label: "The basics",
      emoji: "📝",
      status: basicsComplete ? "complete" : "active",
      hint: basicsComplete
        ? [event.location, event.guest_count && `${event.guest_count} guests`]
            .filter(Boolean)
            .join(" · ")
        : "Location and a rough guest count unlock the venue hunt",
      href: workspace,
      cta: basicsComplete ? "Review details" : "Fill in the basics",
    },
    {
      key: "venue",
      label: "Find the venue",
      emoji: "🏛️",
      status: venueComplete ? "complete" : basicsComplete ? "active" : "locked",
      hint: venueComplete
        ? "Venue chosen 🎉"
        : !basicsComplete
          ? "Unlocks once the basics are in"
          : extras.quotesIn > 0
            ? `${extras.quotesIn} quote${extras.quotesIn === 1 ? "" : "s"} in, compare and choose`
            : extras.likedVenues > 0
              ? `${extras.likedVenues} venue${extras.likedVenues === 1 ? "" : "s"} shortlisted`
              : "Everything local flows from where you say 'I do'",
      href: workspace,
      cta: venueComplete
        ? "See your venue"
        : extras.likedVenues > 0
          ? "Continue the hunt"
          : "Start the venue hunt",
    },
    {
      key: "vendors",
      label: "Book the vendors",
      emoji: "💐",
      status: vendorsComplete ? "complete" : vendorsUnlocked ? "active" : "locked",
      hint: vendorsUnlocked ? vendorsHint : "Unlocks when you've chosen a venue",
      href: `/events/${event.id}/outreach`,
      cta: (extras.unreadReplies ?? 0) > 0 ? "Open outreach" : "Find vendors",
    },
    {
      key: "invites",
      label: "Send the invites",
      emoji: "💌",
      status: invitesComplete ? "complete" : invitesUnlocked ? "active" : "locked",
      hint: invitesComplete
        ? "Invitation card exported"
        : invitesUnlocked
          ? "Design and word your invitation card"
          : venueComplete
            ? "Unlocks when the date is set"
            : "Unlocks after venue and date",
      href: `/events/${event.id}/invites`,
      cta: "Plan the invites",
    },
  ];

  // Only one active stage at a time: the first non-complete, unlocked one.
  let seenActive = false;
  for (const s of stages) {
    if (s.status === "active") {
      if (seenActive) s.status = "locked";
      else seenActive = true;
    }
  }
  // ...but vendors + invites can run in parallel once both are unlocked.
  if (venueComplete) {
    for (const s of stages) {
      if (s.key === "vendors" && !vendorsComplete) s.status = "active";
      if (s.key === "invites" && invitesUnlocked && !invitesComplete)
        s.status = "active";
    }
  }

  return stages;
}

/** One-line journey summary for the agent's system prompt. */
export function journeySummary(stages: JourneyStage[]): string {
  return stages
    .map((s) => `${s.label}: ${s.status}${s.status === "locked" ? ` (${s.hint})` : ""}`)
    .join("; ");
}
