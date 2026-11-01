// The venue search pipeline: Gemini finds candidates, Google Places verifies
// them, and the filters decide what survives.
//
// Lives here rather than in the route because there were two independent
// implementations of this — the onboarding route and the agent's
// `search_venues` tool — with different prompts, different result counts and
// only one of them ranking anything. The brief, the facts schema and the
// enrichment step are now shared; whatever the couple sees on the explore
// page is what Juno sees too.

import { Type, type Schema } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { type ExtractedVenue } from "@/lib/gemini/schemas";
import {
  isPlausibleVenue,
  matchPlace,
  resolvePhotoUrls,
  type PlaceResult,
} from "@/lib/places/client";
import { normalizeFacts, VENUE_SETTINGS, type RawFacts, type VenueFacts } from "./facts";
import { readAmenities, type PlaceAmenities } from "./amenities";
import { distanceBetween, type Coords } from "./distance";

/** Candidates asked of the model per area. Higher than the number we keep,
 *  because Places verification always rejects some. */
export const PER_AREA_TARGET = 12;
// Only a small margin over what we keep. Generation time scales with how much
// the model has to WRITE, and each extra venue costs ~0.5s of the shard's
// ~10s budget — asking for 18 put the grounded call at 9.6s on its own.
const ASK_FOR = PER_AREA_TARGET + 2;

/**
 * How long grounded web search gets before we give up on it.
 *
 * Grounding latency is wildly variable — measured between 5.8s and 24.5s for
 * the same prompt shape. A shard that runs long is not slow, it is LOST: the
 * platform kills the function and that whole area vanishes from the region.
 * Failing fast into the structured path returns venues the model already
 * knows about — worse data, but far better than an empty area.
 *
 * 6.5s leaves ~3s for Places enrichment inside a ~10s function budget, and
 * sits just above the ~5.8s a healthy grounded call takes.
 */
const GROUNDING_BUDGET_MS = 6500;

/**
 * When to start the structured call alongside grounding rather than after it.
 *
 * Running it as a plain fallback cost the timeout AND the fallback in series
 * — 6.5s of nothing, then 3.6s of structured, then enrichment, which put real
 * shards at 13s. Started early it lands (~3.6s later) before the grounding
 * budget expires, so a lost or thin grounding costs no extra latency at all.
 *
 * It is not really a fallback any more, which is why it fires on nearly every
 * shard: it is a cheap second source. Grounding names what the web says right
 * now; this names what the model already knows. Merging the two is what takes
 * a thin area from six venues to twelve.
 */
const HEDGE_AFTER_MS = 1500;

/** How much of an exclude list the model reads. The full list is still
 *  filtered server-side — this only bounds the prompt, since a 50-name
 *  "avoid" list crowds out the brief that matters. */
const EXCLUDE_IN_PROMPT = 24;

/** A place the couple can save — a venue or any other vendor. */
export interface PlaceSuggestion {
  id: string;
  name: string;
  description: string | null;
  why_fit: string | null;
  address: string | null;
  /** Legacy free-text capacity/price. Kept because the detail view and the
   *  deep-research pass both still render them. */
  capacity: string | null;
  price_hint: string | null;
  /** Null when Google has no photo for the place. The card draws a
   *  setting-tinted placeholder — this used to be a hard drop, which is the
   *  single biggest reason a search for Copenhagen returned seven results. */
  photo: string | null;
  photos: string[];
  rating: number | null;
  review_count: number | null;
  place_id: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
}

/** A venue, with the structured facts the search filters on. Florists and
 *  photographers have no capacity or catering, so they stay PlaceSuggestions. */
export interface VenueSuggestion extends PlaceSuggestion {
  /** Which shard found it, so the UI can show where a venue actually is. */
  area: string | null;
  /** Inferred by the model from the venue's own pages. Often unknown. */
  facts: VenueFacts;
  /** Reported by Google. Fact, not inference — kept separate for that reason. */
  amenities: PlaceAmenities;
  /** Kilometres from the couple's own area, or null when either end has no
   *  coordinates. Every venue we keep has them, so in practice this is set
   *  whenever the couple's location could be resolved. */
  distance_km: number | null;
}

/* ──────────────────────────────────────────────────────────────────────────
   The prompt
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Shared curation brief. Two jobs at once: keep every pick a genuine WEDDING
 * venue (the #1 complaint is random hotels / restaurants / non-venues), while
 * still spreading across aesthetics so the list reveals taste.
 */
export const DIVERSITY_BRIEF = `
FOCUS, every single pick must be a place that genuinely hosts weddings and events: a dedicated wedding/event
venue, an estate, manor, castle, barn or farm that hosts weddings, a vineyard or winery, a historic hall,
orangery or garden, a museum or gallery that rents for events, or a hotel/restaurant ONLY IF it markets a real
wedding offering (a wedding package, event/banquet space, a "bryllup"/"weddings" page). This is a wedding-venue
shortlist, NOT a list of nice places in the city.

Do NOT include: ordinary city or chain business hotels with no wedding offering, everyday restaurants or cafés,
bars, nightclubs, shops, offices, town halls, associations, sports facilities, playgrounds, or private homes.

VARIETY, make the picks feel distinct. Spread across settings where the area allows: ${VENUE_SETTINGS.join(", ")}.
Mix indoor and outdoor, city and countryside, intimate and grand, budget-friendly and splurge. No two picks
should be interchangeable, but never trade the wedding-venue focus for variety.
`.trim();

/**
 * The facts brief. Written to make "unknown" feel like the right answer
 * rather than a failure — an invented capacity silently hides venues from a
 * couple, which is worse than a venue that shows up badged "Kapacitet ukendt".
 */
export const FACTS_BRIEF = `
FACTS, fill these in ONLY from what you actually found. Never estimate, never infer from the building's size,
never copy a number from a similar venue. Leave a field null (or "unknown") whenever you are not confident.
A missing fact is fine; a wrong one sends the couple to a venue that cannot hold their wedding.

- capacity_seated: max guests for a SEATED dinner (integer).
- capacity_standing: max guests for a standing reception (integer).
- price_from: the LOWEST published price, as a plain integer in local currency, no separators.
- price_unit: "total" for a venue-hire fee, "per_guest" when the price is per person / pr. kuvert.
- catering: "in_house" (the venue cooks), "external_allowed" (you bring an approved caterer),
  "own_food_allowed" (you may bring your own food), or "unknown".
- accommodation: "on_site" (guests can sleep at the venue), "nearby" (the venue points at lodging
  within walking or short driving distance), "none", or "unknown".
- rooms: number of rooms on site, only when accommodation is "on_site".
- setting: one of ${VENUE_SETTINGS.join(", ")}.
- ceremony: "on_site" if you can be married at the venue, "outdoor" if the ceremony can be held
  outdoors there, "none" if it only hosts the reception, or "unknown".
- outdoor: "garden", "terrace", "none", or "unknown".
`.trim();

/** Facts fields shared by every venue-producing schema in the codebase. */
export const factsSchemaProps: Record<string, Schema> = {
  capacity_seated: { type: Type.INTEGER, nullable: true },
  capacity_standing: { type: Type.INTEGER, nullable: true },
  price_from: { type: Type.INTEGER, nullable: true },
  price_unit: { type: Type.STRING, nullable: true, enum: ["total", "per_guest"] },
  catering: {
    type: Type.STRING,
    nullable: true,
    enum: ["in_house", "external_allowed", "own_food_allowed", "unknown"],
  },
  accommodation: {
    type: Type.STRING,
    nullable: true,
    enum: ["on_site", "nearby", "none", "unknown"],
  },
  rooms: { type: Type.INTEGER, nullable: true },
  setting: { type: Type.STRING, nullable: true, enum: [...VENUE_SETTINGS] },
  ceremony: { type: Type.STRING, nullable: true, enum: ["on_site", "outdoor", "none", "unknown"] },
  outdoor: { type: Type.STRING, nullable: true, enum: ["garden", "terrace", "none", "unknown"] },
};

/* Facts a grounded web search cannot see, so the schema above does not ask
   for them: rain_plan, own_drinks, exclusive, curfew_hour.

   Measured on one region with the model stopped from guessing: own_drinks 2%,
   exclusive 2%, rain_plan 2%, curfew_hour 9%. They live in FAQ and price
   pages that a search-grounded pass never opens. Asking anyway produced
   confident fabrication ("not_allowed" and "sole_use" for every venue), and
   instructing against that made the model cautious across the board, costing
   accommodation 64% -> 43%. The per-venue deep research pass opens a single
   venue's own site, which is where these can be answered (venue/research.ts). */

const suggestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    venues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING, nullable: true },
          why_fit: { type: Type.STRING, nullable: true },
          capacity: { type: Type.STRING, nullable: true },
          price_hint: { type: Type.STRING, nullable: true },
          ...factsSchemaProps,
        },
        required: ["name"],
      },
    },
  },
  required: ["venues"],
};

/** What the model returns before Places verification. */
type Candidate = ExtractedVenue & RawFacts;

export interface PromptArgs {
  destination: string;
  guestCount: number | null;
  loved: string[];
  budget: string | null;
  lang: string;
  exclude: string[];
  /** Settings the couple asked for, steering the model instead of only
   *  filtering afterwards — a filter cannot conjure a barn the model
   *  never looked for. */
  settings: string[];
  wantsCatering: boolean;
  wantsAccommodation: boolean;
}

function requirementLines(args: PromptArgs): string {
  const lines: string[] = [];
  if (args.guestCount) {
    lines.push(
      `MUST fit at least ${args.guestCount} seated guests, a venue that cannot seat ${args.guestCount} is useless here, skip it.`
    );
  }
  if (args.budget) lines.push(`Budget for the venue: about ${args.budget} DKK in total. Favour places in reach of that.`);
  if (args.settings.length) lines.push(`Lean towards these settings: ${args.settings.join(", ")}.`);
  if (args.wantsCatering) lines.push(`Prefer venues with catering in house.`);
  if (args.wantsAccommodation) lines.push(`Prefer venues where guests can stay the night, on site or right nearby.`);
  return lines.length ? `REQUIREMENTS\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
}

function buildPrompt(args: PromptArgs): string {
  const lovedLine = args.loved.length
    ? `They also hearted these dream places: ${args.loved.join(", ")}. Lean into that vibe and geography where it makes sense.`
    : "";
  const excludeLine = args.exclude.length
    ? `ALREADY SHOWN, do not suggest any of these again, and do not suggest near-duplicates: ${args.exclude.slice(0, EXCLUDE_IN_PROMPT).join(", ")}.`
    : "";
  const langNote = args.lang === "da" ? "Write why_fit in Danish." : "Write why_fit in English.";

  return `
You are a wedding venue curator. Suggest ${ASK_FOR} REAL wedding venues in or near "${args.destination}"${
    args.guestCount ? ` for about ${args.guestCount} guests` : ""
  }. ${lovedLine}

${requirementLines(args)}

${excludeLine}

${DIVERSITY_BRIEF}

${FACTS_BRIEF}

Rules:
- Every "name" must be a real, findable, specific venue or estate (not a city, region, or generic business).
- "why_fit" is ONE warm sentence highlighting THIS venue's distinct wedding vibe (${langNote}).
- "capacity" and "price_hint" are the human-readable versions of the numbers above, in the venue's own words.
- No duplicates. No invented places. No generic hotels/restaurants without a real wedding offering.
`.trim();
}

/** Resolves to null if the promise has not settled in time. Never rejects. */
async function withBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function suggestStructured(args: PromptArgs): Promise<Candidate[]> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(args),
    config: { responseMimeType: "application/json", responseSchema: suggestSchema },
  });
  const parsed = JSON.parse(res.text ?? "{}") as { venues?: Candidate[] };
  return (parsed.venues ?? []).filter((v) => v.name?.trim()).slice(0, ASK_FOR);
}

async function suggestGrounded(args: PromptArgs): Promise<Candidate[]> {
  const ai = getGemini();
  const dest = args.destination;
  const searchPrompt = `Search the web and find ${ASK_FOR} real WEDDING venues in or near ${dest}${
    args.guestCount ? ` for about ${args.guestCount} guests` : ""
  }.
Search for genuine wedding venues, try queries like "bryllupslokale ${dest}", "wedding venue ${dest}",
"bryllupsgård ${dest}", "slot bryllup ${dest}", "hold bryllup ${dest}", and open each candidate's own site to
check its wedding offering, its capacity and its prices.
${args.loved.length ? `Dream places they saved: ${args.loved.join(", ")}.` : ""}

${requirementLines(args)}

${args.exclude.length ? `ALREADY SHOWN, do not return any of these again: ${args.exclude.slice(0, EXCLUDE_IN_PROMPT).join(", ")}.` : ""}

${DIVERSITY_BRIEF}

${FACTS_BRIEF}

Only include places that genuinely host weddings; skip ordinary hotels, restaurants and non-venues even to reach the count.

Return ONLY a JSON array, no prose, no markdown fence. Each element:
{"name":string,"why_fit":string|null,"price_hint":string|null,"capacity_seated":number|null,
"capacity_standing":number|null,"price_from":number|null,"price_unit":"total"|"per_guest"|null,
"catering":string,"accommodation":string,"rooms":number|null,"setting":string|null,"ceremony":string,
"outdoor":string}`;

  // Note what is NOT asked for here.
  //
  // `description` and `address`: Places returns an editorial summary and a
  // canonical formatted address for every venue we keep, so asking the model
  // to write them too bought nothing and cost ~4s of a ~10s function budget.
  //
  // `capacity`: the human-readable duplicate of numbers the model already
  // gives structurally. Dropping it pays for the fields added above, since
  // generation time scales with what is written, and capacity coverage was
  // unharmed (67%).
  //
  // `price_hint` is asked for, though it looks like the same duplication.
  // Dropping it took price coverage from 15% to 2%: the model writes
  // "fra 62.000 kr" far more readily than it emits a bare integer, and
  // parsePrice recovers the number. Measured, not assumed.

  const grounded = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: searchPrompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  const notes = grounded.text?.trim();
  if (!notes) return [];

  // The search tool cannot be combined with responseSchema, so the model is
  // asked for JSON in prose and we parse it. A second Gemini call to
  // structure it pushed the route past the function timeout — the couple
  // then saw "kunne ikke finde venues her" every time. On a parse failure the
  // caller falls through to the structured path.
  const json = notes.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as Candidate[])
    .filter((v) => typeof v?.name === "string" && v.name.trim())
    .slice(0, ASK_FOR);
}

/* ──────────────────────────────────────────────────────────────────────────
   Places verification
   ────────────────────────────────────────────────────────────────────────── */

/** A candidate that survived Places verification, before photos are fetched. */
interface Verified {
  candidate: Candidate;
  place: PlaceResult;
}

/** Best-effort — resolves to null rather than throwing, so one bad candidate
 *  cannot reject the Promise.all that verifies the whole batch. */
async function verify(candidate: Candidate, destination: string): Promise<Verified | null> {
  try {
    const place = await matchPlace(candidate.name, destination);
    if (!place) return null;
    if (place.businessStatus && place.businessStatus !== "OPERATIONAL") return null;
    // Google\'s type tags catch the junk a name match lets through —
    // playgrounds, offices, shops, transit.
    if (!isPlausibleVenue(place)) return null;
    return { candidate, place };
  } catch {
    return null;
  }
}

/** Photos are fetched last, and only for venues that made the cut — four
 *  media lookups per candidate is the most expensive thing here, and doing it
 *  for candidates we were about to discard was most of a shard\'s enrichment
 *  time. A venue with no photo is KEPT: dropping those is the single biggest
 *  reason a search for Copenhagen used to return seven results. */
async function withPhotos(
  { candidate, place }: Verified,
  area: string | null,
  origin: Coords | null
): Promise<VenueSuggestion> {
  const photos = await resolvePhotoUrls(place.photos, 4);
  return {
    id: place.id,
    name: place.displayName?.text ?? candidate.name,
    description: candidate.description ?? place.editorialSummary?.text ?? null,
    why_fit: candidate.why_fit ?? null,
    address: place.formattedAddress ?? candidate.address ?? null,
    capacity: candidate.capacity ?? null,
    price_hint: candidate.price_hint ?? null,
    photo: photos[0] ?? null,
    photos,
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? null,
    place_id: place.id,
    website: place.websiteUri ?? candidate.website ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    area,
    facts: normalizeFacts(candidate, {
      capacity: candidate.capacity,
      price_hint: candidate.price_hint,
    }),
    amenities: readAmenities(place),
    distance_km: distanceBetween(origin, place.location?.latitude, place.location?.longitude),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   One shard
   ────────────────────────────────────────────────────────────────────────── */

export interface AreaSearchArgs extends PromptArgs {
  /** Human label for the shard, e.g. "Helsingør". Null for a free-text search. */
  area: string | null;
  excludePlaceIds: Set<string>;
  /** The couple's own area, for measuring distance. Null when unresolved. */
  origin?: Coords | null;
}

/** The hedge: waits, then runs the structured call unless grounding already
 *  landed. Never throws — an empty list just means the hedge had nothing. */
async function hedgedStructured(
  args: PromptArgs,
  state: { settled: boolean }
): Promise<Candidate[]> {
  await new Promise((resolve) => setTimeout(resolve, HEDGE_AFTER_MS));
  if (state.settled) return [];
  try {
    return await suggestStructured(args);
  } catch {
    return [];
  }
}

/**
 * Search one area. Grounded first, structured as the fallback, then Places
 * verification in parallel — the whole thing has to fit in a ~10s function,
 * which is why a region is searched as several of these rather than one big
 * call.
 */
export async function searchArea(args: AreaSearchArgs): Promise<VenueSuggestion[]> {
  // Grounding is the good path — real, current, web-checked facts — but it is
  // also the one that can blow the function budget, so it runs on a clock with
  // the structured call hedged behind it.
  const state = { settled: false };
  const groundedPromise = suggestGrounded(args)
    .then((r) => { state.settled = true; return r; })
    .catch(() => { state.settled = true; return [] as Candidate[]; });
  const hedgePromise = hedgedStructured(args, state);

  const candidates: Candidate[] = (await withBudget(groundedPromise, GROUNDING_BUDGET_MS)) ?? [];

  // Only wait on the hedge when grounding did not fill the shard. By now it
  // has been running for GROUNDING_BUDGET_MS - HEDGE_AFTER_MS already, so the
  // wait is short or zero.
  if (candidates.length < PER_AREA_TARGET) {
    const seen = new Set(candidates.map((v) => v.name.toLowerCase()));
    for (const v of await hedgePromise) {
      if (!seen.has(v.name.toLowerCase())) candidates.push(v);
    }
  }
  if (candidates.length === 0) return [];

  // Drop what the couple has already seen before paying for enrichment: the
  // instruction not to repeat is a request, not a guarantee.
  const excludeNames = new Set(args.exclude.map((v) => v.trim().toLowerCase()));
  const fresh = candidates.filter((v) => !excludeNames.has(v.name.trim().toLowerCase()));

  // Phase A — verify on Places. One round trip each, and this is what decides
  // which candidates survive at all.
  const verified = await Promise.all(fresh.map((c) => verify(c, args.destination)));

  // Cap before photos, not after.
  const seenPlaces = new Set<string>();
  const keep: Verified[] = [];
  for (const v of verified) {
    if (keep.length >= PER_AREA_TARGET) break;
    if (!v) continue;
    if (seenPlaces.has(v.place.id)) continue;
    // Same place under a different name — only the resolved id catches this.
    if (args.excludePlaceIds.has(v.place.id)) continue;
    seenPlaces.add(v.place.id);
    keep.push(v);
  }

  // Phase B — photos for the survivors only.
  return Promise.all(keep.map((v) => withPhotos(v, args.area, args.origin ?? null)));
}
