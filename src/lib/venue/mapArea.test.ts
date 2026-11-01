import { describe, expect, it } from "vitest";
import { boundsCentre, boundsKey, inBounds, localityOf, parseBounds } from "./mapArea";

const chianti = { south: 43.3, west: 11.2, north: 43.6, east: 11.6 };

describe("parseBounds", () => {
  it("accepts a rectangle", () => {
    expect(parseBounds(chianti)).toEqual(chianti);
  });
  it("rejects anything else", () => {
    expect(parseBounds(null)).toBeNull();
    expect(parseBounds({ ...chianti, north: "43.6" })).toBeNull();
    expect(parseBounds({ ...chianti, north: 43.2 })).toBeNull();
    expect(parseBounds({ ...chianti, east: 200 })).toBeNull();
  });
});

describe("inBounds", () => {
  it("keeps what is inside and drops what is not", () => {
    expect(inBounds(chianti, 43.45, 11.43)).toBe(true);
    expect(inBounds(chianti, 43.77, 11.25)).toBe(false);
    expect(inBounds(chianti, null, 11.4)).toBe(false);
  });
  it("handles a view across the date line", () => {
    const fiji = { south: -20, west: 175, north: -15, east: -178 };
    expect(inBounds(fiji, -17, 179)).toBe(true);
    expect(inBounds(fiji, -17, -179)).toBe(true);
    expect(inBounds(fiji, -17, 0)).toBe(false);
    expect(boundsCentre(fiji).lng).toBeCloseTo(178.5);
  });
});

describe("boundsKey", () => {
  it("ignores drift smaller than the rounding", () => {
    expect(boundsKey(chianti)).toBe(boundsKey({ ...chianti, south: 43.3004 }));
  });
});

describe("localityOf", () => {
  it("takes the town and country off the end", () => {
    expect(localityOf("Località Meleto, 53013 Gaiole in Chianti SI, Italy")).toBe("53013 Gaiole in Chianti SI, Italy");
    expect(localityOf("Hvedholm 5, 5600 Faaborg")).toBe("Hvedholm 5, 5600 Faaborg");
    expect(localityOf("")).toBeNull();
  });
});
