import { describe, it, expect } from "vitest";
import { findSeat, readGuestbookEntry, GUESTBOOK_MESSAGE_MAX } from "./hub";
import type { SeatingPlan } from "@/kalas/screens/seating/model";

const guests = [
  { id: "g1", name: "Mette Holm", email: null, rsvp_token: "tok-mette" },
  { id: "g2", name: "Jonas Krag", email: null, rsvp_token: "tok-jonas" },
  { id: "g3", name: "Anna Berg", email: null, rsvp_token: "tok-anna1" },
  { id: "g4", name: "Anna Berg", email: null, rsvp_token: "tok-anna2" },
];

const plan: SeatingPlan = {
  version: 2,
  tables: [
    { id: "t1", name: "Bord 4", shape: "round", seats: 4, x: 0, y: 0, seated: ["g1", null, "g3", null] },
  ],
};

describe("findSeat", () => {
  it("finds a guest's table by their name, however it is cased", () => {
    expect(findSeat(guests, plan, { name: "  mette holm " })).toEqual({ status: "found", table: "Bord 4" });
  });

  it("finds it by the personal link's token", () => {
    expect(findSeat(guests, plan, { token: "tok-anna1" })).toEqual({ status: "found", table: "Bord 4" });
  });

  it("says when a guest on the list has no seat yet", () => {
    expect(findSeat(guests, plan, { name: "Jonas Krag" })).toEqual({ status: "not-seated" });
  });

  it("says nothing about a name that is not on the list", () => {
    expect(findSeat(guests, plan, { name: "Mette" })).toEqual({ status: "unknown" });
    expect(findSeat(guests, plan, { name: "x" })).toEqual({ status: "unknown" });
  });

  it("will not guess between two guests with the same name", () => {
    expect(findSeat(guests, plan, { name: "Anna Berg" })).toEqual({ status: "ambiguous" });
  });
});

describe("readGuestbookEntry", () => {
  it("trims what a guest wrote", () => {
    expect(readGuestbookEntry({ name: " Ida ", message: " Tillykke! " })).toEqual({ name: "Ida", message: "Tillykke!" });
  });

  it("refuses an empty or oversized entry", () => {
    expect("error" in readGuestbookEntry({ name: "Ida", message: "" })).toBe(true);
    expect("error" in readGuestbookEntry({ name: "", message: "Hej" })).toBe(true);
    expect("error" in readGuestbookEntry({ name: "Ida", message: "x".repeat(GUESTBOOK_MESSAGE_MAX + 1) })).toBe(true);
    expect("error" in readGuestbookEntry(null)).toBe(true);
  });
});
