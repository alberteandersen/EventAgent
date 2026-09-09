import { describe, it, expect } from "vitest";
import { computeJourney, type JourneyExtras } from "./journey";
import type { EventRow } from "./db/types";

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "e1",
    user_id: "u1",
    title: "Emma & James's wedding",
    event_type: "wedding",
    location: "Copenhagen",
    guest_count: 100,
    event_date: null,
    date_precision: "undecided",
    date_hint: null,
    budget: null,
    requirements: {},
    status: "gathering",
    chosen_venue_id: null,
    journey_overrides: {},
  checklist_hidden: [],
    reply_tag: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const noExtras: JourneyExtras = { likedVenues: 0, quotesIn: 0 };

function stage(event: EventRow, key: string, extras: JourneyExtras = noExtras) {
  return computeJourney(event, extras).find((s) => s.key === key)!;
}

describe("computeJourney gating", () => {
  it("marks basics complete only with location and guest count", () => {
    expect(stage(makeEvent(), "basics").status).toBe("complete");
    expect(stage(makeEvent({ guest_count: null }), "basics").status).toBe("active");
  });

  it("locks vendors and invites until a venue is chosen", () => {
    const e = makeEvent();
    expect(stage(e, "vendors").status).toBe("locked");
    expect(stage(e, "invites").status).toBe("locked");
  });

  it("unlocks vendors once a venue is chosen", () => {
    const e = makeEvent({ chosen_venue_id: "v1" });
    expect(stage(e, "venue").status).toBe("complete");
    expect(stage(e, "vendors").status).toBe("active");
  });

  it("unlocks invites only when venue chosen AND date known", () => {
    const noDate = makeEvent({ chosen_venue_id: "v1" });
    expect(stage(noDate, "invites").status).toBe("locked");
    const withDate = makeEvent({ chosen_venue_id: "v1", date_precision: "season", date_hint: "Summer 2027" });
    expect(stage(withDate, "invites").status).toBe("active");
  });

  it("respects journey_overrides for manual venue completion", () => {
    const e = makeEvent({ journey_overrides: { venue: "complete" } });
    expect(stage(e, "venue").status).toBe("complete");
    expect(stage(e, "vendors").status).toBe("active");
  });

  it("completes vendors when every engaged category has a booking", () => {
    const e = makeEvent({ chosen_venue_id: "v1" });
    const engagedUnbooked: JourneyExtras = {
      ...noExtras,
      contactedByCategory: { florist: 2 },
      bookedByCategory: {},
    };
    expect(stage(e, "vendors", engagedUnbooked).status).toBe("active");

    const allBooked: JourneyExtras = {
      ...noExtras,
      contactedByCategory: { florist: 2 },
      bookedByCategory: { florist: 1 },
    };
    expect(stage(e, "vendors", allBooked).status).toBe("complete");
  });

  it("does not complete vendors when a category is contacted but unbooked", () => {
    const e = makeEvent({ chosen_venue_id: "v1" });
    const mixed: JourneyExtras = {
      ...noExtras,
      contactedByCategory: { florist: 1, photographer: 1 },
      bookedByCategory: { florist: 1 },
    };
    expect(stage(e, "vendors", mixed).status).toBe("active");
  });
});
