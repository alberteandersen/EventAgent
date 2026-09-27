import { describe, it, expect } from "vitest";
import {
  DK_REGIONS, regionsForCountry, findRegion, regionLabel, regionShortLabel,
  areaDestination, groupByRegion, curatedCountryFromLocation, shardsFor, regionsLabel,
} from "./regions";

describe("Danish taxonomy", () => {
  it("covers the words couples actually use", () => {
    const slugs = DK_REGIONS.map((r) => r.slug);
    expect(slugs).toContain("hovedstaden");
    expect(slugs).toContain("nordsjaelland");
    expect(slugs).toContain("fyn");
    expect(slugs).toContain("midtjylland");
    expect(slugs).toContain("bornholm");
  });

  it("gives every region enough areas to shard across", () => {
    for (const r of DK_REGIONS) {
      expect(r.areas.length).toBeGreaterThanOrEqual(4);
      expect(new Set(r.areas).size).toBe(r.areas.length);
    }
  });

  it("has unique slugs", () => {
    const slugs = DK_REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("matches the country in either language", () => {
    expect(regionsForCountry("Denmark")).toHaveLength(DK_REGIONS.length);
    expect(regionsForCountry("danmark")).toHaveLength(DK_REGIONS.length);
    expect(regionsForCountry("Italy")).toEqual([]);
    expect(regionsForCountry(null)).toEqual([]);
  });

  it("looks a region up by slug", () => {
    expect(findRegion("hovedstaden")?.label.da).toBe("København & omegn");
    expect(findRegion("atlantis")).toBeNull();
    expect(findRegion(null)).toBeNull();
  });

  it("labels in both languages", () => {
    const fyn = findRegion("fyn")!;
    expect(regionLabel(fyn, "da")).toBe("Fyn & øerne");
    expect(regionLabel(fyn, "en")).toBe("Funen & the islands");
  });
});

describe("areaDestination", () => {
  it("qualifies every area with its country", () => {
    // Unqualified, "Møn" and "Ribe" are not unambiguous to Google Places.
    const region = findRegion("sydsjaelland")!;
    const areas = region.areas.map((a) => areaDestination(a, region));
    expect(areas).toContain("Møn, Denmark");
    expect(areas.every((a) => a.endsWith(", Denmark"))).toBe(true);
  });
});

describe("groupByRegion", () => {
  const dest = (name: string, region: string | null) => ({ name, region });

  it("groups destinations by their region string", () => {
    const groups = groupByRegion(
      [dest("Siena", "Tuscany"), dest("Florence", "Tuscany"), dest("Positano", "Amalfi"), dest("Ravello", "Amalfi")],
      "Elsewhere"
    );
    expect(groups.map((g) => g.label).sort()).toEqual(["Amalfi", "Tuscany"]);
    expect(groups.find((g) => g.label === "Tuscany")!.destinations).toHaveLength(2);
  });

  it("folds a one-destination region into the fallback, that is a city, not a region", () => {
    const groups = groupByRegion(
      [dest("Siena", "Tuscany"), dest("Florence", "Tuscany"), dest("Venice", "Veneto")],
      "Elsewhere"
    );
    expect(groups.map((g) => g.label).sort()).toEqual(["Elsewhere", "Tuscany"]);
    expect(groups.find((g) => g.label === "Elsewhere")!.destinations.map((d) => d.name)).toEqual(["Venice"]);
  });

  it("puts region-less destinations in the fallback rather than dropping them", () => {
    const groups = groupByRegion([dest("Reykjavik", null), dest("Vik", null)], "Elsewhere");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Elsewhere");
    expect(groups[0].destinations).toHaveLength(2);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByRegion([], "Elsewhere")).toEqual([]);
  });
});

describe("short labels", () => {
  it("gives every region a chip label no longer than its full one", () => {
    for (const r of DK_REGIONS) {
      expect(r.short.da.length).toBeLessThanOrEqual(r.label.da.length);
      expect(r.short.en.length).toBeLessThanOrEqual(r.label.en.length);
    }
  });

  it("keeps chip labels short enough for two per row in the panel", () => {
    // ~370px column, two chips per row, so roughly 16 characters each.
    for (const r of DK_REGIONS) expect(r.short.da.length).toBeLessThanOrEqual(16);
  });

  it("returns the chip label in either language", () => {
    const fyn = findRegion("fyn")!;
    expect(regionShortLabel(fyn, "da")).toBe("Fyn");
    expect(regionShortLabel(fyn, "en")).toBe("Funen");
    // The full label still titles the results.
    expect(regionLabel(fyn, "da")).toBe("Fyn & øerne");
  });
});

describe("curatedCountryFromLocation", () => {
  it("reads the country off the end of a location line", () => {
    expect(curatedCountryFromLocation("Kokkedal, Danmark")).toBe("Denmark");
    expect(curatedCountryFromLocation("København, Denmark")).toBe("Denmark");
    expect(curatedCountryFromLocation("Danmark")).toBe("Denmark");
    expect(curatedCountryFromLocation("Strandvejen 12, 2900 Hellerup, Danmark.")).toBe("Denmark");
  });

  it("never mistakes a street name for a country", () => {
    // The whole reason only the last comma-segment is considered.
    expect(curatedCountryFromLocation("Danmarksgade 5")).toBeNull();
    expect(curatedCountryFromLocation("Danmarksgade 5, Aalborg")).toBeNull();
  });

  it("returns null for countries with no curated taxonomy", () => {
    expect(curatedCountryFromLocation("Siena, Italy")).toBeNull();
    expect(curatedCountryFromLocation("Toscana, Italien")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(curatedCountryFromLocation(null)).toBeNull();
    expect(curatedCountryFromLocation("")).toBeNull();
    expect(curatedCountryFromLocation("   ")).toBeNull();
  });
});

describe("shardsFor", () => {
  const pick = (...slugs: string[]) => slugs.map((s) => findRegion(s)!);

  it("uses every area when one region fits the budget", () => {
    const region = findRegion("hovedstaden")!;
    const shards = shardsFor(pick("hovedstaden"));
    expect(shards).toHaveLength(region.areas.length);
    expect(shards.every((s) => s.region === "hovedstaden")).toBe(true);
  });

  it("covers both regions in full for the two-region case", () => {
    // "Nordsjælland og Fyn" — 5 + 5 = 10, inside the budget of 12.
    const shards = shardsFor(pick("nordsjaelland", "fyn"));
    expect(shards).toHaveLength(10);
    expect(shards.filter((s) => s.region === "nordsjaelland")).toHaveLength(5);
    expect(shards.filter((s) => s.region === "fyn")).toHaveLength(5);
  });

  it("gives every picked region a turn before any gets a second area", () => {
    const shards = shardsFor(pick("hovedstaden", "fyn", "bornholm"));
    expect(shards).toHaveLength(12);
    // The first three shards are one from each region, not three from the first.
    expect(shards.slice(0, 3).map((s) => s.region)).toEqual(["hovedstaden", "fyn", "bornholm"]);
    for (const slug of ["hovedstaden", "fyn", "bornholm"]) {
      expect(shards.some((s) => s.region === slug)).toBe(true);
    }
  });

  it("still represents every region when all ten are picked", () => {
    const shards = shardsFor(DK_REGIONS);
    expect(shards).toHaveLength(12);
    // Ten regions, twelve shards — nobody is left out.
    expect(new Set(shards.map((s) => s.region)).size).toBe(10);
  });

  it("never exceeds the budget", () => {
    expect(shardsFor(DK_REGIONS, 4)).toHaveLength(4);
    expect(shardsFor(pick("bornholm"), 2)).toHaveLength(2);
  });

  it("returns nothing for no regions", () => {
    expect(shardsFor([])).toEqual([]);
  });
});

describe("regionsLabel", () => {
  const pick = (...slugs: string[]) => slugs.map((s) => findRegion(s)!);

  it("uses the full label for a single region", () => {
    expect(regionsLabel(pick("fyn"), "da")).toBe("Fyn & øerne");
  });

  it("joins several with 'og' / 'and'", () => {
    expect(regionsLabel(pick("nordsjaelland", "fyn"), "da")).toBe("Nordsjælland og Fyn");
    expect(regionsLabel(pick("nordsjaelland", "fyn"), "en")).toBe("North Zealand and Funen");
    expect(regionsLabel(pick("fyn", "bornholm", "midtjylland"), "da")).toBe("Fyn, Bornholm og Midtjylland");
  });

  it("counts instead of listing once the names stop being a title", () => {
    // Ten names ran to three lines above the results.
    expect(regionsLabel(DK_REGIONS, "da")).toBe("10 områder");
    expect(regionsLabel(DK_REGIONS, "en")).toBe("10 areas");
    expect(regionsLabel(pick("fyn", "bornholm", "midtjylland", "nordjylland"), "da")).toBe("4 områder");
  });

  it("is empty for no regions", () => {
    expect(regionsLabel([], "da")).toBe("");
  });
});
