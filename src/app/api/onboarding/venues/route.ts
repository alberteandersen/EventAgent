import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet, geocode } from "@/lib/places/client";
import { searchArea, type VenueSuggestion } from "@/lib/venue/search";
import { applyFilters, type VenueFilters } from "@/lib/venue/filter";
import { areaDestination, findRegion } from "@/lib/venue/regions";
import { VENUE_SETTINGS, type VenueSetting } from "@/lib/venue/facts";
import { distanceBetween } from "@/lib/venue/distance";

/**
 * POST /api/onboarding/venues
 *
 * Searches ONE area for wedding venues: Gemini researches, Google Places
 * verifies, the couple's requirements steer the prompt and then filter the
 * result.
 *
 * One area per request is the whole design. A region like "Nordsjælland" is
 * five of these fired in parallel from the client, which is how ~50 venues
 * arrive without any single function going near the platform's budget — and
 * it means results stream in rather than the couple staring at a spinner.
 */

// The platform ignores this (see the note in cron/poll-replies), which is why
// the Places work runs in parallel and why a region is sharded across several
// requests: each one has to fit inside a ~10s function budget.
export const maxDuration = 60;

export type { VenueSuggestion } from "@/lib/venue/search";

interface Body {
  /** Free-text place, or the qualified area when searching a region shard. */
  destination?: string;
  /** Region slug — supplies the country qualifier and the prompt's context. */
  region?: string;
  /** Which shard of the region this request covers, e.g. "Helsingør". */
  area?: string;
  guest_count?: number;
  budget?: string | null;
  loved_destinations?: string[];
  lang?: string;
  filters?: {
    catering?: "in_house" | "any";
    accommodation?: "on_site" | "on_site_or_nearby" | "any";
    settings?: string[];
  };
  /** The couple's own area, for measuring how far each venue is. Free text;
   *  resolved to coordinates here, where the Places key lives. */
  origin?: string;
  /** Names already on screen — "Vis flere" must bring back different venues. */
  exclude?: string[];
  /** Places already on screen. The model can return the same venue under a
   *  different name; the resolved place_id is what actually identifies it. */
  exclude_place_ids?: string[];
}

function cacheKey(args: {
  destination: string;
  guestCount: number | null;
  budget: string | null;
  loved: string[];
  lang: string;
  settings: string[];
  wantsCatering: boolean;
  wantsAccommodation: boolean;
  exclude: string[];
}): string {
  const lovedKey = [...args.loved].sort().join("|").toLowerCase();
  // The exclude set is what makes page 2 page 2, so it has to be part of the
  // key — otherwise "Vis flere" serves the first page back from cache. Hashed
  // because the list grows past 50 names and the key would dwarf the value.
  const pageKey = args.exclude.length
    ? createHash("sha1").update([...args.exclude].sort().join("|").toLowerCase()).digest("hex").slice(0, 12)
    : "0";
  // Only prompt-affecting inputs belong here. The soft filters are applied
  // after the cache read, so toggling "catering i huset" is a cache hit
  // rather than another Gemini call.
  const want = `${args.wantsCatering ? "c" : ""}${args.wantsAccommodation ? "a" : ""}` || "0";
  const settingKey = [...args.settings].sort().join(",") || "0";
  return [
    "venues:v7",
    args.lang,
    args.destination.toLowerCase(),
    args.guestCount ?? 0,
    args.budget ?? "0",
    settingKey,
    want,
    lovedKey,
    pageKey,
  ].join(":");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;

  // A region + area pair resolves to a country-qualified destination.
  const region = findRegion(body.region);
  const area = (body.area ?? "").trim() || null;
  const destination = area && region ? areaDestination(area, region) : (body.destination ?? "").trim();

  if (!destination || destination.length > 120) {
    return Response.json({ error: "destination is required" }, { status: 400 });
  }

  // No guest count means no capacity filter — better than inventing one. The
  // old default of 75 silently filtered nothing while looking like it did.
  const guestCount =
    typeof body.guest_count === "number" && body.guest_count > 0 ? Math.round(body.guest_count) : null;
  const budget = (body.budget ?? "").trim() || null;
  const lang = body.lang === "en" ? "en" : "da";
  const loved = (body.loved_destinations ?? [])
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim().slice(0, 80))
    .slice(0, 20);
  const exclude = (body.exclude ?? [])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 120))
    .slice(0, 60);
  const excludePlaceIds = new Set(
    (body.exclude_place_ids ?? [])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 60)
  );

  const settings = (body.filters?.settings ?? []).filter((s): s is VenueSetting =>
    (VENUE_SETTINGS as readonly string[]).includes(s)
  );
  const wantsCatering = body.filters?.catering === "in_house";
  const wantsAccommodation =
    body.filters?.accommodation === "on_site" || body.filters?.accommodation === "on_site_or_nearby";

  const promptArgs = {
    destination,
    guestCount,
    loved,
    budget,
    lang,
    exclude,
    settings,
    wantsCatering,
    wantsAccommodation,
  };

  // One cached Places lookup, shared by every shard of every later search.
  const originText = (body.origin ?? "").trim().slice(0, 120);
  const origin = originText ? await geocode(originText) : null;

  const key = cacheKey({ ...promptArgs, guestCount, budget });
  let venues = await cacheGet<VenueSuggestion[]>(key);
  if (!venues?.length) {
    venues = await searchArea({ ...promptArgs, area, excludePlaceIds, origin });
    if (venues.length > 0) await cacheSet(key, venues);
  } else {
    // A cached page can still contain something already on screen — the
    // exclude set moves on as the couple browses, the cache does not.
    venues = venues.filter((v) => !v.place_id || !excludePlaceIds.has(v.place_id));
    // The cache is keyed on the search, not on the couple, so distances on a
    // cached page belong to whoever searched first. Recompute them.
    if (origin) {
      venues = venues.map((v) => ({
        ...v,
        distance_km: distanceBetween(origin, v.lat, v.lng),
      }));
    }
  }

  // Hard rules only. Everything soft stays client-side so a toggle re-filters
  // the list it already has instead of costing another search.
  const hardFilters: VenueFilters = { min_capacity: guestCount };
  const { kept, rejected } = applyFilters(venues, hardFilters);

  return Response.json({
    venues: kept.map((k) => k.venue),
    area,
    /** So the UI can say "3 steder skjult — for små til 70 gæster". */
    hidden: { capacity: rejected.length },
  });
}
