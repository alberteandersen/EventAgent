import type { SupabaseClient } from "@supabase/supabase-js";
import { Type, type FunctionDeclaration } from "@google/genai";
import { INIT_SECTIONS, parseConfig } from "@/kalas/site/config";
import { CONTENT_STEPS, sectionStatus } from "@/kalas/site/outline";
import { describeVersions } from "@/kalas/site/versions";
import { applyContentEdit, type ContentEdit } from "@/lib/website/contentEdit";
import { needsRebuild } from "@/lib/website/slots";
import type { EventRow, WebsiteDesignRow, WeddingSiteRow } from "@/lib/db/types";

/*
 * Ava's hands on the wedding website from the chat: read what is on it,
 * change its words and sections, and move between the versions she has
 * built. update_website_design (tools.ts) stays the way to change the look.
 * Writes go through the caller's RLS-scoped client; the builder picks them
 * up live (it reloads when the saved content changes under it).
 */

const SECTION_LIST = INIT_SECTIONS.map((s) => `${s.id} (${s.label})`).join(", ");

const ROW = (props: Record<string, { type: Type; description?: string }>) => ({
  type: Type.ARRAY,
  items: { type: Type.OBJECT, properties: props },
});

export const websiteFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "get_website",
    description:
      "Read the couple's wedding website: every section (on/off, and what is missing), its texts, programme, FAQ, hotels and contact, whether it is published, and the versions Ava has built (newest first, with which one is live). Call this before changing or talking about the site's content or versions.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "update_website_content",
    description:
      `Change what the wedding website says, not how it looks: its texts, which sections are shown, the programme, the FAQ, hotels and the contact person. Send only what changes. Lists (program, faq, hotels) replace the whole list, so send every row as it should read, in order. Never invent facts the couple did not give you (a story, an address, a date, a price, an answer); ask them instead. Sections: ${SECTION_LIST}. A built site shows new wording at once; new sections or rows are added by Ava automatically when the designer is unlocked.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        texts: {
          type: Type.OBJECT,
          description: "Texts to set. rsvpDeadline is YYYY-MM-DD.",
          properties: {
            heroTagline: { type: Type.STRING, description: "Welcome line under their names" },
            storyText: { type: Type.STRING, description: "Their story; blank line between paragraphs" },
            transport: { type: Type.STRING, description: "Address and how to get there" },
            dresscode: { type: Type.STRING },
            giftsText: { type: Type.STRING },
            giftsUrl: { type: Type.STRING },
            rsvpDeadline: { type: Type.STRING },
          },
        },
        countdown: { type: Type.BOOLEAN, description: "Show the countdown on the front page" },
        sections_on: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Section ids to show" },
        sections_off: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Section ids to hide" },
        program: ROW({ time: { type: Type.STRING, description: "HH:MM" }, label: { type: Type.STRING }, sublabel: { type: Type.STRING, description: "Place or detail" } }),
        faq: ROW({ q: { type: Type.STRING }, a: { type: Type.STRING } }),
        hotels: ROW({ name: { type: Type.STRING }, dist: { type: Type.STRING }, price: { type: Type.STRING } }),
        contact: {
          type: Type.OBJECT,
          description: "Who guests can call on the day",
          properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, phone: { type: Type.STRING }, email: { type: Type.STRING } },
        },
      },
    },
  },
  {
    name: "use_website_version",
    description:
      "Make an earlier version of the website the live one again (e.g. 'gå tilbage til den forrige', 'brug version 2'). Get version ids and numbers from get_website. Nothing is deleted; later versions stay in the list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        version_id: { type: Type.STRING, description: "The version's id from get_website" },
      },
      required: ["version_id"],
    },
  },
];

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const rows = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : undefined);

async function loadSite(supabase: SupabaseClient, event: EventRow) {
  const [{ data: site }, { data: designs }, { count: registryCount }] = await Promise.all([
    supabase.from("wedding_sites").select("*").eq("event_id", event.id).maybeSingle(),
    supabase.from("website_designs").select("*").eq("event_id", event.id).order("created_at", { ascending: false }),
    supabase.from("registry_items").select("id", { count: "exact", head: true }).eq("event_id", event.id),
  ]);
  return {
    site: site as WeddingSiteRow | null,
    designs: (designs as WebsiteDesignRow[] | null) ?? [],
    hasRegistry: (registryCount ?? 0) > 0,
  };
}

async function getWebsite(supabase: SupabaseClient, event: EventRow) {
  const { site, designs, hasRegistry } = await loadSite(supabase, event);
  const config = parseConfig(site?.config);
  const active = designs.find((d) => d.active) ?? null;
  return {
    published: Boolean(site?.published),
    public_path: site?.domain ? `/w/${site.domain}` : null,
    sections: CONTENT_STEPS.flatMap((step) => step.sections.map((id) => {
      const st = sectionStatus(id, config, { hasRegistry });
      return { id, step: step.label, state: st.state, missing: st.state === "todo" ? st.note?.replace("{n}", String(st.n ?? "")) : undefined };
    })),
    texts: {
      heroTagline: config.heroTagline, storyText: config.storyText, transport: config.transport,
      dresscode: config.dresscode, giftsText: config.giftsText, giftsUrl: config.giftsUrl,
      rsvpDeadline: config.rsvpDeadline, countdown: config.countdown,
    },
    program: config.program.map(({ time, label, sublabel }) => ({ time, label, sublabel })),
    faq: config.faq.map(({ q, a }) => ({ q, a })),
    hotels: config.hotels.map(({ name, dist, price }) => ({ name, dist, price })),
    contact: config.contact,
    built: Boolean(active?.html),
    needs_ava_update: Boolean(active?.html && needsRebuild(active.html, active.brief as never, config)),
    versions: describeVersions(designs)
      .filter((v) => v.kind !== "template" || v.active)
      .slice(0, 15)
      .map((v) => ({ id: v.id, number: v.number, what: v.kind, words: v.words || undefined, live: v.active, created_at: v.createdAt })),
  };
}

async function updateContent(supabase: SupabaseClient, event: EventRow, args: Record<string, unknown>) {
  const textsArg = (args.texts && typeof args.texts === "object" ? args.texts : {}) as Record<string, unknown>;
  const edit: ContentEdit = {
    texts: Object.fromEntries(Object.entries(textsArg).filter(([, v]) => typeof v === "string")) as ContentEdit["texts"],
    countdown: typeof args.countdown === "boolean" ? args.countdown : undefined,
    sectionsOn: (rows(args.sections_on) as unknown as string[] | undefined)?.map(String),
    sectionsOff: (rows(args.sections_off) as unknown as string[] | undefined)?.map(String),
    program: rows(args.program)?.map((r) => ({ time: str(r.time), label: str(r.label), sublabel: str(r.sublabel) })),
    faq: rows(args.faq)?.map((r) => ({ q: str(r.q), a: str(r.a) })),
    hotels: rows(args.hotels)?.map((r) => ({ name: str(r.name), dist: str(r.dist), price: str(r.price) })),
    contact: args.contact && typeof args.contact === "object" ? (args.contact as ContentEdit["contact"]) : undefined,
  };

  const { site, designs } = await loadSite(supabase, event);
  const { config, changed, unknownSections } = applyContentEdit(site?.config ?? {}, edit);
  if (changed.length === 0) {
    return { error: "nothing_to_change", unknown_sections: unknownSections.length ? unknownSections : undefined };
  }

  const { error } = await supabase.from("wedding_sites").upsert(
    {
      event_id: event.id, user_id: event.user_id, config,
      domain: site?.domain ?? null, published: site?.published ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) return { error: error.message };

  // Wording shows in a built site on its own. A new section or row needs
  // Ava to place it, with the design kept, when the designer is unlocked.
  const active = designs.find((d) => d.active) ?? null;
  let siteUpdated: "live" | "rebuilt" | "needs_unlock" | "not_built" = active?.html ? "live" : "not_built";
  if (active?.html && needsRebuild(active.html, active.brief as never, parseConfig(config))) {
    const { hasWebsiteAccess } = await import("@/lib/website/generate");
    if (await hasWebsiteAccess(supabase, event.id)) {
      const { buildSiteHtml } = await import("@/lib/website/buildSite");
      await buildSiteHtml({ supabase, event, userId: event.user_id, syncContent: true });
      siteUpdated = "rebuilt";
    } else {
      siteUpdated = "needs_unlock";
    }
  }
  return {
    ok: true,
    changed,
    unknown_sections: unknownSections.length ? unknownSections : undefined,
    site: siteUpdated,
    note: siteUpdated === "needs_unlock"
      ? "Saved. The built site needs Ava to add the new sections or rows, which is part of the paid designer; tell them to unlock it under Hjemmeside."
      : siteUpdated === "not_built"
        ? "Saved. They can see it under Hjemmeside → Indhold; Ava builds the site from it under Design."
        : "Saved, and the site shows it now.",
  };
}

async function switchVersion(supabase: SupabaseClient, event: EventRow, args: Record<string, unknown>) {
  const id = String(args.version_id ?? "");
  const { data: target } = await supabase
    .from("website_designs").select("id, active, html").eq("id", id).eq("event_id", event.id).maybeSingle();
  if (!target) return { error: "No such version. Call get_website for the list." };
  if (!target.active) {
    await supabase.from("website_designs").update({ active: false }).eq("event_id", event.id).eq("active", true);
    const { error } = await supabase.from("website_designs").update({ active: true }).eq("id", id);
    if (error) return { error: error.message };
  }
  return { ok: true, note: "That version is live again. The newer ones are still in the list under Hjemmeside → Design." };
}

/** Runs a website tool, or returns null for a name that is not one. */
export async function execWebsiteTool(
  supabase: SupabaseClient,
  event: EventRow,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  switch (name) {
    case "get_website": return getWebsite(supabase, event);
    case "update_website_content": return updateContent(supabase, event, args);
    case "use_website_version": return switchVersion(supabase, event, args);
    default: return null;
  }
}
