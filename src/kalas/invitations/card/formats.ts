/* The card's paper. A card is laid out in units: 1000 across, however big
   it is printed, so a size in a design means the same on screen, in the PNG
   and in the Canva file. The image model paints at the nearest ratio it
   supports and the renderers crop to the card. */

export type CardFormatId = '5x7' | '7x5';

export interface CardFormat {
  id: CardFormatId;
  /** Danish source string, shown through t(). */
  label: string;
  widthIn: number;
  heightIn: number;
  /** The image model's closest aspect ratio. */
  artRatio: '3:4' | '4:3';
}

export const CARD_FORMATS: CardFormat[] = [
  { id: '5x7', label: '5×7 stående', widthIn: 5, heightIn: 7, artRatio: '3:4' },
  { id: '7x5', label: '7×5 liggende', widthIn: 7, heightIn: 5, artRatio: '4:3' },
];

export const CARD_UNITS = 1000;

export const findFormat = (id: unknown): CardFormat =>
  CARD_FORMATS.find((f) => f.id === id) ?? CARD_FORMATS[0];

/** The card's height in units (its width is always CARD_UNITS). */
export const cardHeight = (f: CardFormat) => Math.round((CARD_UNITS * f.heightIn) / f.widthIn);

/** Print resolution for the PNG: 300 dpi. */
export const printPixels = (f: CardFormat) => ({ w: f.widthIn * 300, h: f.heightIn * 300 });
