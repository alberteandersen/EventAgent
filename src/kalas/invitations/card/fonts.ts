/* The typefaces a card may use. All are Google Fonts that Canva also has, so
   a card opened in Canva keeps its type instead of falling back. Ava picks
   from these ids only (the spec parser drops anything else). */

export type CardFontCategory = 'script' | 'serif' | 'sans';

export interface CardFont {
  id: string;
  family: string;
  category: CardFontCategory;
  weights: number[];
  italics: boolean;
}

export const CARD_FONTS: CardFont[] = [
  { id: 'great-vibes', family: 'Great Vibes', category: 'script', weights: [400], italics: false },
  { id: 'pinyon', family: 'Pinyon Script', category: 'script', weights: [400], italics: false },
  { id: 'parisienne', family: 'Parisienne', category: 'script', weights: [400], italics: false },
  { id: 'allura', family: 'Allura', category: 'script', weights: [400], italics: false },
  { id: 'italianno', family: 'Italianno', category: 'script', weights: [400], italics: false },
  { id: 'sacramento', family: 'Sacramento', category: 'script', weights: [400], italics: false },
  { id: 'cormorant', family: 'Cormorant Garamond', category: 'serif', weights: [300, 400, 500, 600], italics: true },
  { id: 'playfair', family: 'Playfair Display', category: 'serif', weights: [400, 500, 600], italics: true },
  { id: 'eb-garamond', family: 'EB Garamond', category: 'serif', weights: [400, 500], italics: true },
  { id: 'cinzel', family: 'Cinzel', category: 'serif', weights: [400, 500], italics: false },
  { id: 'italiana', family: 'Italiana', category: 'serif', weights: [400], italics: false },
  { id: 'montserrat', family: 'Montserrat', category: 'sans', weights: [300, 400, 500], italics: false },
  { id: 'josefin', family: 'Josefin Sans', category: 'sans', weights: [300, 400], italics: false },
  { id: 'tenor', family: 'Tenor Sans', category: 'sans', weights: [400], italics: false },
  { id: 'raleway', family: 'Raleway', category: 'sans', weights: [300, 400, 500], italics: false },
  { id: 'quicksand', family: 'Quicksand', category: 'sans', weights: [300, 400, 500], italics: false },
];

export const CARD_FONT_IDS = CARD_FONTS.map((f) => f.id);

const FALLBACK = CARD_FONTS.find((f) => f.id === 'cormorant')!;

export const findCardFont = (id: string): CardFont =>
  CARD_FONTS.find((f) => f.id === id) ?? FALLBACK;

/** The nearest weight the font has, so a request for 600 in a 400-only
    script does not ask the browser to fake bold. */
export function nearestWeight(font: CardFont, weight: number): number {
  return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), font.weights[0]);
}

/** One stylesheet for the families a card uses. */
export function cardFontsHref(ids: string[]): string {
  const seen = new Set<string>();
  const params: string[] = [];
  for (const id of ids) {
    const f = findCardFont(id);
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const fam = f.family.replace(/ /g, '+');
    params.push(f.italics
      ? `family=${fam}:ital,wght@${[...f.weights.map((w) => `0,${w}`), ...f.weights.map((w) => `1,${w}`)].join(';')}`
      : `family=${fam}:wght@${f.weights.join(';')}`);
  }
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
