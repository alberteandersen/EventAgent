import { describe, expect, it } from "vitest";
import { placeCountry, placeFromText, placeLabel, placesTitle, planShards, type SearchPlace } from "./searchPlan";

describe("placeFromText", () => {
  it("recognises our own regions, in either language", () => {
    expect(placeFromText("Fyn")).toEqual({ kind: "region", slug: "fyn" });
    expect(placeFromText("funen")).toEqual({ kind: "region", slug: "fyn" });
  });
  it("recognises a country by its Danish or English name", () => {
    expect(placeFromText("Italien")).toEqual({ kind: "country", country: "Italy" });
    expect(placeFromText("Italy")).toEqual({ kind: "country", country: "Italy" });
  });
  it("searches everything else as written", () => {
    expect(placeFromText("  Toscana,  Italy ")).toEqual({ kind: "text", query: "Toscana, Italy" });
    expect(placeFromText("   ")).toBeNull();
  });
});

describe("labels", () => {
  it("puts the country in the couple's language", () => {
    expect(placeLabel({ kind: "text", query: "Toscana, Italy" }, "da")).toBe("Toscana, Italien");
    expect(placeLabel({ kind: "country", country: "France" }, "da")).toBe("Frankrig");
    expect(placeCountry({ kind: "text", query: "Toscana, Italy" })).toBe("Italy");
    expect(placeCountry({ kind: "text", query: "Odense" })).toBeNull();
  });
  it("joins a few and counts many", () => {
    const places: SearchPlace[] = [{ kind: "country", country: "Italy" }, { kind: "country", country: "France" }];
    expect(placesTitle(places, "da")).toBe("Italien og Frankrig");
    expect(placesTitle([...places, ...places, ...places], "en")).toBe("6 places");
  });
});

describe("planShards", () => {
  it("searches a region area by area", () => {
    const shards = planShards([{ kind: "region", slug: "fyn" }]);
    expect(shards.length).toBeGreaterThan(1);
    expect(shards.every((s) => s.region === "fyn" && s.area)).toBe(true);
  });

  it("spreads a bare country over its known destinations", () => {
    const destinations = { Italy: ["Toscana", "Comosøen", "Amalfikysten", "Rom", "Puglia"].map((name) => ({ name })) };
    const shards = planShards([{ kind: "country", country: "Italy" }], destinations);
    expect(shards.map((s) => s.destination)).toEqual([
      "Toscana, Italy", "Comosøen, Italy", "Amalfikysten, Italy", "Rom, Italy",
    ]);
  });

  it("searches a country whole when it knows nothing narrower, or has regions to narrow by", () => {
    expect(planShards([{ kind: "country", country: "Portugal" }])).toEqual([{ destination: "Portugal" }]);
    expect(planShards([{ kind: "country", country: "Denmark" }], { Denmark: [{ name: "Skagen" }] }))
      .toEqual([{ destination: "Denmark" }]);
  });

  it("gives every place a turn before any place gets a second", () => {
    const destinations = { Italy: [{ name: "Toscana" }, { name: "Rom" }], France: [{ name: "Provence" }, { name: "Paris" }] };
    const shards = planShards(
      [{ kind: "country", country: "Italy" }, { kind: "country", country: "France" }, { kind: "text", query: "Mallorca" }],
      destinations,
      4,
    );
    expect(shards.map((s) => s.destination)).toEqual(["Toscana, Italy", "Provence, France", "Mallorca", "Rom, Italy"]);
  });

  it("carries the rectangle for a map search, named after what is nearby", () => {
    const bounds = { south: 43.3, west: 11.2, north: 43.6, east: 11.6 };
    expect(planShards([{ kind: "map", bounds, near: "Gaiole in Chianti, Italy" }]))
      .toEqual([{ destination: "Gaiole in Chianti, Italy", bounds }]);
    expect(planShards([{ kind: "map", bounds, near: null }])[0].destination).toBe("43.45, 11.40");
  });
});
