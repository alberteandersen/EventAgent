// What Google knows about a place, as opposed to what a model read on its
// website.
//
// Kept apart from VenueFacts on purpose. `VenueFacts` is inference: Gemini
// reading a venue's own pages and reporting what it thinks it found, right
// most of the time and sparse where a venue is vague. This file is fact —
// Google's structured answers, the same ones shown on a Maps listing. The UI
// can say which is which, and a model can never overwrite the hard data.
//
// These fields cost nothing extra. Google bills a Places request at the
// highest SKU tier in its field mask, and `editorialSummary` — which the
// search already requests so a discovery card needs no Details call — puts
// every search on Text Search Enterprise + Atmosphere. parkingOptions,
// goodForChildren and allowsDogs are in that same tier; accessibilityOptions
// is in the cheaper Pro tier. We were paying for all of it and reading none.

import type { PlaceResult } from "@/lib/places/client";

/** How a guest parks. Ordered by how good the answer is for a wedding. */
export type Parking = "free" | "paid" | "street";

export interface PlaceAmenities {
  /** True when Google reports ANY wheelchair provision — entrance, parking,
   *  restroom or seating. Null when Google says nothing, which is common and
   *  must never be read as "no". */
  wheelchair: boolean | null;
  parking: Parking | null;
  children: boolean | null;
  dogs: boolean | null;
}

export const EMPTY_AMENITIES: PlaceAmenities = {
  wheelchair: null,
  parking: null,
  children: null,
  dogs: null,
};

/**
 * Absent is not false.
 *
 * Google omits an amenity object entirely when it has no data, and omits
 * individual flags within one it does have. A missing `allowsDogs` means
 * "unknown", not "dogs banned" — so only an explicit `false` becomes false.
 */
function tri(value: boolean | undefined): boolean | null {
  return value === undefined ? null : value;
}

function readWheelchair(place: PlaceResult): boolean | null {
  const a = place.accessibilityOptions;
  if (!a) return null;
  const flags = [
    a.wheelchairAccessibleEntrance,
    a.wheelchairAccessibleParking,
    a.wheelchairAccessibleRestroom,
    a.wheelchairAccessibleSeating,
  ];
  if (flags.some((f) => f === true)) return true;
  // An object with only explicit falses is a real "no"; one with only
  // undefineds tells us nothing.
  return flags.some((f) => f === false) ? false : null;
}

/**
 * The best parking a guest could use. Free beats paid beats street: a
 * hundred wedding guests arriving at once care whether there is a lot at all
 * far more than what it costs.
 */
function readParking(place: PlaceResult): Parking | null {
  const p = place.parkingOptions;
  if (!p) return null;
  if (p.freeParkingLot || p.freeGarageParking) return "free";
  if (p.paidParkingLot || p.paidGarageParking || p.valetParking) return "paid";
  if (p.freeStreetParking || p.paidStreetParking) return "street";
  return null;
}

export function readAmenities(place: PlaceResult): PlaceAmenities {
  return {
    wheelchair: readWheelchair(place),
    parking: readParking(place),
    children: tri(place.goodForChildren),
    dogs: tri(place.allowsDogs),
  };
}
