/* Building the card: Juno designs it (typefaces, sizes, spacing, palette,
   where the words sit, the few lines of wording), the image model paints its
   artwork, and the result is saved as the active version. A change request
   runs the same way against the current design; Juno says whether it needs a
   new painting or only new type. Runs as a background job in production
   (src/lib/jobs/run.ts). */

import { Type, type Schema } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGemini } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import { GEMINI_HTML_MODEL } from "@/lib/website/buildSite";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_FONTS, CARD_FONT_IDS } from "@/kalas/invitations/card/fonts";
import { findFormat, type CardFormatId } from "@/kalas/invitations/card/formats";
import { BLOCK_ROLES, parseCardSpec, type CardSpec } from "@/kalas/invitations/card/spec";
import { findVibe, sampleArt, starterSpec, textAreaFor, type ArtPlacement, type CardVibe } from "@/kalas/invitations/card/vibes";
import { coupleNames, dateLine, parseInviteContent, rsvpLine, type InviteContent } from "@/kalas/invitations/content";
import { cardArtPrompt, paintCardArt } from "./art";
import type { EventRow, InvitationDesignRow, InvitationRow, ProfileRow, VenueRow } from "@/lib/db/types";

export const ART_BUCKET = "invite-designs";

const PLACEMENTS: ArtPlacement[] = ["corners", "frame", "top", "bottom", "scattered", "texture"];

/* ── What Juno returns ─────────────────────────────────────────────────── */

const n = (description: string): Schema => ({ type: Type.NUMBER, description });
const style = (extra: Record<string, Schema> = {}): Schema => ({
  type: Type.OBJECT,
  properties: {
    font: { type: Type.STRING, enum: CARD_FONT_IDS },
    size: n("units; the card is 1000 wide"),
    weight: n("300-700"),
    italic: { type: Type.BOOLEAN },
    caps: { type: Type.BOOLEAN },
    lower: { type: Type.BOOLEAN, description: "all lowercase, like a hand-lettered card" },
    tracking: n("letter spacing in em, e.g. 0.14 for spaced small caps"),
    color: { type: Type.STRING, enum: ["ink", "accent"] },
    lineHeight: n("e.g. 1.1 for names, 1.45 for small lines"),
    ...extra,
  },
  required: ["font", "size", "weight", "italic", "caps", "tracking", "color", "lineHeight"],
});

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    conceptName: { type: Type.STRING, description: "a short evocative name for this card" },
    palette: {
      type: Type.OBJECT,
      properties: { ink: { type: Type.STRING }, accent: { type: Type.STRING }, paper: { type: Type.STRING } },
      required: ["ink", "accent", "paper"],
    },
    placement: { type: Type.STRING, enum: PLACEMENTS },
    artBrief: { type: Type.STRING, description: "what to paint, in English, for the image model" },
    repaint: { type: Type.BOOLEAN, description: "true when the painting itself must change" },
    align: { type: Type.STRING, enum: ["center", "left"] },
    textArea: {
      type: Type.OBJECT,
      properties: { top: n("fraction"), bottom: n("fraction"), left: n("fraction"), right: n("fraction") },
      required: ["top", "bottom", "left", "right"],
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        ...style({
          role: { type: Type.STRING, enum: [...BLOCK_ROLES] },
          text: { type: Type.STRING, description: "wording for eyebrow, invite and closing; for a divider one of: '' (a hairline), '♥ ♥', '✦', '· · ·', '❦'; empty otherwise" },
          gap: n("space above the block, units"),
          stack: { type: Type.BOOLEAN, description: "names only: one name per line" },
          joiner: { type: Type.STRING, enum: ["amp", "plus", "word"], description: "names only: &, +, or og/and" },
          joinerStyle: style(),
          dateStyle: { type: Type.STRING, enum: ["long", "short", "numeric"], description: "date only" },
          sub: style(),
        }),
        required: ["role", "text", "gap", "font", "size", "weight", "italic", "caps", "tracking", "color", "lineHeight"],
      },
    },
  },
  required: ["conceptName", "palette", "placement", "artBrief", "repaint", "textArea", "blocks"],
};

/** A photo block is the couple's to add, so Juno keeps one if the design has
    it (in its place in her order) and never adds one. */
function keepPhoto(raw: Record<string, unknown>, current: CardSpec): Record<string, unknown> {
  const photo = current.blocks.find((b) => b.role === "photo");
  const blocks = Array.isArray(raw.blocks) ? (raw.blocks as Record<string, unknown>[]).filter((b) => b.role !== "photo") : null;
  if (!photo || !blocks) return { ...raw, blocks };
  const at = current.blocks.indexOf(photo);
  return { ...raw, blocks: [...blocks.slice(0, at), photo, ...blocks.slice(at)] };
}

function designPrompt(args: {
  vibeLabel: string;
  vibeArt: string;
  current: CardSpec;
  content: InviteContent;
  styleDirection: string;
  instruction?: string;
}): string {
  const c = args.content;
  const lang = c.language === "en" ? "English" : "Danish";
  const facts = {
    names: coupleNames(c), date: dateLine(c), time: c.time, venue: c.venue, venueDetail: c.venueDetail,
    note: c.note, rsvp: rsvpLine(c),
  };
  const fonts = CARD_FONTS.map((f) => `${f.id} (${f.family}, ${f.category}${f.weights.length > 1 ? `, weights ${f.weights.join("/")}` : ""})`).join("; ");
  const task = args.instruction
    ? `The couple asked for this change to their card:\n"""${args.instruction}"""\nChange what it asks and keep the rest. Set "repaint" true only if the painting itself has to change (other flowers, colours, composition); a change to words, type or spacing keeps the painting.`
    : `Design their card, starting from the vibe. Their own words about how it should feel: ${args.styleDirection || "none, take it from the vibe"}. Set "repaint" true.`;

  return `You are Juno, a wedding stationery designer. You design the typography of a printed invitation card; an illustrator paints its artwork from your brief, and the words are typeset over the painting.

Vibe: ${args.vibeLabel}, painted as: ${args.vibeArt}.

The facts the card states (set by our code in the blocks you style; never write them yourself): ${JSON.stringify(facts)}.

The current design, JSON (units: the card is 1000 wide and ${Math.round((1000 * findFormat(args.current.format).heightIn) / findFormat(args.current.format).widthIn)} tall):
${JSON.stringify({ conceptName: args.current.conceptName, palette: args.current.palette, textArea: args.current.textArea, align: args.current.align ?? "center", blocks: args.current.blocks })}

${task}

How blocks work:
- Roles, top to bottom in the order you list them: eyebrow (a small opening line), names, invite (one or two lines of invitation), dateRow (weekday | month, big day number, year | time, with hairlines; "sub" styles its small parts), date (a date line with the time under it, instead of dateRow; dateStyle long = with weekday, short = "12. juni 2027", numeric = "12.06.27"), venue (the place, then its address), note, divider (a small ornament between groups), closing (a sign-off), rsvp (the reply-by line). Leave out roles the card should not have; names are required. A photo block, if the design has one, is the couple's photo: our code keeps it where it is.
- "sub" on date and venue styles their second line (the time, the address) differently from the first, as fine stationery often does. On names, "joiner" picks &, + or the word og/and, and with stack "joinerStyle" can set it apart (a script "og" between names in spaced capitals).
- "lower" sets a block all in lowercase, for a relaxed hand-lettered feel; "caps" all in capitals. align "left" sets every block flush left, for asymmetric designs whose artwork sits to one side.
- "text" is the wording for eyebrow, invite and closing only, in ${lang}, warm and correct stationery phrasing, use "\\n" for a deliberate line break. Never state facts beyond those given: the closing is a warm sign-off (e.g. that they look forward to seeing the guests), and must not promise a dinner, party, reception or anything else the facts do not mention.
- If there is a time, keep a dateRow or date block: both show it.
- Fonts only from: ${fonts}.
- Hierarchy like fine stationery: the names largest (usually a script, 90-130 units), small lines in spaced small caps (22-30 units, tracking 0.12-0.2), generous gaps (20-60 units) with more air around the names and the date. A long name must still read well: prefer stacking names (stack) over tiny type.
- palette: ink for the words, accent for small touches, paper for the background; hex colours with good contrast against the painting and paper.
- textArea: fractions of the card kept free of artwork for the words; at least a third of each dimension.
- placement and artBrief: where the painting sits and what it shows (motifs, colours, mood), consistent with the textArea.`;
}

/* ── Juno's design ─────────────────────────────────────────────────────── */

export interface CardDesign {
  spec: CardSpec;
  placement: ArtPlacement;
  /** What to paint, for the image model. */
  artBrief: string;
  /** Whether the painting has to change (a change request may keep it). */
  repaint: boolean;
}

/** A design is a few kilobytes; a reply far longer than that is the model
    repeating itself, and is cut off rather than waited for. */
const MAX_DESIGN_TOKENS = 8192;
const DESIGN_ATTEMPTS = 2;

/** Juno's reply as JSON, or null when it is not JSON after a retry. */
async function askForDesign(prompt: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 1; attempt <= DESIGN_ATTEMPTS; attempt++) {
    let text = "";
    try {
      const response = await getGemini().models.generateContent({
        model: GEMINI_HTML_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7, maxOutputTokens: MAX_DESIGN_TOKENS },
      });
      text = response.text ?? "";
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch (err) {
      logAgentError("invitations/design", err, { attempt, length: text.length, tail: text.slice(-300) });
    }
  }
  return null;
}

/** Juno's typesetting and painting brief for a card, validated over `current`.
    No storage, so a script can try it without a wedding. */
export async function designCard(args: {
  vibe: CardVibe;
  current: CardSpec;
  content: InviteContent;
  styleDirection: string;
  instruction?: string;
}): Promise<CardDesign> {
  const { vibe, current } = args;
  const parsed = await askForDesign(designPrompt({ vibeLabel: vibe.label, vibeArt: vibe.art, ...args }));
  // No usable design after a retry: keep the vibe's own typesetting, so the
  // couple still gets their painting rather than an error.
  if (!parsed) return { spec: current, placement: vibe.placement, artBrief: "", repaint: !args.instruction };
  const raw = keepPhoto(parsed, current);
  return {
    spec: parseCardSpec({ ...raw, vibe: vibe.id, format: current.format, art: current.art }, current),
    // A drawn or playful vibe is its composition (the poppy up the side, the
    // doodles down the left); only the painted ones let Juno move the painting.
    placement: vibe.group === "painted" ? PLACEMENTS.find((p) => p === raw.placement) ?? vibe.placement : vibe.placement,
    artBrief: typeof raw.artBrief === "string" ? raw.artBrief.slice(0, 600) : "",
    repaint: raw.repaint === true,
  };
}

/* ── The build ────────────────────────────────────────────────────────── */

export interface BuildCardArgs {
  supabase: SupabaseClient;
  event: EventRow;
  userId: string;
  styleDirection?: string;
  instruction?: string;
  /** A new paper size; the card is repainted for it. */
  format?: CardFormatId;
}

function contentFallback(event: EventRow, profile: ProfileRow | null, venue: VenueRow | null): Partial<InviteContent> {
  const first = (s: string | null | undefined) => (s ?? "").split(/\s+/)[0] ?? "";
  return {
    partnerA: first(profile?.display_name) || first(event.title),
    partnerB: first(profile?.partner_name),
    date: event.event_date ?? "",
    venue: venue?.name ?? "",
    language: profile?.language === "en" ? "en" : "da",
  };
}

export async function buildCard(args: BuildCardArgs): Promise<InvitationDesignRow> {
  const { supabase, event, userId } = args;
  const [{ data: invRow }, { data: profileRow }, { data: activeRow }, { data: venueRow }] = await Promise.all([
    supabase.from("invitations").select("*").eq("event_id", event.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("invitation_designs").select("*").eq("event_id", event.id).eq("active", true).maybeSingle(),
    event.chosen_venue_id
      ? supabase.from("venues").select("*").eq("id", event.chosen_venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const active = activeRow as InvitationDesignRow | null;
  const content = parseInviteContent((invRow as InvitationRow | null)?.data, contentFallback(event, profileRow as ProfileRow | null, venueRow as VenueRow | null));
  const brief = (active?.brief ?? {}) as { styleDirection?: string };

  const activeVibe = (active?.design as { vibe?: string } | undefined)?.vibe;
  const vibe = findVibe(activeVibe);
  const activeFormat = findFormat((active?.design as { format?: string } | undefined)?.format);
  const format = findFormat(args.format ?? activeFormat.id);
  const starter = starterSpec(vibe, format, content.language);
  let current = active ? parseCardSpec(active.design, starter) : starter;
  const newFormat = format.id !== current.format;
  if (newFormat) {
    current = { ...current, format: format.id, textArea: textAreaFor(vibe, format), art: { path: null, sample: sampleArt(vibe.id, format.id) } };
  }
  // A change asked of a card Juno never built is a first build with it in the brief.
  const instruction = current.art.path && !newFormat ? args.instruction : undefined;
  const styleDirection = args.styleDirection
    ?? [brief.styleDirection, instruction ? undefined : args.instruction].filter(Boolean).join(". ");

  const design = await designCard({ vibe, current, content, styleDirection, instruction });
  let spec = design.spec;

  // Paint when Juno asks to, and always for a first build or a new size;
  // never on bare paper, which keeps the paper the vibe ships.
  const repaint = !vibe.paper && (!current.art.path || newFormat || design.repaint);
  if (repaint) {
    const art = await paintCardArt(cardArtPrompt({ vibe, format, spec, placement: design.placement, brief: design.artBrief }), format);
    if (!art) throw new Error("The card's artwork could not be painted");
    const ext = art.mimeType.includes("jpeg") ? "jpg" : art.mimeType.includes("webp") ? "webp" : "png";
    const path = `${userId}/${event.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createAdminClient().storage.from(ART_BUCKET).upload(path, art.data, { contentType: art.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    spec = { ...spec, art: { ...spec.art, path } };
  }

  await supabase.from("invitation_designs").update({ active: false }).eq("event_id", event.id).eq("active", true);
  const { data: row, error } = await supabase
    .from("invitation_designs")
    .insert({
      event_id: event.id,
      user_id: userId,
      brief: { styleDirection, instruction: instruction ?? null, vibe: vibe.id, format: format.id, mode: "card", repainted: repaint },
      design: spec as unknown as Record<string, unknown>,
      html: null,
      active: true,
    })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to save the card");
  return row as InvitationDesignRow;
}
