/* AI website-design generation core — shared by the /api/website/design*
   routes and Ava's update_website_design tool. Feeds the couple's facts,
   content, style brief and up to six of their photos (inline, multimodal)
   to Gemini with a structured-output schema; the result passes through
   parseSiteDesign (the validation boundary) before it is stored. */

import { Type, type Schema, type Part } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import { WEBSITE_DESIGN_PROMPT } from "@/lib/gemini/prompts";
import { generateSiteHeroImage } from "@/lib/gemini/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig, HUB_SECTIONS } from "@/kalas/site/config";
import {
  parseSiteDesign,
  HERO_VARIANTS, SECTION_BGS, SECTION_VARIANTS, RADII, DENSITIES, BORDERS,
  WIDTHS, TYPE_SCALES, TRACKING, DECOR_STYLES, DISPLAY_WEIGHTS,
  type SiteDesign,
} from "@/kalas/site/design";
import { SITE_FONTS, FONT_IDS } from "@/kalas/site/fonts";
import type { EventRow, ProfileRow, SitePhotoRow, WebsiteDesignRow, WeddingSiteRow } from "@/lib/db/types";

const MAX_INLINE_PHOTOS = 6;

/* ── Structured-output schema (mirrors SiteDesign; enums lock the tokens) ── */

const str = (description?: string): Schema => ({ type: Type.STRING, description });
const en = (values: readonly (string | number)[], description?: string): Schema => ({
  type: Type.STRING,
  enum: values.map(String),
  description,
});

const ALL_VARIANTS = [...new Set(Object.values(SECTION_VARIANTS).flat())];

export const siteDesignSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    concept: {
      type: Type.OBJECT,
      properties: { name: str("Short evocative concept name"), rationale: str("1-2 sentences to the couple") },
      required: ["name", "rationale"],
    },
    palette: {
      type: Type.OBJECT,
      properties: {
        bg: str("page background, 6-digit hex"),
        surface: str("raised/alternate band, hex"),
        text: str("primary text on bg, hex, AA contrast"),
        muted: str("secondary text, hex"),
        accent: str("buttons/highlights, hex"),
        onAccent: str("text on accent, hex, AA contrast"),
        heroOverlay: { type: Type.NUMBER, description: "0-0.9 dark overlay over hero imagery" },
      },
      required: ["bg", "surface", "text", "muted", "accent", "onAccent", "heroOverlay"],
    },
    typography: {
      type: Type.OBJECT,
      properties: {
        displayFont: en(FONT_IDS, "font id for headings"),
        bodyFont: en(FONT_IDS, "font id for body, never a script font"),
        displayWeight: en(DISPLAY_WEIGHTS),
        displayItalic: { type: Type.BOOLEAN },
        uppercaseEyebrows: { type: Type.BOOLEAN },
        scale: en(TYPE_SCALES),
        tracking: en(TRACKING),
      },
      required: ["displayFont", "bodyFont", "displayWeight", "displayItalic", "uppercaseEyebrows", "scale", "tracking"],
    },
    shape: {
      type: Type.OBJECT,
      properties: {
        radius: en(RADII), density: en(DENSITIES), borders: en(BORDERS), maxWidth: en(WIDTHS),
      },
      required: ["radius", "density", "borders", "maxWidth"],
    },
    hero: {
      type: Type.OBJECT,
      properties: { variant: en(HERO_VARIANTS), showCountdown: { type: Type.BOOLEAN } },
      required: ["variant", "showCountdown"],
    },
    sections: {
      type: Type.ARRAY,
      description: "Enabled sections in render order",
      items: {
        type: Type.OBJECT,
        properties: {
          id: en(Object.keys(SECTION_VARIANTS)),
          variant: en(ALL_VARIANTS, "must be valid for the section id"),
          bg: en(SECTION_BGS),
          heading: str("optional custom heading"),
          intro: str("optional 1-sentence section intro"),
        },
        required: ["id", "variant", "bg"],
      },
    },
    copy: {
      type: Type.OBJECT,
      properties: {
        tagline: str("hero tagline"),
        storyIntro: str("used if the couple wrote no story; else empty"),
        rsvpCta: str("RSVP button label"),
        footerLine: str("warm one-line footer"),
      },
      required: ["tagline", "storyIntro", "rsvpCta", "footerLine"],
    },
    images: {
      type: Type.OBJECT,
      properties: {
        heroPhotoId: str('photo alias like "P1", or "" for generated artwork'),
        galleryPhotoIds: { type: Type.ARRAY, items: str("photo alias") },
      },
      required: ["heroPhotoId", "galleryPhotoIds"],
    },
    decor: {
      type: Type.OBJECT,
      properties: { style: en(DECOR_STYLES), dividers: { type: Type.BOOLEAN } },
      required: ["style", "dividers"],
    },
  },
  required: ["concept", "palette", "typography", "shape", "hero", "sections", "copy", "images", "decor"],
};

/* ── Paywall ───────────────────────────────────────────────────────────── */

/** True when the event may use the AI designer: a paid order exists, or
    Stripe isn't configured (dev/preview environments run unlocked). */
export async function hasWebsiteAccess(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY) return true;
  const { count } = await supabase
    .from("website_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "paid");
  return (count ?? 0) > 0;
}

/* ── Generation ────────────────────────────────────────────────────────── */

export interface GenerateArgs {
  supabase: SupabaseClient; // RLS-scoped (the couple's client)
  event: EventRow;
  userId: string;
  /** Fresh brief for a full generation. */
  styleDirection?: string;
  vibes?: string[];
  /** Refinement: change request against the current active design. */
  instruction?: string;
  /** Ignore the active design/template and design from scratch. */
  fresh?: boolean;
}

export interface GenerateResult {
  row: WebsiteDesignRow;
  design: SiteDesign;
}

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function inlinePhotoParts(photos: SitePhotoRow[]): Promise<{ parts: Part[]; aliases: Map<string, string> }> {
  const admin = createAdminClient();
  const parts: Part[] = [];
  const aliases = new Map<string, string>(); // alias → photo uuid
  // Hero-role photos first so the strongest candidates are always inlined.
  const ordered = [...photos].sort((a, b) => (a.role === "hero" ? -1 : 0) - (b.role === "hero" ? -1 : 0));
  for (const p of ordered.slice(0, MAX_INLINE_PHOTOS)) {
    const alias = `P${aliases.size + 1}`;
    const ext = p.storage_path.split(".").pop() ?? "jpg";
    const { data } = await admin.storage.from("site-photos").download(p.storage_path);
    if (!data) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    parts.push({ inlineData: { mimeType: MIME_BY_EXT[ext] ?? "image/jpeg", data: buf.toString("base64") } });
    aliases.set(alias, p.id);
  }
  return { parts, aliases };
}

/** Swap model-facing photo aliases (P1…) for real site_photos uuids. */
function resolveAliases(design: SiteDesign, aliases: Map<string, string>): SiteDesign {
  const resolve = (ref: string): string => aliases.get(ref.toUpperCase()) ?? aliases.get(ref) ?? "";
  const hero = design.images.heroPhotoId ? resolve(design.images.heroPhotoId) : "";
  const gallery = design.images.galleryPhotoIds.map(resolve).filter(Boolean);
  return { ...design, images: { heroPhotoId: hero, galleryPhotoIds: gallery } };
}

/**
 * Generate (or refine) the couple's website design and persist it as the new
 * active website_designs row. Throws on model failure; hero-artwork
 * generation is best-effort and never blocks.
 */
export async function generateSiteDesign(args: GenerateArgs): Promise<GenerateResult> {
  const { supabase, event, userId } = args;

  const [{ data: siteRow }, { data: photoRows }, { data: profileRow }, { data: activeRow }, { data: venueRow }] = await Promise.all([
    supabase.from("wedding_sites").select("*").eq("event_id", event.id).maybeSingle(),
    supabase.from("site_photos").select("*").eq("event_id", event.id).order("sort").order("created_at"),
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("website_designs").select("*").eq("event_id", event.id).eq("active", true).maybeSingle(),
    event.chosen_venue_id
      ? supabase.from("venues").select("name").eq("id", event.chosen_venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const config = parseConfig((siteRow as WeddingSiteRow | null)?.config);
  const photos = (photoRows as SitePhotoRow[] | null) ?? [];
  const profile = profileRow as ProfileRow | null;
  const active = activeRow as WebsiteDesignRow | null;
  const activeDesign = active ? parseSiteDesign(active.design) : null;

  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const names = b ? `${a} & ${b}` : a;
  const dateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })
    : event.date_hint ?? "";
  const priorBrief = (active?.brief ?? {}) as { styleDirection?: string; vibes?: string[]; preset?: string };
  const styleDirection = args.styleDirection ?? priorBrief.styleDirection ?? "";
  const vibes = args.vibes ?? priorBrief.vibes ?? (Array.isArray(event.requirements?.vibes) ? (event.requirements.vibes as string[]) : []);

  const { parts: photoParts, aliases } = await inlinePhotoParts(photos);
  const aliasMeta = [...aliases.keys()].map((alias) => {
    const p = photos.find((x) => x.id === aliases.get(alias));
    return { alias, role: p?.role ?? "gallery", kind: p?.kind ?? "upload" };
  });

  const prompt = WEBSITE_DESIGN_PROMPT({
    names,
    dateLabel,
    region: event.location ?? "",
    venueName: (venueRow as { name: string } | null)?.name ?? null,
    guestCount: event.guest_count,
    vibes,
    styleDirection,
    storyText: config.storyText,
    enabledSections: config.sections.filter((s) => s.enabled && s.id !== "hero" && s.id !== "photos" && !HUB_SECTIONS.includes(s.id)).map((s) => s.id),
    photoAliases: aliasMeta,
    fontCatalog: SITE_FONTS.map((f) => ({ id: f.id, family: f.family, category: f.category })),
    language: profile?.language ?? "da",
    // Refinement and personalize modes both build FROM the active design
    // (usually a chosen template); `fresh` designs from scratch.
    currentDesign: activeDesign && !args.fresh ? JSON.stringify(activeDesign) : undefined,
    instruction: args.instruction,
  });

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }, ...photoParts] }],
    config: { responseMimeType: "application/json", responseSchema: siteDesignSchema },
  });

  let raw: unknown;
  try {
    raw = JSON.parse(response.text ?? "{}");
  } catch (err) {
    logAgentError("website/generate:parse", err, { eventId: event.id });
    throw new Error("Design generation returned invalid JSON");
  }
  let design = resolveAliases(parseSiteDesign(raw), aliases);

  // No usable hero photo → best-effort decorative artwork (never blocks).
  if (!design.images.heroPhotoId) {
    try {
      const art = await generateSiteHeroImage({
        styleDirection,
        vibes,
        region: event.location ?? "",
        paletteHexes: [design.palette.bg, design.palette.accent, design.palette.text],
      });
      if (art) {
        const admin = createAdminClient();
        const id = crypto.randomUUID();
        const storagePath = `${userId}/${event.id}/${id}.png`;
        const { error: upErr } = await admin.storage
          .from("site-photos")
          .upload(storagePath, art.data, { contentType: art.mimeType, upsert: false });
        if (!upErr) {
          const { data: photoRow } = await admin
            .from("site_photos")
            .insert({ id, event_id: event.id, user_id: userId, storage_path: storagePath, kind: "generated", role: "hero" })
            .select()
            .single();
          if (photoRow) design = { ...design, images: { ...design.images, heroPhotoId: id } };
        }
      }
    } catch (err) {
      logAgentError("website/generate:heroArtwork", err, { eventId: event.id });
    }
  }

  // Persist: deactivate siblings, then insert the new active version.
  await supabase.from("website_designs").update({ active: false }).eq("event_id", event.id).eq("active", true);
  const { data: row, error } = await supabase
    .from("website_designs")
    .insert({
      event_id: event.id,
      user_id: userId,
      brief: {
        styleDirection,
        vibes,
        instruction: args.instruction ?? null,
        // The template lineage survives refinements so the builder can show it.
        preset: args.fresh ? null : priorBrief.preset ?? null,
      },
      design: design as unknown as Record<string, unknown>,
      active: true,
    })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to save design");

  return { row: row as WebsiteDesignRow, design };
}
