// "Søg i dette område": the rectangle of map the couple is looking at, as a
// search. Pure, so the route, the search pipeline and the map agree on what
// "inside" means.

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A rectangle off the wire, or null when it is not one. */
export function parseBounds(value: unknown): MapBounds | null {
  if (!value || typeof value !== "object") return null;
  const { south, west, north, east } = value as Record<string, unknown>;
  if (!isNum(south) || !isNum(west) || !isNum(north) || !isNum(east)) return null;
  if (south < -90 || north > 90 || south >= north) return null;
  if (west < -180 || west > 180 || east < -180 || east > 180 || west === east) return null;
  return { south, west, north, east };
}

/** Is the point inside? A map panned across the date line has west > east. */
export function inBounds(bounds: MapBounds, lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (lat < bounds.south || lat > bounds.north) return false;
  return bounds.west <= bounds.east
    ? lng >= bounds.west && lng <= bounds.east
    : lng >= bounds.west || lng <= bounds.east;
}

export function boundsCentre(bounds: MapBounds): { lat: number; lng: number } {
  const width = bounds.west <= bounds.east ? bounds.east - bounds.west : bounds.east + 360 - bounds.west;
  const lng = bounds.west + width / 2;
  return { lat: (bounds.south + bounds.north) / 2, lng: lng > 180 ? lng - 360 : lng };
}

/** North to south, in kilometres. One degree of latitude is about 111 km. */
export function boundsHeightKm(bounds: MapBounds): number {
  return Math.round((bounds.north - bounds.south) * 111);
}

/**
 * Rounded to two decimals, about a kilometre. Fine enough that two different
 * views are two searches, coarse enough that a pixel of drift is a cache hit.
 */
export function boundsKey(bounds: MapBounds): string {
  return [bounds.south, bounds.west, bounds.north, bounds.east].map((n) => n.toFixed(2)).join(",");
}

/**
 * The town and country off the end of a formatted address:
 * "Località Meleto, 53013 Gaiole in Chianti SI, Italy" → "53013 Gaiole in
 * Chianti SI, Italy". A map rectangle has no name of its own, and the search
 * needs one to look things up by, so it borrows the nearest venue's.
 */
export function localityOf(address: string | null | undefined): string | null {
  const parts = (address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.slice(-2).join(", ");
}
