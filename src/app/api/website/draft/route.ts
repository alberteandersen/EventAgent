import { NextRequest } from "next/server";
import { Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import { parseConfig, hasContact } from "@/kalas/site/config";
import { sortByTime } from "@/kalas/screens/planning/dayProgram";
import {
  DRAFT_FIELDS, draftPrompt, readDraft,
  type DraftFacts, type DraftFaqItem, type DraftField, type StoryAnswers,
} from "@/lib/website/draft";
import type { DayProgramItemRow, EventRow, ProfileRow, VenueRow, WeddingSiteRow } from "@/lib/db/types";

export const maxDuration = 60;

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    faq: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { id: { type: Type.STRING }, q: { type: Type.STRING }, a: { type: Type.STRING } },
        required: ["q", "a"],
      },
    },
  },
};

const SEASONS_DA = ["vinter", "vinter", "forår", "forår", "forår", "sommer", "sommer", "sommer", "efterår", "efterår", "efterår", "vinter"];

/**
 * POST /api/website/draft — Juno drafts one of the site's texts from what
 * Kalas knows about the wedding (see lib/website/draft.ts for what she may
 * and may not write). Body: { eventId, field, story?, faq? }. Returns
 * { text } or { faq }; nothing is saved, the couple decides in the builder.
 * Not behind the website paywall: a template site needs its words too.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    eventId?: string; field?: string; story?: StoryAnswers; faq?: DraftFaqItem[];
  };
  const eventId = body.eventId ?? "";
  const field = DRAFT_FIELDS.find((f) => f === body.field) as DraftField | undefined;
  if (!eventId || !field) return Response.json({ error: "eventId and field are required" }, { status: 400 });

  const story: StoryAnswers = {
    met: String(body.story?.met ?? "").slice(0, 600),
    knew: String(body.story?.knew ?? "").slice(0, 600),
    ahead: String(body.story?.ahead ?? "").slice(0, 600),
  };
  if (field === "story" && !Object.values(story).some((v) => v?.trim())) {
    return Response.json({ error: "Fortæl Juno lidt om jer først." }, { status: 400 });
  }
  const faq = (Array.isArray(body.faq) ? body.faq : []).slice(0, 30).map((f) => ({
    id: String(f?.id ?? "").slice(0, 80), q: String(f?.q ?? "").slice(0, 200), a: String(f?.a ?? "").slice(0, 600),
  }));

  // RLS scopes every read to the couple's own wedding.
  const { data: eventRow } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  const event = eventRow as EventRow | null;
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const [{ data: profileRow }, { data: siteRow }, { data: dayRows }, { count: registryCount }, { data: venueRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("wedding_sites").select("*").eq("event_id", eventId).maybeSingle(),
    supabase.from("day_program_items").select("*").eq("event_id", eventId),
    supabase.from("registry_items").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    event.chosen_venue_id
      ? supabase.from("venues").select("*").eq("id", event.chosen_venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const profile = profileRow as ProfileRow | null;
  const config = parseConfig((siteRow as WeddingSiteRow | null)?.config);
  const venue = venueRow as VenueRow | null;
  const language = profile?.language === "en" ? "en" : "da";

  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const locale = language === "en" ? "en-GB" : "da-DK";
  const date = event.event_date ? new Date(`${event.event_date}T12:00:00`) : null;
  const requirements = event.requirements ?? {};
  const style = typeof requirements.description === "string"
    ? requirements.description
    : Array.isArray(requirements.vibes) ? (requirements.vibes as string[]).join(", ") : "";

  // The site's own programme wins; Bryllupsdagen stands in when it is empty.
  const siteProgram = config.program.filter((p) => p.label.trim());
  const program = siteProgram.length
    ? siteProgram.map((p) => ({ time: p.time, title: p.label, place: p.sublabel }))
    : sortByTime((dayRows as DayProgramItemRow[] | null) ?? []).map((d) => ({ time: d.time.slice(0, 5), title: d.title, place: d.subtitle ?? "" }));

  const facts: DraftFacts = {
    names: b ? `${a} & ${b}` : a,
    dateLabel: date ? date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : event.date_hint ?? "",
    season: date ? SEASONS_DA[date.getMonth()] : "",
    venue: venue ? [venue.name, venue.address].filter(Boolean).join(", ") : "",
    region: event.location ?? "",
    guestCount: event.guest_count,
    style,
    program,
    rsvpDeadline: config.rsvpDeadline
      ? new Date(`${config.rsvpDeadline}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : "",
    transport: config.transport,
    dresscode: config.dresscode,
    hotels: config.hotels.filter((h) => h.name.trim()).map((h) => [h.name, h.dist, h.price].filter(Boolean).join(", ")),
    contact: hasContact(config.contact)
      ? [config.contact.name, config.contact.role, config.contact.phone || config.contact.email].filter(Boolean).join(", ")
      : "",
    hasRegistry: (registryCount ?? 0) > 0,
    giftsText: config.giftsText,
    language,
  };

  const { system, user: userText } = draftPrompt(field, facts, { story, faq });
  try {
    const res = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userText }] }],
      config: { systemInstruction: system, responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7 },
    });
    let raw: unknown = {};
    try { raw = JSON.parse(res.text ?? "{}"); } catch { /* read as empty below */ }
    const draft = readDraft(field, raw, faq.map((f) => f.id));
    if (!draft.text && !draft.faq?.length) {
      return Response.json(
        { error: field === "faq" ? "Juno fandt ikke noget, hun kan svare på ud fra det, I har fortalt." : "Juno kunne ikke skrive et udkast. Prøv igen." },
        { status: 422 },
      );
    }
    return Response.json(draft);
  } catch (err) {
    logAgentError("api/website/draft", err, { eventId, field });
    return Response.json({ error: "Juno kunne ikke skrive lige nu. Prøv igen." }, { status: 502 });
  }
}
