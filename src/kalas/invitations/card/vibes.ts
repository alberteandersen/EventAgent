/* The card vibes: stationery styles, not website themes. Each is a palette,
   a set of typefaces and a way of painting, plus a starter design that
   looks finished on its own with the vibe's sample painting. Picking a vibe
   is free and instant; Ava then paints one of their own from it and sets
   their words for it. */

import type { CardFormat, CardFormatId } from './formats';
import type { CardBlock, CardSpec, TextArea, TextStyle } from './spec';
import type { Language } from '../content';

/** Where a vibe's painting sits, which decides where the words can go. */
export type ArtPlacement = 'corners' | 'frame' | 'top' | 'bottom' | 'scattered' | 'texture';

/** How the vibe gallery groups them. Danish source strings, shown through t(). */
export const VIBE_GROUPS = [
  { id: 'painted', label: 'Malet' },
  { id: 'classic', label: 'Klassisk & minimal' },
  { id: 'playful', label: 'Legende' },
  { id: 'photo', label: 'Med foto' },
] as const;
export type VibeGroup = (typeof VIBE_GROUPS)[number]['id'];

export interface CardVibe {
  id: string;
  group: VibeGroup;
  /** Danish source strings, shown through t(). */
  label: string;
  tagline: string;
  palette: CardSpec['palette'];
  placement: ArtPlacement;
  /** Where the words go when the placement's default does not suit this
      painting (its flowers reach further in, its ornaments lower down). */
  area?: { portrait?: TextArea; landscape?: TextArea };
  /** How the image model should paint it (English, for the model). */
  art: string;
  /** Bare paper, never painted: the image model will not leave paper
      alone (it adds stains, dots, stray marks), so these ship a paper made
      by scripts/invite-vibe-art.mts and Ava sets only their type. */
  paper?: boolean;
  /** Flush left, for the vibes drawn that way; centred otherwise. */
  align?: 'center' | 'left';
  /** The vibe's own blocks, when its typography is more than the usual set
      of names, small lines and a date row can say. */
  blocks?: (language: Language) => CardBlock[];
  type: {
    names: Pick<TextStyle, 'font' | 'weight' | 'italic' | 'caps' | 'tracking'> & { size: number; stack: boolean };
    /** Small lines: the eyebrow, the invitation, the venue. */
    small: Pick<TextStyle, 'font' | 'weight' | 'italic' | 'caps' | 'tracking'>;
    /** The big day number in the date row. */
    day: Pick<TextStyle, 'font' | 'weight' | 'italic'>;
    closing: Pick<TextStyle, 'font' | 'weight' | 'italic' | 'caps' | 'tracking'>;
  };
}

/* Building blocks for the vibes that set their own blocks. */

/** A text style: the font and size, anything else as given. */
function style(font: string, size: number, rest: Partial<TextStyle> = {}): TextStyle {
  return { font, size, weight: 400, italic: false, caps: false, lower: false, tracking: 0, color: 'ink', lineHeight: 1.45, ...rest };
}

function block(role: CardBlock['role'], text: string, gap: number, st: TextStyle, extra: Partial<CardBlock> = {}): CardBlock {
  return { ...st, role, text, gap, ...extra };
}

/** The type set of a vibe that brings its own blocks; only Ava's defaults read it. */
const CLASSIC_TYPE: CardVibe['type'] = {
  names: { font: 'cormorant', weight: 400, italic: false, caps: false, tracking: 0, size: 96, stack: false },
  small: { font: 'cormorant', weight: 400, italic: false, caps: true, tracking: 0.16 },
  day: { font: 'cormorant', weight: 300, italic: false },
  closing: { font: 'allura', weight: 400, italic: false, caps: false, tracking: 0 },
};

export const CARD_VIBES: CardVibe[] = [
  {
    id: 'akvarel',
    group: 'painted',
    label: 'Akvarelblomster',
    tagline: 'Hvide anemoner, grønne ranker og en tynd guldramme.',
    palette: { ink: '#6b5040', accent: '#a8834c', paper: '#e9ede6' },
    placement: 'corners',
    area: {
      portrait: { top: 0.25, bottom: 0.2, left: 0.2, right: 0.2 },
      landscape: { top: 0.18, bottom: 0.16, left: 0.27, right: 0.27 },
    },
    art: 'soft loose watercolour: white anemones with dark centres, eucalyptus and fern sprigs and tiny blue forget-me-nots gathered in the top-left and bottom-right corners, a pale sage-grey watercolour wash over the paper, and one thin gold hairline rectangle frame inset from the edge',
    type: {
      names: { font: 'great-vibes', weight: 400, italic: false, caps: false, tracking: 0, size: 112, stack: false },
      small: { font: 'josefin', weight: 300, italic: false, caps: true, tracking: 0.14 },
      day: { font: 'josefin', weight: 300, italic: false },
      closing: { font: 'great-vibes', weight: 400, italic: false, caps: false, tracking: 0 },
    },
  },
  {
    id: 'guld',
    group: 'painted',
    label: 'Guld & elfenben',
    tagline: 'Elfenbenspapir, dobbelt guldkant og klassisk serif.',
    palette: { ink: '#3a342c', accent: '#a8864a', paper: '#f6f1e6' },
    placement: 'frame',
    area: {
      portrait: { top: 0.2, bottom: 0.19, left: 0.18, right: 0.18 },
      landscape: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 },
    },
    art: 'no flowers at all: warm ivory cotton paper with a subtle fibre texture and a fine double gold foil border (two thin parallel rules) inset from the edge, with tiny gold corner flourishes',
    type: {
      names: { font: 'cormorant', weight: 400, italic: true, caps: false, tracking: 0, size: 104, stack: true },
      small: { font: 'cinzel', weight: 400, italic: false, caps: true, tracking: 0.16 },
      day: { font: 'cormorant', weight: 300, italic: false },
      closing: { font: 'cormorant', weight: 400, italic: true, caps: false, tracking: 0 },
    },
  },
  {
    id: 'roser',
    group: 'painted',
    label: 'Romantiske roser',
    tagline: 'Blush-roser der vælter ind fra hjørnerne.',
    palette: { ink: '#5a3a40', accent: '#b56f78', paper: '#f8ecea' },
    placement: 'corners',
    area: { landscape: { top: 0.14, bottom: 0.14, left: 0.3, right: 0.3 } },
    art: 'lush watercolour garden roses and peonies in blush, dusty pink and cream with soft green leaves, cascading in from the top-left corner and the bottom-right corner, on a very pale blush paper with a faint watercolour bloom',
    type: {
      names: { font: 'pinyon', weight: 400, italic: false, caps: false, tracking: 0, size: 108, stack: true },
      small: { font: 'tenor', weight: 400, italic: false, caps: true, tracking: 0.16 },
      day: { font: 'playfair', weight: 400, italic: false },
      closing: { font: 'pinyon', weight: 400, italic: false, caps: false, tracking: 0 },
    },
  },
  {
    id: 'eng',
    group: 'painted',
    label: 'Vilde blomster',
    tagline: 'En eng af valmuer, kornblomster og kamille forneden.',
    palette: { ink: '#3f4a3b', accent: '#c0603f', paper: '#f6f1e5' },
    placement: 'bottom',
    art: 'a loose hand-painted watercolour meadow along the bottom third of the card: red poppies, blue cornflowers, white chamomile, wild grasses and a few butterflies, fading upward into warm cream paper',
    type: {
      names: { font: 'parisienne', weight: 400, italic: false, caps: false, tracking: 0, size: 104, stack: false },
      small: { font: 'montserrat', weight: 400, italic: false, caps: true, tracking: 0.14 },
      day: { font: 'playfair', weight: 400, italic: false },
      closing: { font: 'parisienne', weight: 400, italic: false, caps: false, tracking: 0 },
    },
  },
  {
    id: 'nordisk',
    group: 'painted',
    label: 'Nordisk grønt',
    tagline: 'Eukalyptusgrene i en bue, kølig og enkel.',
    palette: { ink: '#2f3d38', accent: '#6f8f82', paper: '#f2f3ef' },
    placement: 'top',
    art: 'minimal Scandinavian watercolour: a gentle arch of silver-green eucalyptus and olive branches across the top of the card, lots of white space, cool off-white paper, no other flowers',
    type: {
      names: { font: 'cormorant', weight: 400, italic: false, caps: false, tracking: 0.02, size: 100, stack: true },
      small: { font: 'montserrat', weight: 300, italic: false, caps: true, tracking: 0.2 },
      day: { font: 'cormorant', weight: 300, italic: false },
      closing: { font: 'cormorant', weight: 400, italic: true, caps: false, tracking: 0 },
    },
  },
  {
    id: 'midnat',
    group: 'painted',
    label: 'Midnat & guld',
    tagline: 'Dyb natteblå med gyldne stjerner og måne.',
    palette: { ink: '#f1e8d4', accent: '#d2ae62', paper: '#16213a' },
    placement: 'scattered',
    art: 'deep midnight-navy paper with a subtle texture, delicate gold foil celestial line art: a crescent moon, fine constellations and small stars scattered around the edges and corners, thin gold rule border',
    type: {
      names: { font: 'italiana', weight: 400, italic: false, caps: true, tracking: 0.08, size: 96, stack: true },
      small: { font: 'josefin', weight: 300, italic: false, caps: true, tracking: 0.2 },
      day: { font: 'italiana', weight: 400, italic: false },
      closing: { font: 'allura', weight: 400, italic: false, caps: false, tracking: 0 },
    },
  },
  {
    id: 'citron',
    group: 'painted',
    label: 'Middelhav',
    tagline: 'Citroner, blade og blå majolikafliser.',
    palette: { ink: '#22406b', accent: '#c99616', paper: '#fbf8ef' },
    placement: 'frame',
    area: {
      portrait: { top: 0.22, bottom: 0.2, left: 0.18, right: 0.2 },
      landscape: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.22 },
    },
    art: 'Amalfi coast: a border of hand-painted blue and white majolica tiles around the edge, with watercolour lemons and glossy lemon leaves tumbling over the top-right and bottom-left corners, warm white paper',
    type: {
      names: { font: 'playfair', weight: 400, italic: true, caps: false, tracking: 0, size: 96, stack: true },
      small: { font: 'raleway', weight: 400, italic: false, caps: true, tracking: 0.16 },
      day: { font: 'playfair', weight: 400, italic: false },
      closing: { font: 'playfair', weight: 400, italic: true, caps: false, tracking: 0 },
    },
  },
  {
    id: 'letterpress',
    group: 'painted',
    label: 'Letterpress',
    tagline: 'Tykt bomuldspapir, blindpræg og ren typografi.',
    palette: { ink: '#2c2b29', accent: '#8b8578', paper: '#f3f0e8' },
    placement: 'texture',
    art: 'the surface of thick soft white cotton letterpress paper, a gentle even fibre texture filling everything, with a single small blind-debossed (uninked, white-on-white) sprig of olive leaves near the top centre',
    type: {
      names: { font: 'eb-garamond', weight: 400, italic: false, caps: true, tracking: 0.12, size: 80, stack: true },
      small: { font: 'eb-garamond', weight: 400, italic: true, caps: false, tracking: 0.02 },
      day: { font: 'eb-garamond', weight: 400, italic: false },
      closing: { font: 'eb-garamond', weight: 400, italic: true, caps: false, tracking: 0 },
    },
  },
  /* ── Klassisk & minimal ─────────────────────────────────────────────── */
  {
    id: 'medaljon',
    group: 'classic',
    label: 'Medaljon',
    tagline: 'En lille blæktegning af to hjertemedaljoner, ren sort typografi.',
    palette: { ink: '#1d1b19', accent: '#1d1b19', paper: '#ede7e1' },
    placement: 'top',
    area: {
      portrait: { top: 0.3, bottom: 0.08, left: 0.12, right: 0.12 },
      landscape: { top: 0.4, bottom: 0.06, left: 0.2, right: 0.2 },
    },
    art: 'minimal: one small black-ink fine pen line drawing centred near the top, of two heart-shaped lockets, one of them open, hanging from a ribbon tied in a bow, drawn in elegant thin lines with no fill, no shading and no colour, the lockets blank inside; everything else is plain warm cream paper with the faintest texture',
    blocks: (lang) => [
      block('invite', lang === 'da' ? 'Du inviteres hermed til\nvores bryllup' : 'You are invited\nto our wedding', 0, style('cormorant', 25, { weight: 500, caps: true, tracking: 0.22, lineHeight: 1.75 })),
      block('names', '', 34, style('pinyon', 116, { lineHeight: 1.15 }), { joiner: 'plus' }),
      block('date', '', 40, style('cormorant', 27, { weight: 500, caps: true, tracking: 0.2 }), {
        dateStyle: 'short', sub: style('cormorant', 24, { lower: true, tracking: 0.14 }),
      }),
      block('venue', '', 40, style('cormorant', 26, { weight: 500, caps: true, tracking: 0.2 }), {
        sub: style('cormorant', 24, { lower: true, tracking: 0.16, lineHeight: 1.6 }),
      }),
      block('divider', '', 40, style('cormorant', 34)),
      block('closing', lang === 'da' ? 'vi glæder os til at se jer' : 'we cannot wait to see you', 34, style('allura', 44)),
      block('rsvp', '', 20, style('cormorant', 20, { italic: true, tracking: 0.04 })),
    ],
    type: CLASSIC_TYPE,
  },
  {
    id: 'ren',
    group: 'classic',
    label: 'Ren typografi',
    tagline: 'Hvidt bomuldspapir, store spærrede navne og et håndskrevet “og”.',
    palette: { ink: '#1b1b1a', accent: '#1b1b1a', paper: '#f6f5f1' },
    placement: 'texture',
    paper: true,
    area: {
      portrait: { top: 0.13, bottom: 0.11, left: 0.1, right: 0.1 },
      landscape: { top: 0.12, bottom: 0.1, left: 0.14, right: 0.14 },
    },
    art: 'nothing but the surface of soft bright-white cotton paper, a fine even felt texture filling everything, with nothing printed or painted on it',
    blocks: (lang) => [
      block('eyebrow', lang === 'da' ? 'Sammen med deres familier' : 'Together with their families', 0, style('cormorant', 30, { italic: true, tracking: 0.04 })),
      block('names', '', 44, style('cormorant', 96, { weight: 500, caps: true, tracking: 0.16, lineHeight: 1.12 }), {
        stack: true, joiner: 'word', joinerStyle: style('great-vibes', 60, { lower: true, lineHeight: 1 }),
      }),
      block('invite', lang === 'da' ? 'inviterer jer til at fejre\nderes bryllup' : 'joyfully invite you to the\ncelebration of their wedding', 40, style('cormorant', 30, { italic: true, lineHeight: 1.6 })),
      block('date', '', 44, style('cormorant', 38, { weight: 500, caps: true, tracking: 0.08 }), {
        sub: style('cormorant', 22, { weight: 500, caps: true, tracking: 0.14, lineHeight: 1.7 }),
      }),
      block('venue', '', 20, style('cormorant', 22, { weight: 500, caps: true, tracking: 0.14, lineHeight: 1.6 })),
      block('note', '', 24, style('cormorant', 23, { italic: true })),
      block('closing', lang === 'da' ? 'vi glæder os til at se jer' : 'we cannot wait to see you', 44, style('allura', 48)),
      block('rsvp', '', 20, style('cormorant', 20, { italic: true, tracking: 0.04 })),
    ],
    type: CLASSIC_TYPE,
  },
  {
    id: 'valmue',
    group: 'classic',
    label: 'Valmue',
    tagline: 'En fin stregtegnet valmue, tynde hjørnelinjer og venstrestillet tekst.',
    palette: { ink: '#2b2926', accent: '#2b2926', paper: '#f1eeea' },
    placement: 'corners',
    align: 'left',
    area: {
      portrait: { top: 0.3, bottom: 0.12, left: 0.14, right: 0.2 },
      landscape: { top: 0.16, bottom: 0.14, left: 0.1, right: 0.44 },
    },
    art: 'minimal fine-line botanical: an elegant black-ink line drawing of two poppy flowers and a bud on long curving stems, in the top-right corner and reaching down the right-hand side, with no fill and no colour; plus two thin straight corner brackets, one at the top-left (a short horizontal and a short vertical line meeting at the corner) and one at the bottom-right; warm off-white paper, everything else empty',
    blocks: (lang) => [
      block('names', '', 0, style('italiana', 104, { caps: true, tracking: 0.06, lineHeight: 1.08 }), {
        stack: true, joiner: 'word', joinerStyle: style('allura', 58, { lower: true, lineHeight: 1 }),
      }),
      block('invite', lang === 'da' ? 'har den glæde at invitere jer\ntil deres bryllup' : 'request the pleasure of your company\nat their wedding celebration', 52, style('montserrat', 20, { caps: true, tracking: 0.12, lineHeight: 1.9 })),
      block('date', '', 40, style('montserrat', 27, { caps: true, tracking: 0.1 }), {
        dateStyle: 'short', sub: style('montserrat', 20, { caps: true, tracking: 0.12, lineHeight: 1.8 }),
      }),
      block('venue', '', 14, style('montserrat', 20, { caps: true, tracking: 0.1, lineHeight: 1.8 })),
      block('closing', lang === 'da' ? 'Vi glæder os til at se jer' : 'We cannot wait to see you', 52, style('allura', 46)),
      block('rsvp', '', 16, style('montserrat', 17, { caps: true, tracking: 0.12 })),
    ],
    type: CLASSIC_TYPE,
  },

  /* ── Legende ────────────────────────────────────────────────────────── */
  {
    id: 'fest',
    group: 'playful',
    label: 'Håndtegnet fest',
    tagline: 'Koboltblå tegninger af kage, vin og hjerter, alt med små bogstaver.',
    palette: { ink: '#2150a3', accent: '#2150a3', paper: '#ebe5da' },
    placement: 'top',
    area: {
      portrait: { top: 0.36, bottom: 0.07, left: 0.12, right: 0.12 },
      landscape: { top: 0.38, bottom: 0.06, left: 0.2, right: 0.2 },
    },
    art: 'playful hand-drawn illustrations in a single cobalt-blue ink, loose confident pen lines with a little flat blue fill, arranged in a row across the upper third: a tiered wedding cake with a ribbon bow on a cake stand in the middle, a slice of cake on a plate, a spoon and fork, a wine bottle, a wine glass, a corkscrew, and small hearts floating around them; warm cream paper, the lower two-thirds empty',
    blocks: (lang) => [
      block('eyebrow', lang === 'da' ? 'vi skal giftes!' : "we're getting married!", 0, style('sacramento', 62, { lower: true, color: 'accent', lineHeight: 1.2 })),
      block('invite', lang === 'da' ? 'du inviteres hermed til\nvores bryllup' : 'you are invited to\nour wedding', 20, style('quicksand', 27, { lower: true, tracking: 0.1, lineHeight: 1.6 })),
      block('names', '', 22, style('sacramento', 92, { lower: true, lineHeight: 1.15 }), { joiner: 'word' }),
      block('date', '', 28, style('quicksand', 27, { lower: true, tracking: 0.1, lineHeight: 1.6 }), { dateStyle: 'short' }),
      block('venue', '', 22, style('quicksand', 27, { lower: true, tracking: 0.1, lineHeight: 1.6 })),
      block('divider', '♥ ♥', 24, style('quicksand', 30, { tracking: 0.2, color: 'accent' })),
      block('closing', lang === 'da' ? 'vi glæder os til at se jer' : 'we cannot wait to see you', 20, style('sacramento', 52, { lower: true })),
      block('rsvp', '', 16, style('quicksand', 20, { lower: true, tracking: 0.08 })),
    ],
    type: CLASSIC_TYPE,
  },
  {
    id: 'bolge',
    group: 'playful',
    label: 'Bølgeramme',
    tagline: 'Grønne tegninger langs siden, en bølget ramme og datoen i tal.',
    palette: { ink: '#3b5e2b', accent: '#3b5e2b', paper: '#ece6d6' },
    placement: 'frame',
    area: {
      portrait: { top: 0.14, bottom: 0.13, left: 0.43, right: 0.1 },
      landscape: { top: 0.14, bottom: 0.14, left: 0.42, right: 0.1 },
    },
    art: 'hand-drawn in a single deep-green ink with loose pen lines: a thin wavy, scalloped line border running around the whole card a little in from the edge, and inside it, down the left third only, three small doodles stacked one above the other: two lovebirds holding a heart at the top, a tiered wedding cake with a few flowers in the middle, and two clinking champagne glasses at the bottom; cream paper; the right two-thirds inside the border stay completely empty',
    blocks: (lang) => [
      block('eyebrow', lang === 'da' ? 'I er inviteret til\nbrylluppet mellem' : "You're invited to\nthe wedding of", 0, style('quicksand', 25, { weight: 500, caps: true, tracking: 0.06, lineHeight: 1.5 })),
      block('names', '', 24, style('sacramento', 118, { lineHeight: 1.02 }), {
        stack: true, joiner: 'plus', joinerStyle: style('quicksand', 40, { lineHeight: 1 }),
      }),
      block('date', '', 36, style('quicksand', 72, { weight: 300, lineHeight: 1.1 }), {
        dateStyle: 'numeric', sub: style('quicksand', 22, { weight: 500, caps: true, tracking: 0.06, lineHeight: 1.6 }),
      }),
      block('venue', '', 28, style('quicksand', 22, { weight: 500, caps: true, tracking: 0.06, lineHeight: 1.6 })),
      block('closing', lang === 'da' ? 'vi glæder os til at se jer' : 'we cannot wait to see you', 26, style('sacramento', 44)),
      block('rsvp', '', 14, style('quicksand', 17, { weight: 500, caps: true, tracking: 0.06 })),
    ],
    type: CLASSIC_TYPE,
  },

  /* ── Med foto ───────────────────────────────────────────────────────── */
  {
    id: 'foto',
    group: 'photo',
    label: 'Save the date med foto',
    tagline: 'Jeres eget billede i sort-hvid, sat fast med tape.',
    palette: { ink: '#262523', accent: '#262523', paper: '#e4e2de' },
    placement: 'texture',
    paper: true,
    area: {
      portrait: { top: 0.09, bottom: 0.08, left: 0.14, right: 0.14 },
      landscape: { top: 0.08, bottom: 0.08, left: 0.26, right: 0.26 },
    },
    art: 'nothing but plain soft light warm-grey paper with a very subtle fine texture, nothing printed or painted on it',
    blocks: (lang) => [
      block('eyebrow', 'save the date', 0, style('allura', 76, { lower: true, lineHeight: 1.2 })),
      block('photo', '', 26, style('montserrat', 20), { photo: { width: 0.82, aspect: 1.08, tone: 'bw', tape: true } }),
      block('date', '', 34, style('playfair', 40, { italic: true, tracking: -0.01, lineHeight: 1.3 }), {
        dateStyle: 'short', sub: style('montserrat', 17, { weight: 500, caps: true, tracking: 0.06, lineHeight: 1.6 }),
      }),
      block('names', '', 18, style('montserrat', 22, { weight: 500, caps: true, tracking: 0.04, lineHeight: 1.4 })),
      block('invite', lang === 'da' ? 'skal giftes' : 'are getting married', 2, style('montserrat', 20, { weight: 500, caps: true, tracking: 0.04, lineHeight: 1.4 })),
      block('venue', '', 22, style('montserrat', 17, { caps: true, tracking: 0.08, lineHeight: 1.6 })),
      block('closing', lang === 'da' ? 'invitation følger' : 'invitation to follow', 24, style('allura', 40)),
    ],
    type: CLASSIC_TYPE,
  },
];

export const findVibe = (id: unknown): CardVibe => CARD_VIBES.find((v) => v.id === id) ?? CARD_VIBES[0];

/** Where the words go for a painting placed this way. */
export function textAreaFor(vibe: CardVibe, format: CardFormat): TextArea {
  const land = format.widthIn > format.heightIn;
  const own = land ? vibe.area?.landscape : vibe.area?.portrait;
  if (own) return own;
  switch (vibe.placement) {
    case 'top': return land ? { top: 0.3, bottom: 0.08, left: 0.14, right: 0.14 } : { top: 0.3, bottom: 0.07, left: 0.12, right: 0.12 };
    case 'bottom': return land ? { top: 0.08, bottom: 0.38, left: 0.14, right: 0.14 } : { top: 0.08, bottom: 0.38, left: 0.12, right: 0.12 };
    // Flowers in the corners reach well in; the words start below them.
    case 'corners': return land ? { top: 0.16, bottom: 0.14, left: 0.28, right: 0.28 } : { top: 0.2, bottom: 0.2, left: 0.16, right: 0.16 };
    // Ornamented frames are heaviest in the corners, so the words keep clear top and bottom.
    case 'frame': return land ? { top: 0.17, bottom: 0.16, left: 0.16, right: 0.16 } : { top: 0.15, bottom: 0.14, left: 0.16, right: 0.16 };
    case 'scattered': return land ? { top: 0.15, bottom: 0.15, left: 0.18, right: 0.18 } : { top: 0.13, bottom: 0.13, left: 0.16, right: 0.16 };
    case 'texture': return land ? { top: 0.14, bottom: 0.12, left: 0.12, right: 0.12 } : { top: 0.14, bottom: 0.1, left: 0.12, right: 0.12 };
  }
}

const WORDING: Record<Language, Record<'eyebrow' | 'invite' | 'closing', string>> = {
  da: { eyebrow: 'Sammen med deres familier', invite: 'inviterer jer til at fejre\ndagen, hvor de siger ja', closing: 'Vi glæder os til at se jer' },
  en: { eyebrow: 'Together with their families', invite: 'invite you to join their\nwedding celebration', closing: 'We can’t wait to celebrate with you' },
};

/** The vibe's own design, before Ava: a sample painting and set wording. */
export function starterSpec(vibe: CardVibe, format: CardFormat, language: Language): CardSpec {
  const { type, palette } = vibe;
  const small = (size: number, color: TextStyle['color'] = 'ink'): TextStyle => ({ ...type.small, size, color, lineHeight: 1.45 });
  const words = WORDING[language];
  const blocks: CardBlock[] = vibe.blocks?.(language) ?? [
    { ...small(26), role: 'eyebrow', text: words.eyebrow, gap: 0 },
    { ...type.names, color: 'ink', lineHeight: 1.1, role: 'names', text: '', gap: 34 },
    { ...small(26), role: 'invite', text: words.invite, gap: 30 },
    {
      ...type.day, size: 110, caps: false, tracking: 0, color: 'ink', lineHeight: 1,
      role: 'dateRow', text: '', gap: 46, sub: small(25),
    },
    { ...small(25), role: 'venue', text: '', gap: 46 },
    { ...small(23), caps: false, tracking: 0.02, role: 'note', text: '', gap: 26 },
    { ...type.closing, size: type.closing.caps ? 26 : 50, color: 'accent', lineHeight: 1.2, role: 'closing', text: words.closing, gap: 34 },
    { ...small(20, 'accent'), role: 'rsvp', text: '', gap: 22 },
  ];
  return {
    version: 1,
    vibe: vibe.id,
    format: format.id,
    conceptName: vibe.label,
    palette,
    art: { path: null, sample: sampleArt(vibe.id, format.id) },
    textArea: textAreaFor(vibe, format),
    align: vibe.align ?? 'center',
    blocks,
  };
}

/** The sample painting that ships with the app for a vibe and format. */
export const sampleArt = (vibeId: string, format: CardFormatId) => `/invitations/vibes/${vibeId}-${format}.webp`;
