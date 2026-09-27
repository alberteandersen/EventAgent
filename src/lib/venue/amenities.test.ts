import { describe, it, expect } from "vitest";
import { readAmenities, EMPTY_AMENITIES } from "./amenities";
import type { PlaceResult } from "@/lib/places/client";

const place = (over: Partial<PlaceResult> = {}): PlaceResult => ({ id: "p1", ...over });

describe("readAmenities, absent is not false", () => {
  it("returns all-null for a place Google knows nothing about", () => {
    expect(readAmenities(place())).toEqual(EMPTY_AMENITIES);
  });

  it("does not read a missing flag as a no", () => {
    // The distinction that matters: unknown must never badge as "no dogs".
    expect(readAmenities(place()).dogs).toBeNull();
    expect(readAmenities(place({ allowsDogs: false })).dogs).toBe(false);
    expect(readAmenities(place({ allowsDogs: true })).dogs).toBe(true);
  });
});

describe("wheelchair", () => {
  it("is true when any single provision is reported", () => {
    expect(readAmenities(place({ accessibilityOptions: { wheelchairAccessibleEntrance: true } })).wheelchair).toBe(true);
    expect(readAmenities(place({ accessibilityOptions: { wheelchairAccessibleSeating: true } })).wheelchair).toBe(true);
  });

  it("is false only when Google explicitly says no", () => {
    expect(
      readAmenities(place({ accessibilityOptions: { wheelchairAccessibleEntrance: false } })).wheelchair
    ).toBe(false);
  });

  it("is null for an empty options object", () => {
    expect(readAmenities(place({ accessibilityOptions: {} })).wheelchair).toBeNull();
  });

  it("prefers a yes over a no when the flags disagree", () => {
    // Step-free entrance but no accessible restroom is still worth surfacing.
    const a = readAmenities(place({
      accessibilityOptions: { wheelchairAccessibleEntrance: true, wheelchairAccessibleRestroom: false },
    }));
    expect(a.wheelchair).toBe(true);
  });
});

describe("parking", () => {
  it("ranks free above paid above street", () => {
    expect(readAmenities(place({ parkingOptions: { freeParkingLot: true, paidParkingLot: true } })).parking).toBe("free");
    expect(readAmenities(place({ parkingOptions: { paidParkingLot: true, freeStreetParking: true } })).parking).toBe("paid");
    expect(readAmenities(place({ parkingOptions: { freeStreetParking: true } })).parking).toBe("street");
  });

  it("counts a garage as a lot and valet as paid", () => {
    expect(readAmenities(place({ parkingOptions: { freeGarageParking: true } })).parking).toBe("free");
    expect(readAmenities(place({ parkingOptions: { valetParking: true } })).parking).toBe("paid");
  });

  it("is null when there is no parking data", () => {
    expect(readAmenities(place()).parking).toBeNull();
    expect(readAmenities(place({ parkingOptions: {} })).parking).toBeNull();
  });
});
