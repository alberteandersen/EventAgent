// Google Places API (New) client: match, validate and enrich venues/vendors.
// Same contract as the original photos helper — every function is
// best-effort and never throws, so enrichment can't break a search.
//
// Cost shape: one Text Search per candidate (matchPlace), one Place Details
// (reviews SKU) only for places we actually keep.

import { createAdminClient } from "@/lib/supabase/admin";
import type { VenueReview } from "@/lib/db/types";

const PLACES_BASE = "https://places.googleapis.com/v1";
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // Places facts are stable for a week

/** Best-effort read from places_cache; null on miss/expiry/error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("places_cache")
      .select("payload, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.fetched_at as string).getTime() > CACHE_TTL_MS) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

/** Best-effort write to places_cache; failures are swallowed. */
export async function cacheSet(key: string, payload: unknown): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("places_cache")
      .upsert({ cache_key: key, payload, fetched_at: new Date().toISOString() });
  } catch {
    // best-effort
  }
}

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.priceLevel",
  "places.businessStatus",
  "places.photos",
  "places.primaryType",
  "places.types",
  // Text Search returns this too, so a discovery card needs no Details call.
  // Details is still the only source of `reviews`, which the agent's board
  // rows use — see getDetails.
  "places.editorialSummary",
  // Amenities. These look like an upgrade and are not: Google bills a request
  // at the highest SKU tier in its field mask, and `editorialSummary` above
  // already puts every search on Text Search Enterprise + Atmosphere.
  // parkingOptions / goodForChildren / allowsDogs sit in that same tier, and
  // accessibilityOptions in the cheaper Pro tier — so all four are free here.
  "places.accessibilityOptions",
  "places.parkingOptions",
  "places.goodForChildren",
  "places.allowsDogs",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "reviews",
  "websiteUri",
  "nationalPhoneNumber",
  "priceLevel",
  "businessStatus",
  "photos",
  "editorialSummary",
  "primaryType",
  "types",
].join(",");

interface PlacePhoto {
  name: string; // "places/XXX/photos/YYY"
}

export interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  priceLevel?: string;
  businessStatus?: string;
  photos?: PlacePhoto[];
  primaryType?: string;
  types?: string[];
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    authorAttribution?: { displayName?: string };
  }[];
  editorialSummary?: { text?: string };
  /* Amenities. Google's own answers, not a model's reading of a website —
     see lib/venue/amenities.ts for why they are kept apart from VenueFacts. */
  accessibilityOptions?: {
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
    freeGarageParking?: boolean;
    paidGarageParking?: boolean;
  };
  goodForChildren?: boolean;
  allowsDogs?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
   Place-type classification
   Google Places (New) tags each place with a `primaryType` and a list of
   `types`. We use these to keep discovery focused: a venue search should not
   surface playgrounds, schools, offices, shops or transit stops just because
   their name token-matched, and an accommodation search should only surface
   real lodging.
   ────────────────────────────────────────────────────────────────────────── */

/** Types that on their own mean "not a wedding venue" — see isPlausibleVenue. */
const NON_VENUE_TYPES = new Set<string>([
  // Civic / government / offices
  "local_government_office", "city_hall", "courthouse", "embassy", "police",
  "fire_station", "post_office", "government_office",
  // Education / childcare
  "school", "primary_school", "secondary_school", "preschool",
  "child_care_agency", "playground",
  // Health
  "hospital", "doctor", "dentist", "pharmacy", "drugstore", "physiotherapist",
  "veterinary_care", "medical_lab",
  // Money / professional services
  "bank", "atm", "accounting", "insurance_agency", "lawyer", "real_estate_agency",
  "travel_agency", "telecommunications_service_provider",
  // Retail / shops
  "store", "grocery_store", "supermarket", "convenience_store", "shopping_mall",
  "department_store", "clothing_store", "shoe_store", "jewelry_store",
  "electronics_store", "furniture_store", "home_goods_store", "hardware_store",
  "book_store", "pet_store", "liquor_store", "gift_shop", "market",
  "wholesaler", "warehouse_store", "auto_parts_store", "bicycle_store",
  "cell_phone_store", "sporting_goods_store",
  // Automotive
  "car_dealer", "car_rental", "car_repair", "car_wash", "gas_station",
  "parking", "electric_vehicle_charging_station",
  // Transit
  "airport", "bus_station", "train_station", "subway_station", "transit_station",
  "taxi_stand", "light_rail_station", "ferry_terminal",
  // Personal services / trades
  "hair_salon", "beauty_salon", "nail_salon", "barber_shop", "laundry",
  "storage", "moving_company", "plumber", "electrician", "locksmith",
  "roofing_contractor", "painter", "funeral_home", "cemetery",
  // Fast / casual food that is not an event space
  "fast_food_restaurant", "meal_takeaway", "meal_delivery", "cafe",
  "coffee_shop", "sandwich_shop", "ice_cream_shop", "donut_shop", "bakery",
  // Recreation that reads wrong for a wedding
  "gym", "fitness_center", "sports_complex", "sports_club", "swimming_pool",
  "amusement_park", "aquarium", "zoo", "bowling_alley", "casino",
  "movie_theater", "shopping_center",
]);

/**
 * Types that positively mark a place as somewhere a wedding could happen.
 * Google stacks types, so a real venue routinely carries a disqualifying tag
 * alongside a qualifying one — an estate with a farm shop is tagged `store`,
 * an event space with a café is tagged `cafe`. Deliberately excludes generic
 * hospitality (`restaurant`, `bar`): those must stand on their own.
 */
const VENUE_TYPES = new Set<string>([
  // Purpose-built event space
  "event_venue", "banquet_hall", "wedding_venue", "convention_center",
  "conference_center", "community_center", "cultural_center", "auditorium",
  "concert_hall", "performing_arts_theater", "opera_house",
  // Culture & heritage
  "museum", "art_gallery", "historical_landmark", "historical_place",
  "cultural_landmark", "monument", "tourist_attraction", "observation_deck",
  // Outdoors
  "park", "garden", "botanical_garden", "national_park", "state_park",
  "beach", "marina", "golf_course", "country_club",
  // Country & wine
  "winery", "vineyard", "farm", "farmstay", "ranch",
  // Places you can also sleep
  "hotel", "resort_hotel", "lodging", "bed_and_breakfast", "guest_house",
  "inn", "cottage", "motel",
  // Ceremony
  "church", "chapel", "place_of_worship", "monastery", "synagogue", "mosque",
  "hindu_temple", "wedding_chapel",
]);

/** Lodging types — what an accommodation search should keep. */
const LODGING_TYPES = new Set<string>([
  "hotel", "resort_hotel", "motel", "bed_and_breakfast", "guest_house",
  "hostel", "inn", "lodging", "cottage", "extended_stay_hotel",
  "budget_japanese_inn", "japanese_inn", "farmstay", "campground",
  "rv_park", "private_guest_room",
]);

function placeTypeTokens(place: Pick<PlaceResult, "primaryType" | "types">): string[] {
  const tokens: string[] = [];
  if (place.primaryType) tokens.push(place.primaryType);
  if (place.types) tokens.push(...place.types);
  return tokens;
}

/**
 * True when a place could plausibly host a wedding/event.
 *
 * A disqualifying type only disqualifies a place that shows no venue signal of
 * its own. Rejecting on any negative tag threw out real venues, because Google
 * stacks types: BaneGaarden is `event_venue` AND `cafe`; Paradehuset is
 * `garden` AND `store`. A plain coffee shop has no positive tag, so it still
 * goes. When a place has no type data at all we keep it (best-effort, already
 * verified by name).
 */
export function isPlausibleVenue(place: Pick<PlaceResult, "primaryType" | "types">): boolean {
  const tokens = placeTypeTokens(place);
  if (tokens.length === 0) return true;
  if (!tokens.some((t) => NON_VENUE_TYPES.has(t))) return true;
  return tokens.some((t) => VENUE_TYPES.has(t));
}

/** True when a place is real lodging (for the accommodation search). */
export function isLodging(place: Pick<PlaceResult, "primaryType" | "types">): boolean {
  const tokens = placeTypeTokens(place);
  return tokens.some((t) => LODGING_TYPES.has(t));
}

function apiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY ?? null;
}

/* The callers treat a failed lookup as "not found", which is right for one
   odd venue and silent for a revoked key: every venue then fails to verify
   and the explore list comes back empty with nothing in the logs. So say why. */
async function logPlacesFailure(op: string, res: Response): Promise<void> {
  const body = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
  console.error(`[places:${op}] ${res.status} ${body?.error?.status ?? ""} ${body?.error?.message ?? ""}`.trim());
}

/** Text Search. Returns [] on any failure. */
export async function searchText(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<PlaceResult[]> {
  const key = apiKey();
  if (!key || !query.trim()) return [];
  const max = opts.maxResults ?? 3;
  // v3: the field mask gained the amenity fields; v2 entries lack them.
  const cacheKey = `search:v3:${query.toLowerCase().trim()}:${max}`;
  const cached = await cacheGet<PlaceResult[]>(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: max,
      }),
    });
    if (!res.ok) {
      await logPlacesFailure("searchText", res);
      return [];
    }
    const data = (await res.json()) as { places?: PlaceResult[] };
    const places = data.places ?? [];
    await cacheSet(cacheKey, places);
    return places;
  } catch {
    return [];
  }
}

/**
 * Coordinates for a free-text place ("Kokkedal, Danmark").
 *
 * Rides on searchText, so it inherits the places_cache: a region searched as
 * twelve parallel shards pays for this once, and every later search of any
 * region reuses it. Returns null on anything unresolvable — the caller must
 * treat that as "no distances", never as a distance of zero.
 */
export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const [place] = await searchText(query, { maxResults: 1 });
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  return lat != null && lng != null ? { lat, lng } : null;
}

/** Place Details (includes reviews). Returns null on any failure. */
export async function getDetails(placeId: string): Promise<PlaceResult | null> {
  const key = apiKey();
  if (!key || !placeId) return null;
  const cacheKey = `details:${placeId}`;
  const cached = await cacheGet<PlaceResult>(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });
    if (!res.ok) {
      await logPlacesFailure("details", res);
      return null;
    }
    const details = (await res.json()) as PlaceResult;
    await cacheSet(cacheKey, details);
    return details;
  } catch {
    return null;
  }
}

/** Resolve up to `count` photo resources into public googleusercontent URLs. */
export async function resolvePhotoUrls(
  photos: PlacePhoto[] | undefined,
  count = 4
): Promise<string[]> {
  const key = apiKey();
  if (!key || !photos?.length) return [];
  const urls = await Promise.all(
    photos.slice(0, count).map(async (photo) => {
      try {
        const res = await fetch(
          `${PLACES_BASE}/${photo.name}/media?maxHeightPx=600&maxWidthPx=800&skipHttpRedirect=true&key=${key}`
        );
        if (!res.ok) return null;
        const media = (await res.json()) as { photoUri?: string };
        return media.photoUri ?? null;
      } catch {
        return null;
      }
    })
  );
  return urls.filter((u): u is string => Boolean(u));
}

export function normalizeTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !["the", "at", "of", "and"].includes(t))
  );
}

/** Token-overlap similarity in [0, 1] against the smaller name. */
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeTokens(a);
  const tb = normalizeTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.min(ta.size, tb.size);
}

/**
 * Find the Places record for a named venue near a location. Guards against
 * matching a different business with a similar generic name — returns null
 * on a weak match rather than guessing.
 */
export async function matchPlace(
  name: string,
  location?: string | null
): Promise<PlaceResult | null> {
  const results = await searchText([name, location].filter(Boolean).join(", "), {
    maxResults: 3,
  });
  for (const place of results) {
    const placeName = place.displayName?.text ?? "";
    if (nameSimilarity(name, placeName) >= 0.5) return place;
  }
  return null;
}

/** Top `count` reviews mapped into the shape stored on the venue row. */
export function mapReviews(place: PlaceResult, count = 3): VenueReview[] {
  return (place.reviews ?? []).slice(0, count).map((r) => ({
    author: r.authorAttribution?.displayName ?? null,
    rating: r.rating ?? null,
    text: r.text?.text ?? null,
    relative_time: r.relativePublishTimeDescription ?? null,
  }));
}

/** Host of a URL without the www. prefix, or null. */
export function urlHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when the email's domain equals (or is a subdomain of) the website host. */
export function emailMatchesWebsite(
  email: string | null | undefined,
  website: string | null | undefined
): boolean {
  const host = urlHost(website);
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!host || !domain) return false;
  return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
}
