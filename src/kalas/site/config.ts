/* Shared wedding-site CONTENT config: types and defaults used by the builder
   (src/kalas/screens/Website.tsx) and the public renderer (SiteRenderer.tsx +
   /w/[slug]). The couple's content persists in wedding_sites.config (JSONB);
   parseConfig() reads that blob into a typed, defaulted SiteConfig. The site's
   LOOK lives separately in website_designs (see design.ts), Ava generates it.
   `sitePassword` is deliberately NOT part of SiteConfig, it never reaches the
   client. */

import type { IMAGES } from '../data';

export type ImageKey = keyof typeof IMAGES;

export type ProgramEvent = { id: string; time: string; label: string; sublabel: string };
export type FAQItem = { id: string; q: string; a: string };
export type HotelItem = { id: string; name: string; dist: string; price: string };
export type SectionId =
  | 'hero' | 'story' | 'program' | 'rsvp' | 'gallery'
  | 'transport' | 'dresscode' | 'gifts' | 'hotel' | 'faq' | 'photos'
  | 'contact' | 'seat' | 'guestbook';

/** A named person guests can ring on the day: the toastmaster, a sibling. */
export type GuestContact = { name: string; role: string; phone: string; email: string };
export type SectionMeta = { id: SectionId; label: string; desc: string; enabled: boolean; locked?: boolean };

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'os';

export const INIT_SECTIONS: SectionMeta[] = [
  { id: 'hero',      label: 'Forside',           desc: 'Navne, dato & velkomstbesked',       enabled: true, locked: true },
  { id: 'story',     label: 'Vores historie',    desc: 'Fortæl jeres kærlighedshistorie',    enabled: true  },
  { id: 'program',   label: 'Program for dagen', desc: 'Tidslinje med programpunkter',       enabled: true  },
  { id: 'rsvp',      label: 'RSVP',              desc: 'Tilmeldingsformular til gæsterne',   enabled: true  },
  { id: 'gallery',   label: 'Galleri',           desc: 'Billeder fra jeres moodboard',       enabled: true  },
  { id: 'transport', label: 'Transport',          desc: 'Adresse og vejledning til stedet',   enabled: false },
  { id: 'dresscode', label: 'Dresscode',          desc: 'Hvad gæsterne skal have på',        enabled: false },
  { id: 'gifts',     label: 'Gaveønsker',         desc: 'Ønskeliste eller bidrag til rejse', enabled: false },
  { id: 'hotel',     label: 'Overnatning',        desc: 'Anbefalede hoteller tæt på stedet', enabled: false },
  { id: 'faq',       label: 'FAQ for gæster',    desc: 'Svar på de hyppige spørgsmål',      enabled: false },
  { id: 'photos',    label: 'Del billeder',       desc: 'Gæsterne uploader deres fotos',     enabled: true  },
  { id: 'contact',   label: 'Gæstekontakt',       desc: 'Én at ringe til på dagen',           enabled: false },
  { id: 'seat',      label: 'Find min plads',     desc: 'Gæsten skriver sit navn og ser sit bord', enabled: false },
  { id: 'guestbook', label: 'Gæstebog',           desc: 'Hilsner fra gæsterne, som I godkender', enabled: false },
];

/* The guest-hub sections. They are Kalas' own interactive blocks, drawn under
   the couple's design rather than by it, so the site generator must never be
   asked to lay them out. */
export const HUB_SECTIONS: SectionId[] = ['contact', 'seat', 'guestbook'];

/**
 * A saved section list, with any section added since it was saved appended
 * in its default state. Without this a site saved before "Find min plads"
 * existed would never offer it, since the saved list replaced the defaults
 * wholesale. Unknown ids from the future are kept rather than dropped.
 */
export function withAllSections(saved: SectionMeta[]): SectionMeta[] {
  const have = new Set(saved.map((s) => s.id));
  return [...saved, ...INIT_SECTIONS.filter((s) => !have.has(s.id))];
}

/* The programme keeps its example times: the couple sees and edits these in
   the builder before the section renders, and a timeline with no rows is
   harder to start from than one to adjust. No places: "Sonnerupgaard Kapel"
   used to sit under the vielse, which is somebody else's church. The
   builder replaces all of this with their own Bryllupsdagen when they have
   one. */
export const INIT_PROGRAM: ProgramEvent[] = [
  { id: 'e1', time: '14:00', label: 'Vielse',                sublabel: '' },
  { id: 'e2', time: '15:30', label: 'Velkomst & champagne',  sublabel: '' },
  { id: 'e3', time: '18:00', label: 'Middag',                sublabel: '' },
  { id: 'e4', time: '22:00', label: 'Fest, musik & dans',    sublabel: '' },
];

/* Questions, no answers. These used to ship with answers — a made-up RSVP
   deadline and a hotel in Roskilde — and a couple who switched the section on
   without editing published both as their own. A question with a blank answer
   is visibly unfinished; "1. august 2026" is not. */
export const INIT_FAQ: FAQItem[] = [
  { id: 'f1', q: 'Hvad er dresscode?',          a: '' },
  { id: 'f2', q: 'Er der parkering på stedet?', a: '' },
  { id: 'f3', q: 'Hvornår er RSVP-deadline?',   a: '' },
];

/* Empty for the same reason: an unedited hotel list is a recommendation the
   couple never made, with a price they never checked. */
export const INIT_HOTELS: HotelItem[] = [];

export const GALLERY_KEYS: ImageKey[] = ['florals', 'olive', 'candles', 'arch', 'ceremony', 'rings'];


/** Public-safe, fully-defaulted view of wedding_sites.config (no password). */
export interface SiteConfig {
  sections: SectionMeta[];
  /** Sections that get an Ava-generated illustration in the build. */
  aiImages: SectionId[];
  heroTagline: string; storyText: string; countdown: boolean;
  program: ProgramEvent[];
  rsvpDeadline: string; rsvpPlusOne: boolean; rsvpMeal: boolean; rsvpDietary: boolean;
  galleryKeys: ImageKey[];
  transport: string; dresscode: string; giftsText: string; giftsUrl: string;
  faq: FAQItem[]; hotels: HotelItem[];
  contact: GuestContact;
  pwProtected: boolean; hideBranding: boolean;
}

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const arr = <T,>(v: unknown, d: T[]) => (Array.isArray(v) ? (v as T[]) : d);

/** Parse a stored config blob into a typed, defaulted SiteConfig. */
export function parseConfig(raw: Record<string, unknown> | null | undefined): SiteConfig {
  const c = raw ?? {};
  return {
    sections: withAllSections(arr<SectionMeta>(c.sections, INIT_SECTIONS)),
    aiImages: arr<SectionId>(c.aiImages, ['dresscode', 'transport', 'gifts']),
    heroTagline: str(c.heroTagline, 'Kom og fejr dagen med os'),
    storyText: str(c.storyText, ''),
    countdown: bool(c.countdown, true),
    program: arr<ProgramEvent>(c.program, INIT_PROGRAM),
    rsvpDeadline: str(c.rsvpDeadline, ''),
    rsvpPlusOne: bool(c.rsvpPlusOne, true),
    rsvpMeal: bool(c.rsvpMeal, true),
    rsvpDietary: bool(c.rsvpDietary, true),
    galleryKeys: arr<ImageKey>(c.galleryKeys, GALLERY_KEYS.slice(0, 4)),
    transport: str(c.transport, ''),
    dresscode: str(c.dresscode, ''),
    giftsText: str(c.giftsText, ''),
    giftsUrl: str(c.giftsUrl, ''),
    faq: arr<FAQItem>(c.faq, INIT_FAQ),
    hotels: arr<HotelItem>(c.hotels, INIT_HOTELS),
    contact: readContact(c.contact),
    pwProtected: bool(c.pwProtected, false),
    hideBranding: bool(c.hideBranding, false),
  };
}

export const EMPTY_CONTACT: GuestContact = { name: '', role: '', phone: '', email: '' };

function readContact(raw: unknown): GuestContact {
  if (!raw || typeof raw !== 'object') return EMPTY_CONTACT;
  const c = raw as Record<string, unknown>;
  const field = (v: unknown) => (typeof v === 'string' ? v.slice(0, 120) : '');
  return { name: field(c.name), role: field(c.role), phone: field(c.phone), email: field(c.email) };
}

/** True when there is anything to show: a name and a way to reach them. */
export function hasContact(c: GuestContact): boolean {
  return Boolean(c.name.trim() && (c.phone.trim() || c.email.trim()));
}

/** What Ava builds the site from: the enabled sections she lays out and
    their texts. The hero and the guest-hub blocks are drawn by Kalas, not
    by her, so they are not hers to render. */
export function siteContent(config: SiteConfig) {
  return {
    sections: config.sections
      .filter((s) => s.enabled && s.id !== 'hero' && s.id !== 'photos' && !HUB_SECTIONS.includes(s.id))
      .map((s) => s.id),
    heroTagline: config.heroTagline,
    storyText: config.storyText,
    countdown: config.countdown,
    // Rows spelled out field by field: the same programme must read the same
    // whichever way its objects were put together (builder, chat, database).
    program: config.program.map((p) => ({ id: p.id, time: p.time, label: p.label, sublabel: p.sublabel })),
    rsvpDeadline: config.rsvpDeadline,
    transport: config.transport,
    dresscode: config.dresscode,
    giftsText: config.giftsText,
    giftsUrl: config.giftsUrl,
    faq: config.faq.map((f) => ({ id: f.id, q: f.q, a: f.a })),
    hotels: config.hotels.map((h) => ({ id: h.id, name: h.name, dist: h.dist, price: h.price })),
  };
}

/**
 * A short fingerprint of the content a build was made from. A build bakes
 * the texts into its HTML, so the builder compares this against the content
 * as it stands to tell the couple their guests still see the old words.
 * FNV-1a: it runs the same in the browser and on the server.
 */
export function contentKey(config: SiteConfig): string {
  const text = JSON.stringify(siteContent(config));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
