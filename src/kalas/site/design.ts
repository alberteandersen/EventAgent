/* The AI site-design contract. Juno (Gemini, structured output) emits a raw
   blob shaped like SiteDesign; parseSiteDesign() is the trust boundary that
   turns it into a safe, fully-defaulted value. Only validated hex colors and
   enum tokens ever reach CSS, every free-text field is rendered strictly as
   React text. The renderer (SiteRenderer.tsx) interprets this and nothing
   else, so a design blob can restyle everything but can never inject markup,
   scripts or arbitrary styles. */

import type { SectionId } from './config';
import { FONT_IDS } from './fonts';

/* ── Enum vocabularies (renderer implements exactly these) ─────────────── */

export const HERO_VARIANTS = ['full-bleed', 'split', 'framed', 'editorial', 'minimal', 'arch'] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const SECTION_BGS = ['default', 'surface', 'wash', 'inverse'] as const;
export type SectionBg = (typeof SECTION_BGS)[number];

/** Per-section layout variants. First entry is the default. */
export const SECTION_VARIANTS: Record<string, readonly string[]> = {
  story:     ['centered', 'side-image', 'quote'],
  program:   ['timeline', 'columns', 'minimal'],
  gallery:   ['grid', 'masonry', 'filmstrip'],
  gifts:     ['cards', 'list'],
  transport: ['text', 'framed'],
  dresscode: ['text', 'framed'],
  hotel:     ['cards', 'list'],
  faq:       ['accordion', 'two-col'],
  rsvp:      ['band', 'card'],
};

export const RADII = ['none', 'soft', 'round'] as const;
export const DENSITIES = ['airy', 'comfortable', 'compact'] as const;
export const BORDERS = ['none', 'hairline', 'bold'] as const;
export const WIDTHS = ['narrow', 'normal', 'wide'] as const;
export const TYPE_SCALES = ['normal', 'large', 'dramatic'] as const;
export const TRACKING = ['tight', 'normal', 'wide'] as const;
export const DECOR_STYLES = ['none', 'botanical', 'stars', 'grain', 'lines', 'dots'] as const;
export const DISPLAY_WEIGHTS = [400, 500, 600, 700] as const;

/* ── The design blob ───────────────────────────────────────────────────── */

export interface DesignSection {
  id: SectionId;
  variant: string;
  bg: SectionBg;
  /** Optional Juno-written section heading / intro line (plain text). */
  heading?: string;
  intro?: string;
}

export interface SiteDesign {
  version: 1;
  concept: {
    /** Short evocative name, e.g. "Nordisk Sommernat". */
    name: string;
    /** One or two sentences: why this design fits the couple. */
    rationale: string;
  };
  palette: {
    bg: string;        // page background
    surface: string;   // raised cards / alternate bands
    text: string;      // primary text on bg
    muted: string;     // secondary text on bg
    accent: string;    // buttons, links, highlights
    onAccent: string;  // text on accent
    /** 0–0.9 dark overlay strength over hero imagery. */
    heroOverlay: number;
  };
  typography: {
    displayFont: string;         // id from SITE_FONTS
    bodyFont: string;            // id from SITE_FONTS
    displayWeight: number;       // one of DISPLAY_WEIGHTS
    displayItalic: boolean;
    uppercaseEyebrows: boolean;
    scale: (typeof TYPE_SCALES)[number];
    tracking: (typeof TRACKING)[number];
  };
  shape: {
    radius: (typeof RADII)[number];
    density: (typeof DENSITIES)[number];
    borders: (typeof BORDERS)[number];
    maxWidth: (typeof WIDTHS)[number];
  };
  hero: {
    variant: HeroVariant;
    showCountdown: boolean;
  };
  /** Ordered — render order of enabled sections. Hero is implicit and first. */
  sections: DesignSection[];
  copy: {
    tagline: string;
    storyIntro: string;
    rsvpCta: string;
    footerLine: string;
  };
  images: {
    /** site_photos id (uuid) or stock IMAGES key. Empty = renderer fallback. */
    heroPhotoId: string;
    galleryPhotoIds: string[];
  };
  decor: {
    style: (typeof DECOR_STYLES)[number];
    dividers: boolean;
  };
}

/* ── Defaults ──────────────────────────────────────────────────────────── */

const DEFAULT_SECTIONS: DesignSection[] = [
  { id: 'story', variant: 'centered', bg: 'default' },
  { id: 'program', variant: 'timeline', bg: 'surface' },
  { id: 'gallery', variant: 'grid', bg: 'default' },
  { id: 'gifts', variant: 'cards', bg: 'default' },
  { id: 'transport', variant: 'text', bg: 'surface' },
  { id: 'dresscode', variant: 'text', bg: 'surface' },
  { id: 'hotel', variant: 'cards', bg: 'default' },
  { id: 'faq', variant: 'accordion', bg: 'default' },
  { id: 'rsvp', variant: 'band', bg: 'inverse' },
];

/** Hand-written editorial design — what a site shows before Juno has designed
    it (and what legacy published sites fall back to). */
export const DEFAULT_DESIGN: SiteDesign = {
  version: 1,
  concept: {
    name: 'Editorial',
    rationale: 'Rolig, klassisk udgangsside indtil Juno har designet jeres egen.',
  },
  palette: {
    bg: '#f2ede4',
    surface: '#faf7f1',
    text: '#2c3826',
    muted: '#6b7261',
    accent: '#4a5a3c',
    onAccent: '#f5f2ea',
    heroOverlay: 0.35,
  },
  typography: {
    displayFont: 'fraunces',
    bodyFont: 'karla',
    displayWeight: 500,
    displayItalic: false,
    uppercaseEyebrows: true,
    scale: 'normal',
    tracking: 'normal',
  },
  shape: { radius: 'soft', density: 'comfortable', borders: 'hairline', maxWidth: 'normal' },
  hero: { variant: 'full-bleed', showCountdown: true },
  sections: DEFAULT_SECTIONS,
  copy: {
    tagline: 'Kom og fejr dagen med os',
    storyIntro: '',
    rsvpCta: 'Svar udbedes',
    footerLine: '',
  },
  images: { heroPhotoId: '', galleryPhotoIds: [] },
  decor: { style: 'none', dividers: false },
};

/* ── Validation (the trust boundary) ───────────────────────────────────── */

const HEX_RE = /^#[0-9a-f]{6}$/i;

const hex = (v: unknown, d: string): string =>
  typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim().toLowerCase() : d;

const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], d: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : d;

const text = (v: unknown, d: string, max = 400): string =>
  typeof v === 'string' ? v.slice(0, max) : d;

const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

const clamp01 = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(0.9, Math.max(0, v)) : d;

const fontId = (v: unknown, d: string): string =>
  typeof v === 'string' && FONT_IDS.includes(v) ? v : d;

/** Photo refs are site_photos uuids or stock keys — safe charset only. */
const photoRef = (v: unknown): string | null =>
  typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null;

const VALID_SECTION_IDS = Object.keys(SECTION_VARIANTS);

function parseSections(v: unknown): DesignSection[] {
  if (!Array.isArray(v)) return DEFAULT_SECTIONS;
  const out: DesignSection[] = [];
  const seen = new Set<string>();
  for (const s of v) {
    if (typeof s !== 'object' || s === null) continue;
    const o = s as Record<string, unknown>;
    const id = typeof o.id === 'string' && VALID_SECTION_IDS.includes(o.id) ? (o.id as SectionId) : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const variants = SECTION_VARIANTS[id];
    out.push({
      id,
      variant: oneOf(o.variant, variants, variants[0]),
      bg: oneOf(o.bg, SECTION_BGS, 'default'),
      heading: typeof o.heading === 'string' ? o.heading.slice(0, 120) : undefined,
      intro: typeof o.intro === 'string' ? o.intro.slice(0, 400) : undefined,
    });
  }
  return out.length > 0 ? out : DEFAULT_SECTIONS;
}

/** Render list for a design given the couple's enabled content sections.
    The design dictates order/variants, but a section the couple has turned ON
    must always render, designs generated before the toggle (or that omit a
    section) get it appended with defaults, before a trailing RSVP band. */
export function mergeSections(design: SiteDesign, enabledIds: Set<string>): DesignSection[] {
  const fromDesign = design.sections.filter((s) => enabledIds.has(s.id));
  const have = new Set(fromDesign.map((s) => s.id));
  const missing = DEFAULT_SECTIONS.filter((d) => enabledIds.has(d.id) && !have.has(d.id));
  if (missing.length === 0) return fromDesign;
  const tailRsvp = fromDesign.length > 0 && fromDesign[fromDesign.length - 1].id === 'rsvp';
  return tailRsvp
    ? [...fromDesign.slice(0, -1), ...missing.filter((m) => m.id !== 'rsvp'), fromDesign[fromDesign.length - 1]]
    : [...fromDesign, ...missing];
}

/** Parse an untrusted design blob (model output or stored JSON) into a safe,
    fully-defaulted SiteDesign. Never throws. */
export function parseSiteDesign(raw: unknown): SiteDesign {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_DESIGN;
  const concept = (r.concept ?? {}) as Record<string, unknown>;
  const palette = (r.palette ?? {}) as Record<string, unknown>;
  const typo = (r.typography ?? {}) as Record<string, unknown>;
  const shape = (r.shape ?? {}) as Record<string, unknown>;
  const hero = (r.hero ?? {}) as Record<string, unknown>;
  const copy = (r.copy ?? {}) as Record<string, unknown>;
  const images = (r.images ?? {}) as Record<string, unknown>;
  const decor = (r.decor ?? {}) as Record<string, unknown>;

  const galleryRaw = Array.isArray(images.galleryPhotoIds) ? images.galleryPhotoIds : [];
  const gallery = galleryRaw.map(photoRef).filter((p): p is string => p !== null).slice(0, 24);

  return {
    version: 1,
    concept: {
      name: text(concept.name, D.concept.name, 60),
      rationale: text(concept.rationale, D.concept.rationale, 500),
    },
    palette: {
      bg: hex(palette.bg, D.palette.bg),
      surface: hex(palette.surface, D.palette.surface),
      text: hex(palette.text, D.palette.text),
      muted: hex(palette.muted, D.palette.muted),
      accent: hex(palette.accent, D.palette.accent),
      onAccent: hex(palette.onAccent, D.palette.onAccent),
      heroOverlay: clamp01(palette.heroOverlay, D.palette.heroOverlay),
    },
    typography: {
      displayFont: fontId(typo.displayFont, D.typography.displayFont),
      bodyFont: fontId(typo.bodyFont, D.typography.bodyFont),
      displayWeight: oneOf(typo.displayWeight, DISPLAY_WEIGHTS, 500),
      displayItalic: bool(typo.displayItalic, D.typography.displayItalic),
      uppercaseEyebrows: bool(typo.uppercaseEyebrows, D.typography.uppercaseEyebrows),
      scale: oneOf(typo.scale, TYPE_SCALES, D.typography.scale),
      tracking: oneOf(typo.tracking, TRACKING, D.typography.tracking),
    },
    shape: {
      radius: oneOf(shape.radius, RADII, D.shape.radius),
      density: oneOf(shape.density, DENSITIES, D.shape.density),
      borders: oneOf(shape.borders, BORDERS, D.shape.borders),
      maxWidth: oneOf(shape.maxWidth, WIDTHS, D.shape.maxWidth),
    },
    hero: {
      variant: oneOf(hero.variant, HERO_VARIANTS, D.hero.variant),
      showCountdown: bool(hero.showCountdown, D.hero.showCountdown),
    },
    sections: parseSections(r.sections),
    copy: {
      tagline: text(copy.tagline, D.copy.tagline, 140),
      storyIntro: text(copy.storyIntro, D.copy.storyIntro, 400),
      rsvpCta: text(copy.rsvpCta, D.copy.rsvpCta, 60),
      footerLine: text(copy.footerLine, D.copy.footerLine, 140),
    },
    images: {
      heroPhotoId: photoRef(images.heroPhotoId) ?? '',
      galleryPhotoIds: gallery,
    },
    decor: {
      style: oneOf(decor.style, DECOR_STYLES, D.decor.style),
      dividers: bool(decor.dividers, D.decor.dividers),
    },
  };
}
