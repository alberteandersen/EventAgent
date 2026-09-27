import type { SupabaseClient } from "@supabase/supabase-js";
import { Type, type Content, type Part, type Schema } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "./client";
import { detectOutreachLanguage, type OutreachLanguage } from "@/lib/venue/language";
import {
  logAgentError,
  summarizeContents,
  summarizeFunctionCallParts,
} from "./log";
import { functionDeclarations } from "./tools";
import { parseInviteContent, type InviteContent } from "@/kalas/invitations/content";
import { execPlanningTool } from "./planningTools";
import { execMemoryTool } from "./memory";
import { execWebsiteTool } from "./websiteTools";
import { venueListSchema, quoteSchema, type ExtractedVenue } from "./schemas";
import {
  matchPlace,
  getDetails,
  resolvePhotoUrls,
  mapReviews,
  emailMatchesWebsite,
  isPlausibleVenue,
  type PlaceResult,
} from "@/lib/places/client";
import { rankScore } from "@/lib/ranking";
import { normalizeFacts, parsePrice } from "@/lib/venue/facts";
import {
  agentSystemPrompt,
  VENDOR_SEARCH_PROMPT,
  VENUE_EXTRACTION_PROMPT,
  FIND_EMAIL_PROMPT,
  PERSONALIZE_PROMPT,
  QUOTE_EXTRACTION_PROMPT,
  COMPOSE_OUTREACH_PROMPT,
  REPLY_PROPOSAL_PROMPT,
} from "./prompts";
import {
  isAgentPage,
  type AgentUiAction,
  type ChatMessageRow,
  type ChatToolCall,
  type ChatToolEvent,
  type EmailReplyRow,
  type EventRow,
  type MessagePayload,
  type OutboundEmailRow,
  type QuoteExtraction,
  type ReplyProposalRow,
  type VendorCategory,
  type VenueRow,
} from "@/lib/db/types";

// Read → write → navigate chains need more room than the old 6.
const MAX_ITERATIONS = 8;

export interface AgentTurnResult {
  text: string;
  payload: MessagePayload | null;
  /** Every tool run this turn, in order, for the couple to see. */
  toolCalls: ChatToolCall[];
}

type StatusFn = (status: string) => void;
type UiActionFn = (action: AgentUiAction) => void;
type ToolFn = (event: ChatToolEvent) => void;

/** Long enough to be useful when expanded, short enough to store per message. */
const TOOL_TEXT_LIMIT = 1200;

function clip(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > TOOL_TEXT_LIMIT ? `${text.slice(0, TOOL_TEXT_LIMIT)}…` : text;
}

/** Args as stored: whole when small, a clipped preview when not (a bulk
 *  add_guests can carry hundreds of rows). */
function storedArgs(args: Record<string, unknown>): Record<string, unknown> {
  const text = JSON.stringify(args);
  return text.length > TOOL_TEXT_LIMIT ? { _preview: clip(text) } : args;
}

/**
 * Run one agent turn: feed history + the new user message to Gemini with
 * function declarations, execute any tool calls server-side, loop until the
 * model produces plain text. Tool side effects (event updates, venue inserts,
 * draft rows) are written through the caller's RLS-scoped Supabase client.
 * `onUiAction` streams client-side actions (page navigation) to the app.
 */
export async function runAgentTurn(
  supabase: SupabaseClient,
  event: EventRow,
  history: ChatMessageRow[],
  userMessage: string,
  onStatus: StatusFn = () => {},
  extraContext?: string,
  onUiAction: UiActionFn = () => {},
  onTool: ToolFn = () => {}
): Promise<AgentTurnResult> {
  const ai = getGemini();

  const contents: Content[] = [
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map<Content>((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // Mutable copy so tool executors can see updates within this turn.
  let currentEvent = { ...event };
  let payload: MessagePayload | null = null;
  const toolCalls: ChatToolCall[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction:
            agentSystemPrompt(currentEvent) +
            (extraContext ? `\n\n${extraContext}` : ""),
          tools: [{ functionDeclarations }],
        },
      });
    } catch (err) {
      logAgentError("gemini/agent:generateContent", err, {
        model: GEMINI_MODEL,
        iteration: i,
        eventId: event.id,
        ...summarizeContents(contents),
      });
      throw err;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      logAgentError(
        "gemini/agent:unexpectedFinishReason",
        new Error(`Unexpected finishReason: ${finishReason}`),
        {
          model: GEMINI_MODEL,
          iteration: i,
          eventId: event.id,
          finishReason,
          promptFeedback: response.promptFeedback,
        }
      );
    }

    const responseContent = response.candidates?.[0]?.content;
    const calls =
      responseContent?.parts
        ?.filter((part) => part.functionCall)
        .map((part) => part.functionCall!) ??
      response.functionCalls ??
      [];
    if (calls.length === 0) {
      return { text: response.text ?? "", payload, toolCalls };
    }

    const callSummary = summarizeFunctionCallParts(responseContent?.parts);
    console.log("[gemini/agent:toolCalls]", {
      model: GEMINI_MODEL,
      iteration: i,
      eventId: event.id,
      tools: callSummary.names,
      thoughtSignatures: callSummary.hasThoughtSignature,
      contentsLength: contents.length,
    });

    // Push the API content verbatim — required for thoughtSignature on Gemini 2.5+/3.x.
    if (responseContent) {
      contents.push(responseContent);
    }

    const responseParts: Part[] = [];
    for (const [n, call] of calls.entries()) {
      const args = (call.args ?? {}) as Record<string, unknown>;
      const toolId = `${i}-${n}`;
      const toolName = call.name ?? "";
      onTool({ phase: "start", id: toolId, name: toolName, args: storedArgs(args) });
      let result: Record<string, unknown>;
      try {
        switch (call.name) {
          case "update_event_details":
            onStatus("Saving event details…");
            result = await execUpdateEventDetails(supabase, currentEvent, args);
            currentEvent = (result.event as EventRow) ?? currentEvent;
            delete result.event;
            break;
          case "search_venues": {
            onStatus("Researching options on the web…");
            const search = await execSearchVenues(supabase, currentEvent, args, onStatus);
            result = {
              venue_count: search.venueIds.length,
              venue_names: search.names,
              category: search.category,
            };
            if (search.venueIds.length > 0) {
              payload = {
                kind: "venue_batch",
                venue_ids: search.venueIds,
                category: search.category,
              };
            }
            break;
          }
          case "mark_venue_chosen":
            onStatus("Marking your venue as chosen…");
            result = await execMarkVenueChosen(supabase, currentEvent, args);
            currentEvent = (result.event as EventRow) ?? currentEvent;
            delete result.event;
            break;
          case "find_venue_email":
            onStatus(`Looking up contact email for ${String(args.venue_name ?? "venue")}…`);
            result = await execFindVenueEmail(supabase, args);
            break;
          case "draft_invite_text": {
            onStatus("Writing the invitation wording…");
            const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
            const lines: NonNullable<InviteContent["wording"]> = {};
            for (const key of ["eyebrow", "invite", "closing"] as const) {
              if (text(args[key])) lines[key] = text(args[key]);
            }
            const note = text(args.note);
            if (!Object.keys(lines).length && !note) {
              result = { error: "Give at least one of eyebrow, invite, closing or note" };
              break;
            }
            // The words go on the couple's card, the one the Invitationer page edits.
            const { data: existing } = await supabase
              .from("invitations")
              .select("id, data")
              .eq("event_id", currentEvent.id)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const current = parseInviteContent(existing?.data);
            const data = parseInviteContent({
              ...current,
              wording: { ...current.wording, ...lines },
              ...(note ? { note } : {}),
            });
            const now = new Date().toISOString();
            const { error } = existing
              ? await supabase.from("invitations").update({ data, updated_at: now }).eq("id", existing.id)
              : await supabase.from("invitations").insert({
                  event_id: currentEvent.id,
                  user_id: currentEvent.user_id,
                  template_id: "card",
                  data,
                  status: "draft",
                  updated_at: now,
                });
            if (error) {
              result = { error: error.message };
              break;
            }
            const wording = [lines.eyebrow, lines.invite, lines.closing, note].filter(Boolean).join("\n\n");
            payload = { kind: "invite_brief", wording, style: null };
            result = { ok: true, saved_to: "the invitation card on the Invitationer page" };
            break;
          }
          case "propose_email_draft": {
            onStatus("Drafting the outreach email…");
            const draft = await execProposeDraft(supabase, currentEvent, args);
            result = { draft_id: draft.id, version: draft.version };
            payload = { kind: "draft", draft_id: draft.id };
            break;
          }
          case "mark_vendor_booked":
            onStatus("Marking the vendor as booked…");
            result = await execMarkVendorBooked(supabase, currentEvent, args);
            currentEvent = (result.event as EventRow) ?? currentEvent;
            delete result.event;
            break;
          case "mark_stage_complete":
            onStatus("Updating your journey…");
            result = await execMarkStageComplete(supabase, currentEvent, args);
            currentEvent = (result.event as EventRow) ?? currentEvent;
            delete result.event;
            break;
          case "update_website_design":
            onStatus("Designing your wedding website…");
            result = await execUpdateWebsiteDesign(supabase, currentEvent, args);
            break;
          case "propose_vendor_reply": {
            onStatus("Drafting a reply to the vendor…");
            const proposal = await execProposeVendorReply(supabase, currentEvent, args);
            if (proposal) {
              result = { proposal_id: proposal.id };
              payload = { kind: "reply_proposal", proposal_id: proposal.id };
            } else {
              result = { error: "Could not find that vendor reply to respond to" };
            }
            break;
          }
          case "show_page":
            result = execShowPage(args, onUiAction);
            break;
          default: {
            // Memory and planning/data tools (budget, guests, tasks, registry,
            // vendor board) live in their own modules; unknown names fall through.
            const own =
              (await execMemoryTool(supabase, currentEvent, toolName, args)) ??
              (await execWebsiteTool(supabase, currentEvent, toolName, args)) ??
              (await execPlanningTool(supabase, currentEvent, toolName, args));
            if (own) {
              result = own;
            } else {
              logAgentError("gemini/agent:unknownTool", new Error(`Unknown tool: ${call.name}`), {
                eventId: event.id,
                iteration: i,
              });
              result = { error: `Unknown tool: ${call.name}` };
            }
          }
        }
      } catch (err) {
        logAgentError("gemini/agent:toolExecution", err, {
          tool: call.name,
          eventId: event.id,
          iteration: i,
          args,
        });
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      const failed = typeof result.error === "string" ? result.error : undefined;
      const record: ChatToolCall = {
        id: toolId,
        name: toolName,
        args: storedArgs(args),
        ok: !failed,
        ...(failed ? { error: failed } : { result: clip(result) }),
      };
      toolCalls.push(record);
      onTool({ phase: "end", ...record });
      responseParts.push({
        functionResponse: { name: call.name, response: result },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  logAgentError("gemini/agent:maxIterations", new Error("Tool loop exhausted"), {
    model: GEMINI_MODEL,
    eventId: event.id,
    maxIterations: MAX_ITERATIONS,
    ...summarizeContents(contents),
  });

  return {
    text: "I got a bit tangled up there, could you rephrase that?",
    payload,
    toolCalls,
  };
}

// ── Tool executors ──────────────────────────────────────────────────────

/** Fire a navigate action at the client so the requested page appears. */
function execShowPage(
  args: Record<string, unknown>,
  onUiAction: UiActionFn
): Record<string, unknown> {
  const page = args.page;
  if (!isAgentPage(page)) {
    return { error: `Unknown page: ${String(page)}` };
  }
  const action: AgentUiAction = { kind: "navigate", page };
  const category = args.vendor_category;
  if (
    typeof category === "string" &&
    ["venue", "florist", "photographer", "musician", "caterer", "planner", "other"].includes(category)
  ) {
    action.vendor_category = category as VendorCategory;
  }
  const tab = args.hub_tab;
  if (tab === "explore" || tab === "shortlist" || tab === "booked") {
    action.hub_tab = tab;
  }
  onUiAction(action);
  return { ok: true, note: `The ${page} page is now on the user's screen.` };
}

async function execUpdateEventDetails(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "event_type", "location", "guest_count", "event_date", "budget"]) {
    if (args[key] !== undefined && args[key] !== null) patch[key] = args[key];
  }
  // Keep date_precision / date_hint consistent with event_date so journey
  // gating and the hub countdown never read stale values.
  if (patch.event_date) {
    patch.date_precision = "exact";
    patch.date_hint = null;
  } else if (typeof args.date_hint === "string" && args.date_hint.trim()) {
    patch.date_hint = args.date_hint.trim();
    if (event.date_precision === "undecided") patch.date_precision = "season";
  }
  if (args.requirements && typeof args.requirements === "object") {
    patch.requirements = { ...event.requirements, ...(args.requirements as object) };
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, event: data as EventRow };
}

const VENDOR_CATEGORIES: VendorCategory[] = [
  "venue",
  "florist",
  "photographer",
  "musician",
  "caterer",
  "planner",
  "accommodation",
  "other",
];

interface EnrichedCandidate {
  extracted: ExtractedVenue;
  place: PlaceResult | null;
  photoUrls: string[];
  score: number;
}

/**
 * Grounded research → structured extraction → Google Places verification.
 * Gemini decides which options fit the couple; Places supplies the facts
 * (existence, canonical contact info, rating, reviews, photos, coordinates).
 */
async function execSearchVenues(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>,
  onStatus: StatusFn = () => {}
): Promise<{ venueIds: string[]; names: string[]; category: VendorCategory }> {
  const ai = getGemini();
  const location = String(args.location ?? event.location ?? "");
  const guestCount = (args.guest_count as number | undefined) ?? event.guest_count;
  const category: VendorCategory = VENDOR_CATEGORIES.includes(
    args.category as VendorCategory
  )
    ? (args.category as VendorCategory)
    : "venue";
  if (!location) throw new Error("Location is required before searching");

  const vibes = Array.isArray(event.requirements?.vibes)
    ? (event.requirements.vibes as string[])
    : [];

  // Call A: grounded search (no schema/function-calling allowed alongside grounding).
  let grounded;
  try {
    grounded = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: VENDOR_SEARCH_PROMPT({
        category,
        query: String(args.query ?? ""),
        location,
        guestCount,
        eventType: event.event_type,
        vibes,
        budget: event.budget,
      }),
      config: { tools: [{ googleSearch: {} }] },
    });
  } catch (err) {
    logAgentError("gemini/agent:searchVenues:grounded", err, {
      model: GEMINI_MODEL,
      eventId: event.id,
      location,
      category,
    });
    throw err;
  }

  const groundedText = grounded.text ?? "";
  if (!groundedText.trim()) throw new Error("Web search returned no results");

  const sourceUrls =
    grounded.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((c) => c.web?.uri)
      .filter((u): u is string => Boolean(u)) ?? [];

  // Call B: structured extraction into venue rows.
  let extraction;
  try {
    extraction = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: VENUE_EXTRACTION_PROMPT(groundedText),
      config: {
        responseMimeType: "application/json",
        responseSchema: venueListSchema,
      },
    });
  } catch (err) {
    logAgentError("gemini/agent:searchVenues:extraction", err, {
      model: GEMINI_MODEL,
      eventId: event.id,
      groundedTextLength: groundedText.length,
    });
    throw err;
  }

  const parsed = JSON.parse(extraction.text ?? "{}") as { venues?: ExtractedVenue[] };
  const extractedList = (parsed.venues ?? []).filter((v) => v.name?.trim());
  if (extractedList.length === 0) {
    throw new Error("No venues could be extracted from search results");
  }

  // Verify against Google Places: existence, canonical facts, dedupe.
  onStatus("Verifying on Google Places…");
  const matches = await Promise.all(
    extractedList.map((v) => matchPlace(v.name, location))
  );

  // Skip places already on this event's board (repeat searches) and
  // duplicates within the batch; drop permanently closed businesses.
  const { data: existingRows } = await supabase
    .from("venues")
    .select("place_id")
    .eq("event_id", event.id)
    .not("place_id", "is", null);
  const seenPlaceIds = new Set(
    (existingRows ?? []).map((r) => r.place_id as string)
  );

  const candidates: { extracted: ExtractedVenue; place: PlaceResult | null }[] = [];
  for (let i = 0; i < extractedList.length; i++) {
    const place = matches[i];
    if (place) {
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      // For venues, drop obvious non-venues (playgrounds, offices, shops) that
      // a name match let through — same guard as the explore page.
      if (category === "venue" && !isPlausibleVenue(place)) continue;
      if (seenPlaceIds.has(place.id)) continue;
      seenPlaceIds.add(place.id);
    }
    // Unmatched candidates are kept (small-town coverage gaps) but unverified.
    candidates.push({ extracted: extractedList[i], place });
  }
  if (candidates.length === 0) {
    throw new Error("All found venues were already on the board or closed");
  }

  // Details (reviews) + photos only for the places we're keeping.
  onStatus("Pulling reviews and photos…");
  const enriched: EnrichedCandidate[] = await Promise.all(
    candidates.map(async (c) => {
      const details = c.place ? await getDetails(c.place.id) : null;
      const place = details ?? c.place;
      const photoUrls = await resolvePhotoUrls(place?.photos, 4);
      return {
        extracted: c.extracted,
        place,
        photoUrls,
        score: rankScore({ extracted: c.extracted, place }, guestCount, vibes, {
          facts: normalizeFacts(c.extracted, {
            capacity: c.extracted.capacity,
            price_hint: c.extracted.price_hint,
          }),
          budget: parsePrice(event.budget),
        }),
      };
    })
  );
  enriched.sort((a, b) => b.score - a.score);

  const rows = enriched.map(({ extracted: v, place, photoUrls }) => {
    const facts = normalizeFacts(v, { capacity: v.capacity, price_hint: v.price_hint });
    const website = place?.websiteUri ?? v.website ?? null;
    const email = v.email ?? null;
    const emailVerified = emailMatchesWebsite(email, website);
    return {
      event_id: event.id,
      user_id: event.user_id,
      name: place?.displayName?.text ?? v.name,
      description: v.description ?? place?.editorialSummary?.text ?? null,
      address: place?.formattedAddress ?? v.address ?? null,
      website,
      // Keep a Gemini-found email only when its domain matches the
      // canonical website; otherwise leave it for find_venue_email.
      email: emailVerified ? email : null,
      phone: place?.nationalPhoneNumber ?? v.phone ?? null,
      capacity: v.capacity ?? null,
      price_hint: v.price_hint ?? null,
      // Same structured facts the explore page writes, so a venue Ava adds
      // is filterable on capacity and budget like any other.
      capacity_seated: facts.capacity_seated,
      capacity_standing: facts.capacity_standing,
      price_from: facts.price_from,
      price_unit: facts.price_unit,
      catering: facts.catering,
      accommodation: facts.accommodation,
      rooms: facts.rooms,
      setting: facts.setting,
      image_url: photoUrls[0] ?? null,
      source_urls: sourceUrls,
      place_id: place?.id ?? null,
      rating: place?.rating ?? null,
      review_count: place?.userRatingCount ?? null,
      reviews: place ? mapReviews(place) : [],
      photo_urls: photoUrls,
      lat: place?.location?.latitude ?? null,
      lng: place?.location?.longitude ?? null,
      price_level: place?.priceLevel ?? null,
      business_status: place?.businessStatus ?? null,
      why_fit: v.why_fit ?? null,
      contact_verified: emailVerified,
      category,
    };
  });

  const { data, error } = await supabase
    .from("venues")
    .insert(rows)
    .select("id, name");
  if (error) throw new Error(error.message);

  await supabase.from("events").update({ status: "swiping" }).eq("id", event.id);

  return {
    venueIds: (data ?? []).map((d) => d.id as string),
    names: (data ?? []).map((d) => d.name as string),
    category,
  };
}

/** Record the venue decision — the fact that unlocks vendors and invites. */
async function execMarkVenueChosen(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const venueId = typeof args.venue_id === "string" ? args.venue_id : null;
  const patch: Record<string, unknown> = {};

  if (venueId) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, name")
      .eq("id", venueId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!venue) return { error: "That venue is not on this wedding's board" };
    patch.chosen_venue_id = venueId;
  } else if (args.booked_externally) {
    patch.journey_overrides = { ...event.journey_overrides, venue: "complete" };
  } else {
    return { error: "Pass venue_id, or booked_externally when booked outside the app" };
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, event: data as EventRow };
}

/** Record that a vendor (or venue) has been booked. */
async function execMarkVendorBooked(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const venueId = typeof args.venue_id === "string" ? args.venue_id : null;
  if (!venueId) return { error: "Pass the vendor's venue_id" };

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, category")
    .eq("id", venueId)
    .eq("event_id", event.id)
    .maybeSingle();
  if (!venue) return { error: "That vendor is not on this wedding's board" };

  await supabase
    .from("venues")
    .update({ booked_at: new Date().toISOString() })
    .eq("id", venueId);

  // Booking a venue also settles the venue stage if not already chosen.
  if (venue.category === "venue" && !event.chosen_venue_id) {
    const { data } = await supabase
      .from("events")
      .update({ chosen_venue_id: venueId })
      .eq("id", event.id)
      .select()
      .single();
    return { ok: true, booked: venue.name, event: data as EventRow };
  }
  return { ok: true, booked: venue.name };
}

/** Manually mark a whole journey stage complete via journey_overrides. */
async function execMarkStageComplete(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const stage = String(args.stage ?? "");
  if (!["venue", "vendors", "invites"].includes(stage)) {
    return { error: "stage must be venue, vendors or invites" };
  }
  const { data, error } = await supabase
    .from("events")
    .update({
      journey_overrides: { ...event.journey_overrides, [stage]: "complete" },
    })
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, event: data as EventRow };
}

/** Design or restyle the couple's wedding website via the shared generator. */
async function execUpdateWebsiteDesign(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const instruction = String(args.instruction ?? "").trim();
  if (!instruction) return { error: "instruction is required" };
  const regenerate = args.regenerate === true;

  const { hasWebsiteAccess } = await import("@/lib/website/access");
  const { buildSiteHtml } = await import("@/lib/website/buildSite");
  if (!(await hasWebsiteAccess(supabase, event.id))) {
    return {
      error: "payment_required",
      message:
        "The AI website designer is a paid feature the couple hasn't unlocked yet. Tell them to open Hjemmeside in the app to unlock it.",
    };
  }

  await buildSiteHtml({
    supabase,
    event,
    userId: event.user_id,
    // Explicit fresh start → the wish becomes the brief for a full rebuild.
    ...(regenerate ? { styleDirection: instruction } : { instruction }),
  });
  return {
    ok: true,
    note: "The site was rebuilt. The couple can see it under Hjemmeside in the app.",
  };
}

/** Draft a revised reply proposal for a vendor reply the user is discussing. */
async function execProposeVendorReply(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<ReplyProposalRow | null> {
  const replyId = typeof args.reply_id === "string" ? args.reply_id : null;
  const body = String(args.body ?? "").trim();
  if (!replyId || !body) return null;

  const { data: reply } = await supabase
    .from("email_replies")
    .select("*")
    .eq("id", replyId)
    .eq("event_id", event.id)
    .maybeSingle();
  if (!reply) return null;
  const replyRow = reply as EmailReplyRow;

  // Supersede any pending proposal for this reply, then insert the new one.
  await supabase
    .from("reply_proposals")
    .update({ status: "superseded" })
    .eq("email_reply_id", replyId)
    .eq("status", "proposed");

  const { data: proposal, error } = await supabase
    .from("reply_proposals")
    .insert({
      email_reply_id: replyRow.id,
      outbound_email_id: replyRow.outbound_email_id,
      venue_id: replyRow.venue_id,
      event_id: replyRow.event_id,
      user_id: replyRow.user_id,
      body,
    })
    .select()
    .single();
  if (error) return null;
  return proposal as ReplyProposalRow;
}

async function execFindVenueEmail(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const venueId = String(args.venue_id ?? "");
  const venueName = String(args.venue_name ?? "");

  // Prefer the Places-canonical website stored on the row over whatever
  // the model passed — it is the ground truth for domain validation.
  const { data: venueRow } = await supabase
    .from("venues")
    .select("website")
    .eq("id", venueId)
    .maybeSingle();
  const website =
    (venueRow?.website as string | null) ?? (args.website as string | undefined) ?? null;

  const email = await findVenueEmail(venueName, website);
  const verified = emailMatchesWebsite(email, website);

  await supabase
    .from("venues")
    .update({
      email: email ?? undefined,
      email_lookup_status: email ? "found" : "not_found",
      contact_verified: verified,
    })
    .eq("id", venueId);

  if (!email) {
    return {
      found: false,
      note: "No contact email found; this venue will be skipped when sending.",
    };
  }
  return verified
    ? { found: true, email, verified: true }
    : {
        found: true,
        email,
        verified: false,
        note: "Email domain does not match the venue's website, double-check before sending.",
      };
}

/** Grounded lookup of a single venue's contact email. Exported for reuse. */
export async function findVenueEmail(
  venueName: string,
  website?: string | null
): Promise<string | null> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: FIND_EMAIL_PROMPT(venueName, website),
    config: { tools: [{ googleSearch: {} }] },
  });
  const text = (response.text ?? "").trim();
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match || text.includes("NOT_FOUND")) return null;
  return match[0].toLowerCase();
}

const VENDOR_CATEGORY_SET = new Set<VendorCategory>([
  "venue",
  "florist",
  "photographer",
  "musician",
  "caterer",
  "planner",
  "accommodation",
  "other",
]);

async function execProposeDraft(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<{ id: string; version: number }> {
  const subject = String(args.subject ?? "").trim();
  const body = String(args.body_template ?? "").trim();
  if (!subject || !body) throw new Error("Draft needs a subject and body_template");
  if (!body.includes("{{venue_name}}")) {
    throw new Error("body_template must contain the {{venue_name}} placeholder");
  }
  const category: VendorCategory = VENDOR_CATEGORY_SET.has(args.category as VendorCategory)
    ? (args.category as VendorCategory)
    : "venue";

  const { data: latest } = await supabase
    .from("email_drafts")
    .select("version")
    .eq("event_id", event.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("email_drafts")
    .insert({
      event_id: event.id,
      user_id: event.user_id,
      subject,
      body_template: body,
      version,
      category,
    })
    .select("id, version")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("events").update({ status: "drafting" }).eq("id", event.id);
  return { id: data.id as string, version: data.version as number };
}

// ── Standalone Gemini helpers used outside the chat loop ────────────────

/** One-line summary of the wedding facts for outreach/reply prompts. */
export function eventFactsLine(event: EventRow): string {
  return (
    [
      event.event_type,
      event.location && `in ${event.location}`,
      event.guest_count && `${event.guest_count} guests`,
      event.event_date ? `on ${event.event_date}` : event.date_hint,
      event.budget && `budget ${event.budget}`,
    ]
      .filter(Boolean)
      .join(", ") || "details still being gathered"
  );
}

/** Personalize the approved master template for one venue (plain call, no tools). */
export async function personalizeEmail(args: {
  template: string;
  venueName: string;
  venueDescription?: string | null;
}): Promise<string> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: PERSONALIZE_PROMPT(args),
  });
  const text = (response.text ?? "").trim();
  // Fall back to simple substitution if the model returns nothing usable.
  return text || args.template.replaceAll("{{venue_name}}", args.venueName);
}

const outreachEmailSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ["subject", "body"],
};

export interface ComposedOutreach {
  subject: string;
  body: string;
  language: OutreachLanguage;
}

/**
 * Tidy a composed body for text/plain delivery: real newlines only, no
 * runs of blank lines, no trailing whitespace on a line. Structure comes
 * from the prompt — this only cleans up what the model returned.
 */
function normalizeEmailBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Compose a genuinely individual outreach email for one vendor, in that
 * vendor's own language, using the master draft as the brief. Falls back to
 * the draft with plain substitution.
 */
export async function composeOutreachEmail(args: {
  template: string;
  subject: string;
  event: EventRow;
  venue: Pick<
    VenueRow,
    "name" | "description" | "why_fit" | "reviews" | "category" | "address" | "website"
  >;
}): Promise<ComposedOutreach> {
  // Vendors read their own language first — the brief is translated per
  // recipient rather than mail-merged in the couple's language.
  const language = detectOutreachLanguage({
    address: args.venue.address,
    website: args.venue.website,
    eventLocation: args.event.location,
  });

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: COMPOSE_OUTREACH_PROMPT({
        template: args.template,
        subject: args.subject,
        venueName: args.venue.name,
        category: args.venue.category === "venue" ? "venue" : args.venue.category,
        languageName: language.name,
        venueDescription: args.venue.description,
        whyFit: args.venue.why_fit,
        reviewSnippet: args.venue.reviews?.find((r) => r.text)?.text?.slice(0, 200) ?? null,
        eventFacts: eventFactsLine(args.event),
      }),
      config: { responseMimeType: "application/json", responseSchema: outreachEmailSchema },
    });
    const parsed = JSON.parse(response.text ?? "{}") as {
      subject?: string;
      body?: string;
    };
    const body = normalizeEmailBody(parsed.body ?? "");
    if (body) {
      return {
        subject: (parsed.subject ?? "").trim() || args.subject,
        body,
        language,
      };
    }
  } catch (err) {
    logAgentError("gemini/agent:composeOutreach", err, { venue: args.venue.name });
  }
  // Fallback keeps the couple's own draft rather than sending nothing.
  return {
    subject: args.subject,
    body: args.template.replaceAll("{{venue_name}}", args.venue.name),
    language,
  };
}

/**
 * Draft Ava's proposed response to a vendor reply and persist it as a
 * reply_proposals row (superseding earlier proposals for the same reply).
 * Best-effort: returns null on any failure, never throws.
 */
export async function generateReplyProposal(
  admin: SupabaseClient,
  reply: EmailReplyRow
): Promise<ReplyProposalRow | null> {
  try {
    const [{ data: event }, { data: venue }, { data: outbound }] = await Promise.all([
      admin.from("events").select("*").eq("id", reply.event_id).single(),
      admin.from("venues").select("*").eq("id", reply.venue_id).single(),
      admin.from("outbound_emails").select("*").eq("id", reply.outbound_email_id).single(),
    ]);
    if (!event || !venue || !outbound) return null;
    const eventRow = event as EventRow;
    const venueRow = venue as VenueRow;
    const outboundRow = outbound as OutboundEmailRow;

    const coupleName = eventRow.title.replace(/'s wedding$/i, "").trim() || "the couple";

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: REPLY_PROPOSAL_PROMPT({
        venueName: venueRow.name,
        category: venueRow.category === "venue" ? "venue" : venueRow.category,
        coupleName,
        eventFacts: eventFactsLine(eventRow),
        ourLastMessage: outboundRow.body.slice(0, 1500),
        vendorReply: (reply.body ?? reply.snippet ?? "").slice(0, 3000),
        quoteSummary: reply.quote?.summary ?? null,
      }),
    });
    const body = (response.text ?? "").trim();
    if (!body) return null;

    await admin
      .from("reply_proposals")
      .update({ status: "superseded" })
      .eq("email_reply_id", reply.id)
      .eq("status", "proposed");

    const { data: proposal, error } = await admin
      .from("reply_proposals")
      .insert({
        email_reply_id: reply.id,
        outbound_email_id: reply.outbound_email_id,
        venue_id: reply.venue_id,
        event_id: reply.event_id,
        user_id: reply.user_id,
        body,
      })
      .select()
      .single();
    if (error) return null;
    return proposal as ReplyProposalRow;
  } catch (err) {
    logAgentError("gemini/agent:generateReplyProposal", err, { replyId: reply.id });
    return null;
  }
}

/** Extract quote details from a venue's reply (structured output). */
export async function extractQuote(args: {
  venueName: string;
  replyBody: string;
}): Promise<QuoteExtraction> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: QUOTE_EXTRACTION_PROMPT(args),
    config: {
      responseMimeType: "application/json",
      responseSchema: quoteSchema,
    },
  });
  return JSON.parse(response.text ?? "{}") as QuoteExtraction;
}

export function quoteStatusFromExtraction(
  q: QuoteExtraction
): "quoted" | "no_availability" | "needs_info" | "unclear" {
  if (q.availability === "unavailable") return "no_availability";
  if (q.has_quote) return "quoted";
  if (q.availability === "available") return "needs_info";
  return "unclear";
}
