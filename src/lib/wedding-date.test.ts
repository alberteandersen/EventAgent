import { describe, expect, it } from "vitest";
import {
  daysUntilWedding,
  estimateDateFromHint,
  resolveWeddingDate,
} from "./wedding-date";

describe("estimateDateFromHint", () => {
  it("parses Danish autumn season", () => {
    const d = estimateDateFromHint("Efterår 2027");
    expect(d?.getFullYear()).toBe(2027);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(15);
  });

  it("parses English summer season", () => {
    const d = estimateDateFromHint("Summer 2026");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(15);
  });

  it("parses winter into the following January", () => {
    const d = estimateDateFromHint("Vinter 2027");
    expect(d?.getFullYear()).toBe(2028);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(15);
  });

  it("puts a bare year in the middle of it", () => {
    const d = estimateDateFromHint("2028");
    expect(d?.getFullYear()).toBe(2028);
    expect(d?.getMonth()).toBe(6);
  });
});

describe("resolveWeddingDate", () => {
  it("prefers exact event_date", () => {
    expect(
      resolveWeddingDate({
        event_date: "2027-09-12",
        date_precision: "exact",
        date_hint: null,
      }),
    ).toEqual({ iso: "2027-09-12", estimated: false });
  });

  it("estimates from season hint", () => {
    const result = resolveWeddingDate({
      event_date: null,
      date_precision: "season",
      date_hint: "Efterår 2027",
    });
    expect(result.estimated).toBe(true);
    expect(result.iso).toBe("2027-10-15");
  });
});

describe("daysUntilWedding", () => {
  it("returns approximate days for season-only weddings", () => {
    const days = daysUntilWedding(
      {
        event_date: null,
        date_precision: "season",
        date_hint: "Efterår 2027",
      },
      new Date("2026-07-05T12:00:00"),
    );
    expect(days).toBeGreaterThan(400);
    expect(days).toBeLessThan(520);
  });
});
