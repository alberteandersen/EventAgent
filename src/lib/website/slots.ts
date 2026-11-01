/* Text slots: the couple's words in a built site, kept live.

   Juno marks every piece of the couple's own text in the HTML she builds
   with data-kalas="text:<key>", holding nothing but that text. The builder
   preview and the public page pour the content as it stands now into those
   elements, so a reworded answer or a moved time shows at once, with no
   rebuild. What text cannot do (a section switched on, a programme row
   added) still needs Juno; structureKey() is the part of the content that
   decides that.

   The values are escaped here: they are the couple's plain text, going into
   markup that has already passed the sanitizer. */

import { siteContent, contentKey, type SiteConfig } from "@/kalas/site/config";

/** Every slot key and the text it holds now. List rows key by their id. */
export function slotValues(config: SiteConfig): Record<string, string> {
  const v: Record<string, string> = {
    heroTagline: config.heroTagline,
    storyText: config.storyText,
    transport: config.transport,
    dresscode: config.dresscode,
    giftsText: config.giftsText,
  };
  for (const p of config.program) {
    v[`program:${p.id}:time`] = p.time;
    v[`program:${p.id}:label`] = p.label;
    v[`program:${p.id}:sublabel`] = p.sublabel;
  }
  for (const f of config.faq) {
    v[`faq:${f.id}:q`] = f.q;
    v[`faq:${f.id}:a`] = f.a;
  }
  for (const h of config.hotels) {
    v[`hotel:${h.id}:name`] = h.name;
    v[`hotel:${h.id}:dist`] = h.dist;
    v[`hotel:${h.id}:price`] = h.price;
  }
  return v;
}

const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* A slot element with nothing but text inside. Anything with child tags is
   not a slot we can pour into safely, and is left exactly as Juno wrote it. */
const SLOT_RE = /<([a-z][a-z0-9]*)(\s[^>]*?\bdata-kalas="text:([^"]{1,120})"[^>]*)>([^<]*)<\/\1>/gi;

/** The built HTML with every known slot holding the current text. */
export function fillSlots(html: string, config: SiteConfig): string {
  const values = slotValues(config);
  return html.replace(SLOT_RE, (whole, tag: string, attrs: string, key: string) => {
    const value = values[key];
    // A slot for a row that is gone keeps its old words until Juno rebuilds.
    if (value === undefined) return whole;
    return `<${tag}${attrs}>${escapeText(value)}</${tag}>`;
  });
}

/** The slot keys a built HTML actually carries. */
export function slotKeysIn(html: string): Set<string> {
  const keys = new Set<string>();
  for (const m of html.matchAll(SLOT_RE)) keys.add(m[3]);
  return keys;
}

/** What only Juno can change: which sections, which rows, and the few
    values she formats herself (a date, a link, the countdown). */
export function structureKey(config: SiteConfig): string {
  const c = siteContent(config);
  return contentKey({
    ...config,
    // Blank every text a slot carries, so only the shape is left.
    heroTagline: "", storyText: "", transport: "", dresscode: "", giftsText: "",
    program: c.program.map((p) => ({ ...p, time: "", label: "", sublabel: "" })),
    faq: c.faq.map((f) => ({ ...f, q: "", a: "" })),
    hotels: c.hotels.map((h) => ({ ...h, name: "", dist: "", price: "" })),
  });
}

/** What a build records about the content it was made from. */
export function buildStamp(config: SiteConfig) {
  return { contentKey: contentKey(config), structureKey: structureKey(config), slots: true as const };
}

type Stamp = { contentKey?: string; structureKey?: string; slots?: boolean };

/**
 * Whether the built site needs Juno to catch up with the content. A build
 * with slots only does when the shape changed, or when a text it should
 * show has nowhere to go because Juno wrote it without a slot. Older builds
 * know only the whole content, so any change counts. A build that recorded
 * nothing cannot tell, and says no rather than guess.
 */
export function needsRebuild(html: string, stamp: Stamp | null | undefined, config: SiteConfig): boolean {
  if (!stamp?.contentKey) return false;
  if (stamp.contentKey === contentKey(config)) return false;
  if (!stamp.slots) return true;
  if (stamp.structureKey !== structureKey(config)) return true;

  const onSections = new Set(siteContent(config).sections);
  const sectionOf = (key: string) =>
    key.startsWith("program:") ? "program"
    : key.startsWith("faq:") ? "faq"
    : key.startsWith("hotel:") ? "hotel"
    : ({ heroTagline: "hero", storyText: "story", transport: "transport", dresscode: "dresscode", giftsText: "gifts" } as Record<string, string>)[key];
  const have = slotKeysIn(html);
  return Object.entries(slotValues(config)).some(([key, value]) => {
    const section = sectionOf(key);
    const shown = section === "hero" || onSections.has(section as never);
    return shown && value.trim() !== "" && !have.has(key);
  });
}
