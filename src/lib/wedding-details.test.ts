import { describe, it, expect } from "vitest";
import { eventDetailsPatch } from "./wedding-details";

describe("eventDetailsPatch", () => {
  it("writes only the fields that were sent", () => {
    expect(eventDetailsPatch({ location: " Svendborg " })).toEqual({ patch: { location: "Svendborg" } });
    expect(eventDetailsPatch({})).toEqual({ patch: {} });
  });

  it("clears a field sent empty", () => {
    expect(eventDetailsPatch({ location: "", guest_count: null, budget: "", date_hint: "" }).patch)
      .toEqual({ location: null, guest_count: null, budget: null, date_hint: null });
  });

  it("takes a guest count as a number or as typed text", () => {
    expect(eventDetailsPatch({ guest_count: 80 }).patch).toEqual({ guest_count: 80 });
    expect(eventDetailsPatch({ guest_count: " 120 " }).patch).toEqual({ guest_count: 120 });
  });

  it("refuses a guest count that is not a whole, plausible number", () => {
    for (const bad of [-1, 2.5, 5000, "mange", true]) {
      expect(eventDetailsPatch({ guest_count: bad }).error).toBeTruthy();
    }
  });

  it("keeps the digits of a budget however it was written", () => {
    expect(eventDetailsPatch({ budget: "180.000 kr" }).patch).toEqual({ budget: "180000" });
    expect(eventDetailsPatch({ budget: 225000 }).patch).toEqual({ budget: "225000" });
  });

  it("refuses a budget with no amount in it, or an absurd one", () => {
    expect(eventDetailsPatch({ budget: "det ved vi ikke" }).error).toBeTruthy();
    expect(eventDetailsPatch({ budget: "999999999999" }).error).toBeTruthy();
  });

  it("retitles the wedding when the names change", () => {
    expect(eventDetailsPatch({ names: { name: "Emma Holm", partner: "Frederik" } }).patch)
      .toEqual({ title: "Emma & Frederik's wedding" });
  });

  it("will not save the couple without a name", () => {
    expect(eventDetailsPatch({ names: { name: " ", partner: "Frederik" } }).error).toBeTruthy();
  });

  it("fails the whole save on one bad field", () => {
    const res = eventDetailsPatch({ location: "Odense", guest_count: -3 });
    expect(res.patch).toBeUndefined();
    expect(res.error).toBeTruthy();
  });
});
