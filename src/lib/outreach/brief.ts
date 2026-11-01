// The master brief behind every outreach email: what the couple is asking a
// vendor. The bulk flow persists it as an email_drafts row the couple
// approves; single-vendor outreach reuses that row when it exists so both
// paths sound like the same planner, and generates a throwaway brief when it
// doesn't. Per-recipient wording and language happen later, in
// composeOutreachEmail.

import { Type, type Schema } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import type { EmailDraftRow, EventRow, VendorCategory } from "@/lib/db/types";

export interface OutreachBrief {
  subject: string;
  body_template: string;
  /** The draft row this came from, when it came from one. */
  draftId: string | null;
}

const briefSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body_template: { type: Type.STRING },
  },
  required: ["subject", "body_template"],
};

const CATEGORY_DA: Record<VendorCategory, string> = {
  venue: "bryllupsvenue",
  florist: "blomsterbinder",
  photographer: "bryllupsfotograf",
  musician: "musiker/DJ",
  caterer: "cateringleverandør",
  planner: "bryllupsplanlægger",
  accommodation: "overnatningssted",
  other: "leverandør",
};

export function dateLabel(event: EventRow): string {
  if (event.event_date) return event.event_date;
  if (event.date_hint) return event.date_hint;
  return "endnu ikke fastlagt";
}

/** The deterministic brief, used whenever Gemini is unavailable. */
export function fallbackBrief(event: EventRow, category: VendorCategory): OutreachBrief {
  const guests = event.guest_count ?? undefined;
  const noun = CATEGORY_DA[category] ?? CATEGORY_DA.other;
  return {
    subject: `Forespørgsel: bryllup ${guests ? `for ${guests} gæster ` : ""}${dateLabel(event)}`,
    body_template: `Kære {{venue_name}}

Vi er ved at planlægge vores bryllup${guests ? ` for ca. ${guests} gæster` : ""} og leder efter en ${noun}.

Dato: ${dateLabel(event)}${event.location ? `\nOmråde: ${event.location}` : ""}

Har I ledigt på datoen, og kan I fortælle lidt om jeres muligheder, pakker og priser? Vi vil også meget gerne høre om næste skridt.

Mange tak på forhånd.

Kærlig hilsen
Juno, på vegne af parret`,
    draftId: null,
  };
}

/**
 * Generate a fresh master brief with Gemini, falling back to the
 * deterministic template so callers always get something sendable.
 */
export async function generateBrief(
  event: EventRow,
  category: VendorCategory
): Promise<OutreachBrief> {
  const guests = event.guest_count ?? undefined;
  const noun = CATEGORY_DA[category] ?? CATEGORY_DA.other;
  const prompt = `
You are Juno, a warm, professional wedding planning assistant writing on behalf of a couple.
Write ONE reusable outreach email (Danish) to a ${noun} asking about availability and pricing.

Couple / event context:
- Wedding: ${event.title}
- Location interest: ${event.location ?? "fleksibelt"}
- Date: ${dateLabel(event)}
- Guests: ${guests ? `ca. ${guests}` : "ikke fastlagt endnu"}
- Budget: ${event.budget ?? "ikke oplyst"}

Requirements:
- The body MUST address the recipient with the literal placeholder {{venue_name}} (it is substituted per recipient).
- Warm but concise; introduce the couple briefly, state date + guest count, and ask about availability, what they offer, pricing, and next steps.
- Sign off as "Juno, på vegne af parret" (do not invent names/emails).
- subject: a short, clear subject line (may reference the date/guest count).
- body_template: the full email body in Danish, plain text, including the {{venue_name}} placeholder near the greeting.
`.trim();

  try {
    const ai = getGemini();
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: briefSchema },
    });
    const parsed = JSON.parse(res.text ?? "{}") as {
      subject?: string;
      body_template?: string;
    };
    const subject = (parsed.subject ?? "").trim();
    const body = (parsed.body_template ?? "").trim();
    // A brief without the placeholder can't be personalized — treat as a miss.
    if (subject && body.includes("{{venue_name}}")) {
      return { subject, body_template: body, draftId: null };
    }
  } catch (err) {
    logAgentError("outreach/brief:generate", err, { category });
  }
  return fallbackBrief(event, category);
}

/**
 * The brief to use for one vendor: the couple's most recent draft for that
 * category if they have one, otherwise a freshly generated brief that is
 * deliberately NOT persisted — an unapproved draft row would show up in the
 * bulk review screen as if it were waiting for them.
 */
export async function resolveBriefForVendor(
  supabase: SupabaseClient,
  event: EventRow,
  category: VendorCategory
): Promise<OutreachBrief> {
  const { data } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("event_id", event.id)
    .eq("category", category)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const draft = data as EmailDraftRow | null;
  if (draft?.body_template) {
    return {
      subject: draft.subject,
      body_template: draft.body_template,
      draftId: draft.id,
    };
  }
  return generateBrief(event, category);
}
