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
  | 'transport' | 'dresscode' | 'gifts' | 'hotel' | 'faq' | 'photos';
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
];

/* The programme keeps its example times: the couple sees and edits these in
   the builder before the section renders, and a timeline with no rows is
   harder to start from than one to adjust. Unlike the FAQ, nothing here
   asserts a fact about their wedding that a guest could act on. */
export const INIT_PROGRAM: ProgramEvent[] = [
  { id: 'e1', time: '14:00', label: 'Vielse',                sublabel: 'Sonnerupgaard Kapel' },
  { id: 'e2', time: '15:30', label: 'Velkomst & champagne',  sublabel: 'Terrassen'           },
  { id: 'e3', time: '18:00', label: 'Middag',                sublabel: 'Den store sal'       },
  { id: 'e4', time: '22:00', label: 'Fest, musik & dans',    sublabel: ''                    },
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
  pwProtected: boolean; hideBranding: boolean;
}

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const arr = <T,>(v: unknown, d: T[]) => (Array.isArray(v) ? (v as T[]) : d);

/** Parse a stored config blob into a typed, defaulted SiteConfig. */
export function parseConfig(raw: Record<string, unknown> | null | undefined): SiteConfig {
  const c = raw ?? {};
  return {
    sections: arr<SectionMeta>(c.sections, INIT_SECTIONS),
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
    pwProtected: bool(c.pwProtected, false),
    hideBranding: bool(c.hideBranding, false),
  };
}
