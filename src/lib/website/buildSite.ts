/* The site build pipeline (step 3 of content → imagery → build):
   gathers the couple's content, their photos, the chosen venue's photos and
   the per-section generated imagery, then has Gemini build the complete site
   HTML from scratch, seeded by the chosen template's tokens. Output passes
   the sanitize gate before storage; images live as alias tokens resolved at
   serve time. */

import type { Part } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGemini } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import { WEBSITE_HTML_PROMPT } from "@/lib/gemini/prompts";
import { generateSectionImage } from "@/lib/gemini/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig, siteContent, type SiteConfig } from "@/kalas/site/config";
import { parseSiteDesign, DEFAULT_DESIGN, type SiteDesign } from "@/kalas/site/design";
import { SITE_FONTS } from "@/kalas/site/fonts";
import { findPreset } from "@/kalas/site/presets";
import { sanitizeSiteHtml } from "./sanitize";
import { buildStamp, fillSlots } from "./slots";
import type {
  EventRow, ProfileRow, SitePhotoRow, VenueRow, WebsiteDesignRow, WeddingSiteRow,
} from "@/lib/db/types";

/** The HTML-building model — heavier than the chat/tool model on purpose. */
export const GEMINI_HTML_MODEL = process.env.GEMINI_HTML_MODEL ?? "gemini-3.5-flash";

const MAX_NEW_SECTION_IMAGES = 4; // per run, bounded Nano Banana spend
const MAX_INLINE_PARTS = 8;       // photos shown to the model multimodally

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/* ── Step 2: ensure per-section imagery exists ─────────────────────────── */

export interface EnsureImagesArgs {
  supabase: SupabaseClient;
  event: EventRow;
  userId: string;
  config: SiteConfig;
  paletteHexes: string[];
  styleDirection: string;
  vibes: string[];
  onStatus?: (s: string) => void;
}

/** Generate Nano Banana illustrations for toggled sections that don't have
    one yet (kind=generated, role=section, reused on later builds). */
export async function ensureSectionImages(args: EnsureImagesArgs): Promise<SitePhotoRow[]> {
  const { supabase, event, userId, config } = args;
  const enabled = new Set(config.sections.filter((s) => s.enabled).map((s) => s.id));
  const wanted = config.aiImages.filter((id) => enabled.has(id));
  if (wanted.length === 0) return [];

  const { data: existingRows } = await supabase
    .from("site_photos")
    .select("*")
    .eq("event_id", event.id)
    .eq("role", "section");
  const existing = (existingRows as SitePhotoRow[] | null) ?? [];
  const have = new Set(existing.map((p) => p.section));
  const missing = wanted.filter((id) => !have.has(id)).slice(0, MAX_NEW_SECTION_IMAGES);

  const admin = createAdminClient();
  const created: SitePhotoRow[] = [];
  for (const sectionId of missing) {
    args.onStatus?.(`Genererer billede til ${sectionId}…`);
    const art = await generateSectionImage({
      sectionId,
      styleDirection: args.styleDirection,
      vibes: args.vibes,
      paletteHexes: args.paletteHexes,
      region: event.location ?? "",
      aspectRatio: "16:9",
    });
    if (!art) continue;
    const id = crypto.randomUUID();
    const storagePath = `${userId}/${event.id}/${id}.png`;
    const { error: upErr } = await admin.storage
      .from("site-photos")
      .upload(storagePath, art.data, { contentType: art.mimeType, upsert: false });
    if (upErr) continue;
    const { data: row } = await admin
      .from("site_photos")
      .insert({
        id, event_id: event.id, user_id: userId, storage_path: storagePath,
        kind: "generated", role: "section", section: sectionId,
      })
      .select()
      .single();
    if (row) created.push(row as SitePhotoRow);
  }
  return [...existing, ...created];
}

/* ── Alias manifest ────────────────────────────────────────────────────── */

export interface ManifestEntry {
  alias: string;
  kind: string;
  note: string;
  /** 'photo:<uuid>' or 'venue:<index>' — persisted so serving stays stable. */
  source: string;
  storagePath?: string;
  venueUrl?: string;
}

export function buildManifest(photos: SitePhotoRow[], venue: VenueRow | null): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  let p = 0;
  for (const photo of photos) {
    if (photo.role === "section" && photo.section) {
      entries.push({
        alias: `S-${photo.section}`,
        kind: "generated section illustration",
        note: `made for the "${photo.section}" section, use it there`,
        source: `photo:${photo.id}`,
        storagePath: photo.storage_path,
      });
    } else {
      p += 1;
      entries.push({
        alias: `P${p}`,
        kind: photo.kind === "generated" ? "generated artwork" : "couple photo",
        note: photo.role === "hero" ? "their chosen favourite, strong hero candidate" : "couple's own photo",
        source: `photo:${photo.id}`,
        storagePath: photo.storage_path,
      });
    }
  }
  if (venue) {
    const urls = [venue.image_url, ...(venue.photo_urls ?? [])].filter((u): u is string => Boolean(u)).slice(0, 6);
    urls.forEach((url, i) => {
      entries.push({
        alias: `V${i + 1}`,
        kind: "venue photo",
        note: `real photo of ${venue.name}`,
        source: `venue:${i}`,
        venueUrl: url,
      });
    });
  }
  return entries;
}

/** Inline a subset of manifest images as multimodal parts (venue first, then
    hero/section/couple) so the model designs from what it can actually see. */
export async function inlineParts(entries: ManifestEntry[]): Promise<Part[]> {
  const admin = createAdminClient();
  const prioritized = [
    ...entries.filter((e) => e.venueUrl).slice(0, 3),
    ...entries.filter((e) => e.storagePath && e.alias.startsWith("S-")),
    ...entries.filter((e) => e.storagePath && !e.alias.startsWith("S-")),
  ].slice(0, MAX_INLINE_PARTS);

  const parts: Part[] = [];
  for (const e of prioritized) {
    try {
      if (e.storagePath) {
        const { data } = await admin.storage.from("site-photos").download(e.storagePath);
        if (!data) continue;
        const ext = e.storagePath.split(".").pop() ?? "jpg";
        parts.push({
          inlineData: { mimeType: MIME_BY_EXT[ext] ?? "image/jpeg", data: Buffer.from(await data.arrayBuffer()).toString("base64") },
        });
      } else if (e.venueUrl) {
        const res = await fetch(e.venueUrl);
        if (!res.ok) continue;
        const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
        if (!mime.startsWith("image/")) continue;
        parts.push({ inlineData: { mimeType: mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") } });
      }
    } catch {
      // best-effort — a missing inline photo never blocks the build
    }
  }
  return parts;
}

/* ── Step 3: build the site ────────────────────────────────────────────── */

export interface BuildArgs {
  supabase: SupabaseClient;
  event: EventRow;
  userId: string;
  styleDirection?: string;
  /** Refinement: change request against the active build. */
  instruction?: string;
  /** Bring the active build's texts up to date with the content, design untouched. */
  syncContent?: boolean;
  onStatus?: (s: string) => void;
}

export interface BuildResult {
  row: WebsiteDesignRow;
}

export async function buildSiteHtml(args: BuildArgs): Promise<BuildResult> {
  const { supabase, event, userId } = args;

  const [{ data: siteRow }, { data: photoRows }, { data: profileRow }, { data: activeRow }, { data: venueRow }, { count: registryCount }] = await Promise.all([
    supabase.from("wedding_sites").select("*").eq("event_id", event.id).maybeSingle(),
    supabase.from("site_photos").select("*").eq("event_id", event.id).order("sort").order("created_at"),
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("website_designs").select("*").eq("event_id", event.id).eq("active", true).maybeSingle(),
    event.chosen_venue_id
      ? supabase.from("venues").select("*").eq("id", event.chosen_venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("registry_items").select("id", { count: "exact", head: true }).eq("event_id", event.id),
  ]);

  const config = parseConfig((siteRow as WeddingSiteRow | null)?.config);
  const profile = profileRow as ProfileRow | null;
  const active = activeRow as WebsiteDesignRow | null;
  const venue = venueRow as VenueRow | null;
  const activeBrief = (active?.brief ?? {}) as { styleDirection?: string; vibes?: string[]; preset?: string };
  // A change request against a not-yet-built design (template only) becomes
  // part of the brief for the first build instead of a no-op refinement.
  const instruction = active?.html ? args.instruction : undefined;
  const syncContent = Boolean(args.syncContent && active?.html);
  const keepDesign = Boolean(instruction || syncContent);
  const styleDirection =
    args.styleDirection
    ?? (args.instruction && !active?.html
      ? [activeBrief.styleDirection, args.instruction].filter(Boolean).join(". ")
      : activeBrief.styleDirection)
    ?? "";
  const vibes = activeBrief.vibes ?? (Array.isArray(event.requirements?.vibes) ? (event.requirements.vibes as string[]) : []);

  // Template tokens = style seed. Chosen preset if known, else the active
  // design's tokens, else the default editorial look.
  const preset = findPreset(activeBrief.preset ?? "");
  const baseDesign: SiteDesign = preset?.design ?? (active ? parseSiteDesign(active.design) : DEFAULT_DESIGN);

  // Step 2 (idempotent): section imagery for toggled sections.
  args.onStatus?.("Genererer billeder til sektionerne…");
  const sectionPhotos = await ensureSectionImages({
    supabase, event, userId, config,
    paletteHexes: [baseDesign.palette.bg, baseDesign.palette.accent, baseDesign.palette.text],
    styleDirection, vibes, onStatus: args.onStatus,
  });

  const allPhotos = ((photoRows as SitePhotoRow[] | null) ?? []).filter((p) => p.role !== "section");
  const manifest = buildManifest([...allPhotos, ...sectionPhotos], venue);
  const parts = await inlineParts(manifest);

  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const names = b ? `${a} & ${b}` : a;
  const dateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })
    : event.date_hint ?? "";
  const daysUntil = event.event_date
    ? Math.ceil((new Date(`${event.event_date}T00:00:00`).getTime() - Date.now()) / 86400000)
    : null;

  const content = JSON.stringify(siteContent(config), null, 1);

  const prompt = WEBSITE_HTML_PROMPT({
    names, dateLabel, daysUntil,
    region: event.location ?? "",
    venueName: venue?.name ?? null,
    venueAddress: venue?.address ?? null,
    guestCount: event.guest_count,
    language: profile?.language ?? "da",
    styleDirection, vibes,
    templateName: preset ? `${preset.label}, ${baseDesign.concept.name}` : baseDesign.concept.name,
    templateSpec: JSON.stringify({ palette: baseDesign.palette, typography: baseDesign.typography, shape: baseDesign.shape, hero: baseDesign.hero, decor: baseDesign.decor }, null, 1),
    content,
    imageManifest: manifest.map(({ alias, kind, note }) => ({ alias, kind, note })),
    fontCatalog: SITE_FONTS.map((f) => ({ family: f.family, category: f.category })),
    hasRegistry: (registryCount ?? 0) > 0,
    // With today's words in its slots, so Juno works from what guests see.
    currentHtml: keepDesign && active?.html ? fillSlots(active.html, config) : undefined,
    instruction,
    syncContent,
  });

  args.onStatus?.("Juno bygger jeres side…");
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_HTML_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
  });
  const raw = response.text ?? "";
  const html = sanitizeSiteHtml(raw);
  if (!html) {
    logAgentError("website/buildSite:sanitize-reject", new Error("output too small after sanitize"), {
      eventId: event.id, rawLength: raw.length,
    });
    throw new Error("Site build failed validation");
  }

  // Persist alias → source so serving can mint fresh URLs forever.
  const imageAliases: Record<string, string> = {};
  for (const e of manifest) imageAliases[e.alias] = e.source;

  const designMeta = {
    ...(baseDesign as unknown as Record<string, unknown>),
    concept: {
      name: keepDesign ? baseDesign.concept.name : preset ? `${preset.design.concept.name} · Juno` : baseDesign.concept.name,
      rationale: baseDesign.concept.rationale,
    },
  };

  await supabase.from("website_designs").update({ active: false }).eq("event_id", event.id).eq("active", true);
  const { data: row, error } = await supabase
    .from("website_designs")
    .insert({
      event_id: event.id,
      user_id: userId,
      brief: {
        styleDirection, vibes,
        instruction: instruction ?? null,
        contentSync: syncContent || undefined,
        preset: activeBrief.preset ?? null,
        mode: "html",
        imageAliases,
        // What this HTML was built from, and that its texts sit in slots;
        // the builder compares it with the content as it stands to tell
        // whether the site needs Juno to catch up (see slots.ts).
        ...buildStamp(config),
      },
      design: designMeta,
      html,
      active: true,
    })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to save site");
  return { row: row as WebsiteDesignRow };
}

/* ── Serve-time URL map for a stored build ─────────────────────────────── */

/** alias → URL map for a design row: signed storage URLs for photo sources,
    venue photo URLs for venue sources. Admin client, server only. */
export async function urlMapForDesign(
  design: Pick<WebsiteDesignRow, "brief">,
  photos: SitePhotoRow[],
  venue: VenueRow | null
): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const aliases = ((design.brief as { imageAliases?: Record<string, string> })?.imageAliases) ?? {};
  const byId = new Map(photos.map((p) => [p.id, p]));
  const venueUrls = venue
    ? [venue.image_url, ...(venue.photo_urls ?? [])].filter((u): u is string => Boolean(u))
    : [];

  const map: Record<string, string> = {};
  await Promise.all(
    Object.entries(aliases).map(async ([alias, source]) => {
      if (source.startsWith("photo:")) {
        const photo = byId.get(source.slice(6));
        if (!photo) return;
        const { data } = await admin.storage.from("site-photos").createSignedUrl(photo.storage_path, 3600);
        if (data?.signedUrl) map[alias] = data.signedUrl;
      } else if (source.startsWith("venue:")) {
        const url = venueUrls[Number(source.slice(6))];
        if (url) map[alias] = url;
      }
    })
  );
  return map;
}
