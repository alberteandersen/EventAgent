/* The chat agent's edits to the site's content, as a pure step: the saved
   config in, a change from Juno's tool call, the new config out. Lists are
   replaced whole (Juno sends the programme as it should read), but a row
   keeps the id of the row it replaces, so rewording a programme is a text
   change the built site shows at once (see slots.ts), not a new shape that
   needs a rebuild. */

import { INIT_SECTIONS, withAllSections, type SectionId, type SectionMeta } from "@/kalas/site/config";

export const TEXT_FIELDS = ["heroTagline", "storyText", "transport", "dresscode", "giftsText", "giftsUrl", "rsvpDeadline"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

const SECTION_IDS = new Set<string>(INIT_SECTIONS.map((s) => s.id));

export interface ContentEdit {
  texts?: Partial<Record<TextField, string>>;
  countdown?: boolean;
  sectionsOn?: string[];
  sectionsOff?: string[];
  program?: { time?: string; label?: string; sublabel?: string }[];
  faq?: { q?: string; a?: string }[];
  hotels?: { name?: string; dist?: string; price?: string }[];
  contact?: { name?: string; role?: string; phone?: string; email?: string };
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oldIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? String((x as { id?: unknown }).id ?? "") : "")) : [];

/** Row i keeps the id row i had; rows beyond the old list get a fresh one. */
function withIds<T>(rows: T[], previous: unknown, prefix: string, stamp: string): (T & { id: string })[] {
  const ids = oldIds(previous);
  return rows.map((r, i) => ({ id: ids[i] || `${prefix}${stamp}-${i}`, ...r }));
}

export interface EditResult {
  config: Record<string, unknown>;
  /** What changed, in words the agent can repeat. */
  changed: string[];
  /** Section ids the call named that do not exist. */
  unknownSections: string[];
}

export function applyContentEdit(saved: Record<string, unknown>, edit: ContentEdit, stamp = String(Date.now())): EditResult {
  const next: Record<string, unknown> = { ...saved };
  const changed: string[] = [];

  for (const field of TEXT_FIELDS) {
    const v = edit.texts?.[field];
    if (typeof v !== "string") continue;
    if (field === "rsvpDeadline" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) continue;
    next[field] = s(v, field === "storyText" ? 3000 : 600);
    changed.push(field);
  }
  if (typeof edit.countdown === "boolean") { next.countdown = edit.countdown; changed.push("countdown"); }

  const unknownSections = [...(edit.sectionsOn ?? []), ...(edit.sectionsOff ?? [])].filter((id) => !SECTION_IDS.has(id));
  if (edit.sectionsOn?.length || edit.sectionsOff?.length) {
    const on = new Set(edit.sectionsOn ?? []);
    const off = new Set(edit.sectionsOff ?? []);
    const sections = withAllSections(Array.isArray(saved.sections) ? (saved.sections as SectionMeta[]) : INIT_SECTIONS)
      .map((sec) => (sec.locked ? sec : on.has(sec.id) ? { ...sec, enabled: true } : off.has(sec.id) ? { ...sec, enabled: false } : sec));
    next.sections = sections;
    changed.push(...[...on].filter((id) => SECTION_IDS.has(id)).map((id) => `on:${id as SectionId}`));
    changed.push(...[...off].filter((id) => SECTION_IDS.has(id)).map((id) => `off:${id as SectionId}`));
  }

  if (Array.isArray(edit.program)) {
    const rows = edit.program.slice(0, 30).map((p) => ({ time: s(p.time, 10), label: s(p.label, 120), sublabel: s(p.sublabel, 160) }))
      .filter((p) => p.label || p.time);
    next.program = withIds(rows, saved.program, "e", stamp);
    changed.push("program");
  }
  if (Array.isArray(edit.faq)) {
    const rows = edit.faq.slice(0, 30).map((f) => ({ q: s(f.q, 200), a: s(f.a, 800) })).filter((f) => f.q);
    next.faq = withIds(rows, saved.faq, "f", stamp);
    changed.push("faq");
  }
  if (Array.isArray(edit.hotels)) {
    const rows = edit.hotels.slice(0, 20).map((h) => ({ name: s(h.name, 120), dist: s(h.dist, 60), price: s(h.price, 60) })).filter((h) => h.name);
    next.hotels = withIds(rows, saved.hotels, "h", stamp);
    changed.push("hotels");
  }
  if (edit.contact && typeof edit.contact === "object") {
    const prev = (saved.contact && typeof saved.contact === "object" ? saved.contact : {}) as Record<string, unknown>;
    next.contact = {
      name: s(edit.contact.name ?? prev.name, 120), role: s(edit.contact.role ?? prev.role, 120),
      phone: s(edit.contact.phone ?? prev.phone, 120), email: s(edit.contact.email ?? prev.email, 120),
    };
    changed.push("contact");
  }
  return { config: next, changed, unknownSections };
}
