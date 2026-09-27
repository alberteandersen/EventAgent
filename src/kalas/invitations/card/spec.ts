/* A card design, as stored in invitation_designs.design: the paper, the
   painted artwork, where the words may go, and how each block of words is
   set. It says nothing about what the facts are. Names, date, venue and the
   rest come from the invitation's content at render time, so the card can
   never disagree with the details, and Ava only decides how they look (and
   writes the few lines of wording the couple has not written themselves).

   parseCardSpec is the trust boundary for model output and stored JSON:
   fonts from the catalog, colours as hex, every number clamped. */

import { CARD_FONT_IDS } from './fonts';
import { findFormat, type CardFormatId } from './formats';

export const BLOCK_ROLES = [
  'eyebrow', 'photo', 'names', 'invite', 'dateRow', 'date', 'venue', 'note', 'divider', 'closing', 'rsvp',
] as const;

/** What a divider may be: '' is a short hairline, the rest are set as type. */
export const DIVIDERS = ['', '♥ ♥', '✦', '· · ·', '❦'] as const;

/** What stands between the names: &, +, or the word ("og" / "and"). */
export const JOINERS = ['amp', 'plus', 'word'] as const;
export type Joiner = (typeof JOINERS)[number];

/** How a date block says the date: "Lørdag den 12. juni 2027", "12. juni
    2027", or "12.06.27". */
export const DATE_STYLES = ['long', 'short', 'numeric'] as const;
export type DateStyle = (typeof DATE_STYLES)[number];

/** A photo of the couple, set on the card as a real image (never through the
    image model, so faces stay theirs). */
export interface PhotoStyle {
  /** Width as a share of the text area. */
  width: number;
  /** Width over height. */
  aspect: number;
  tone: 'bw' | 'color';
  /** A strip of tape across the top edge, as if stuck on. */
  tape: boolean;
}
export type BlockRole = (typeof BLOCK_ROLES)[number];

/** Roles whose words Ava (or the vibe) writes; the rest are the couple's facts. */
export const WORDING_ROLES = ['eyebrow', 'invite', 'closing'] as const;
export type WordingRole = (typeof WORDING_ROLES)[number];

export interface TextStyle {
  font: string;
  /** Units: the card is 1000 wide. */
  size: number;
  weight: number;
  italic: boolean;
  caps: boolean;
  /** All lowercase, the way a hand-lettered card is set (caps wins). */
  lower?: boolean;
  /** Letter spacing, in em. */
  tracking: number;
  color: 'ink' | 'accent';
  lineHeight: number;
}

export interface CardBlock extends TextStyle {
  role: BlockRole;
  /** The wording for eyebrow / invite / closing; the ornament for a divider.
      Ignored for fact roles. */
  text: string;
  /** Space above the block, in units. */
  gap: number;
  /** names: one name per line with the joiner between. */
  stack?: boolean;
  /** names: what stands between them. */
  joiner?: Joiner;
  /** names, stacked: the joiner in its own style ("and" in a script
      between names set in capitals). */
  joinerStyle?: TextStyle;
  /** date: how it is written. */
  dateStyle?: DateStyle;
  /** photo: its size and finish. */
  photo?: PhotoStyle;
  /** The supporting lines in their own style: the time under a date, the
      address under a venue, the small parts of a dateRow. */
  sub?: TextStyle;
}

/** Where the words may sit, as fractions of the card, clear of the artwork. */
export interface TextArea { top: number; bottom: number; left: number; right: number }

export interface CardSpec {
  version: 1;
  vibe: string;
  format: CardFormatId;
  conceptName: string;
  palette: { ink: string; accent: string; paper: string };
  art: {
    /** Storage path (invite-designs bucket) of Ava's painting, or null. */
    path: string | null;
    /** The vibe's sample painting (a public URL) until Ava paints one. */
    sample: string | null;
  };
  textArea: TextArea;
  /** Centred like most stationery, or set flush left. */
  align?: 'center' | 'left';
  blocks: CardBlock[];
}

/* ── Validation ────────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : d);
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const text = (v: unknown, d: string, max: number) => (typeof v === 'string' ? v.slice(0, max) : d);
const font = (v: unknown, d: string) => (typeof v === 'string' && CARD_FONT_IDS.includes(v) ? v : d);
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function parseStyle(raw: unknown, d: TextStyle): TextStyle {
  const o = obj(raw);
  return {
    font: font(o.font, d.font),
    size: num(o.size, 10, 260, d.size),
    weight: Math.round(num(o.weight, 300, 700, d.weight) / 100) * 100,
    italic: bool(o.italic, d.italic),
    caps: bool(o.caps, d.caps),
    lower: bool(o.lower, d.lower ?? false),
    tracking: num(o.tracking, -0.05, 0.5, d.tracking),
    color: o.color === 'accent' || o.color === 'ink' ? o.color : d.color,
    lineHeight: num(o.lineHeight, 0.8, 2, d.lineHeight),
  };
}

function parsePhoto(raw: unknown, d?: PhotoStyle): PhotoStyle {
  const o = obj(raw);
  return {
    width: num(o.width, 0.3, 1, d?.width ?? 0.8),
    aspect: num(o.aspect, 0.5, 2, d?.aspect ?? 1.1),
    tone: o.tone === 'bw' || o.tone === 'color' ? o.tone : d?.tone ?? 'color',
    tape: bool(o.tape, d?.tape ?? false),
  };
}

/** The storage path shape Ava's paintings are saved under; nothing else. */
const ART_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/i;
/** Sample paintings ship with the app. */
const SAMPLE_URL = /^\/invitations\/vibes\/[a-z0-9-]+\.(png|jpg|webp)$/;

/**
 * Parse an untrusted design (model output or stored JSON) over a fallback
 * (the vibe's starter design). Never throws. A block list that comes back
 * empty or without the names keeps the fallback's blocks.
 */
export function parseCardSpec(raw: unknown, fallback: CardSpec): CardSpec {
  const o = obj(raw);
  const palette = obj(o.palette);
  const art = obj(o.art);
  const area = obj(o.textArea);

  const byRole = new Map(fallback.blocks.map((b) => [b.role, b]));
  const seen = new Set<string>();
  const blocks: CardBlock[] = [];
  for (const item of Array.isArray(o.blocks) ? o.blocks : []) {
    const b = obj(item);
    const role = BLOCK_ROLES.find((r) => r === b.role);
    if (!role || seen.has(role)) continue;
    seen.add(role);
    const d = byRole.get(role) ?? fallback.blocks[0];
    const style = parseStyle(b, d);
    const hasSub = role === 'dateRow' || role === 'date' || role === 'venue';
    const wording = text(b.text, d.role === role ? d.text : '', 160);
    blocks.push({
      ...style,
      role,
      // A divider is one of a few ornaments, never free text.
      text: role === 'divider' ? ((DIVIDERS as readonly string[]).includes(wording) ? wording : '') : wording,
      gap: num(b.gap, 0, 220, d.gap),
      stack: role === 'names' ? bool(b.stack, d.stack ?? false) : undefined,
      joiner: role === 'names' ? JOINERS.find((j) => j === b.joiner) ?? d.joiner ?? 'amp' : undefined,
      joinerStyle: role === 'names' && (b.joinerStyle || d.joinerStyle) ? parseStyle(b.joinerStyle, d.joinerStyle ?? style) : undefined,
      dateStyle: role === 'date' ? DATE_STYLES.find((x) => x === b.dateStyle) ?? d.dateStyle ?? 'long' : undefined,
      photo: role === 'photo' ? parsePhoto(b.photo, d.photo) : undefined,
      sub: hasSub && (b.sub || d.sub) ? parseStyle(b.sub, d.sub ?? style) : undefined,
    });
  }
  const keep = blocks.length > 0 && seen.has('names');

  // The words need at least a third of the card each way.
  const top = num(area.top, 0.03, 0.6, fallback.textArea.top);
  const bottom = num(area.bottom, 0.03, 0.6, fallback.textArea.bottom);
  const left = num(area.left, 0.03, 0.33, fallback.textArea.left);
  const right = num(area.right, 0.03, 0.33, fallback.textArea.right);
  const fits = 1 - top - bottom >= 0.33;

  return {
    version: 1,
    vibe: text(o.vibe, fallback.vibe, 40),
    format: findFormat(o.format ?? fallback.format).id,
    conceptName: text(o.conceptName, fallback.conceptName, 60),
    palette: {
      ink: hex(palette.ink, fallback.palette.ink),
      accent: hex(palette.accent, fallback.palette.accent),
      paper: hex(palette.paper, fallback.palette.paper),
    },
    art: {
      path: typeof art.path === 'string' && ART_PATH.test(art.path) ? art.path : null,
      sample: typeof art.sample === 'string' && SAMPLE_URL.test(art.sample) ? art.sample : fallback.art.sample,
    },
    textArea: fits ? { top, bottom, left, right } : fallback.textArea,
    align: o.align === 'left' || o.align === 'center' ? o.align : fallback.align ?? 'center',
    blocks: keep ? blocks : fallback.blocks,
  };
}
