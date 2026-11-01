/* Curated Google-font catalog for AI-designed wedding sites. Juno picks a
   display + body pairing from this allowlist (the generation schema enums
   over the ids), so arbitrary model output can never reach a font-face
   declaration. Fonts load per-site via a fonts.googleapis.com <link> —
   next/font can't vary by DB row, a runtime href can. */

export type FontCategory = 'serif' | 'sans' | 'display' | 'script';

export interface SiteFont {
  id: string;
  family: string;        // exact Google Fonts family name
  weights: number[];     // weights to load
  italics: boolean;      // load italic axis too
  fallback: string;      // CSS fallback stack
  category: FontCategory;
}

export const SITE_FONTS: SiteFont[] = [
  // Serifs — romantic / editorial / classic
  { id: 'cormorant',       family: 'Cormorant Garamond', weights: [400, 500, 600], italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'playfair',        family: 'Playfair Display',   weights: [400, 500, 700], italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'fraunces',        family: 'Fraunces',           weights: [400, 500, 600], italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'libre-caslon',    family: 'Libre Caslon Text',  weights: [400, 700],      italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'dm-serif',        family: 'DM Serif Display',   weights: [400],           italics: true,  fallback: 'Georgia, serif',        category: 'display' },
  { id: 'crimson',         family: 'Crimson Pro',        weights: [400, 500, 600], italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'instrument',      family: 'Instrument Serif',   weights: [400],           italics: true,  fallback: 'Georgia, serif',        category: 'display' },
  { id: 'eb-garamond',     family: 'EB Garamond',        weights: [400, 500, 600], italics: true,  fallback: 'Georgia, serif',        category: 'serif' },
  { id: 'bodoni',          family: 'Bodoni Moda',        weights: [400, 500, 700], italics: true,  fallback: 'Georgia, serif',        category: 'display' },
  // Sans — modern / minimal / warm
  { id: 'inter',           family: 'Inter',              weights: [400, 500, 600], italics: false, fallback: 'system-ui, sans-serif', category: 'sans' },
  { id: 'karla',           family: 'Karla',              weights: [400, 500, 700], italics: true,  fallback: 'system-ui, sans-serif', category: 'sans' },
  { id: 'sora',            family: 'Sora',               weights: [400, 500, 600], italics: false, fallback: 'system-ui, sans-serif', category: 'sans' },
  { id: 'space-grotesk',   family: 'Space Grotesk',      weights: [400, 500, 700], italics: false, fallback: 'system-ui, sans-serif', category: 'sans' },
  { id: 'jost',            family: 'Jost',               weights: [400, 500, 600], italics: true,  fallback: 'system-ui, sans-serif', category: 'sans' },
  { id: 'hanken',          family: 'Hanken Grotesk',     weights: [400, 500, 600], italics: true,  fallback: 'system-ui, sans-serif', category: 'sans' },
  // Script — flourish (display only, never body)
  { id: 'great-vibes',     family: 'Great Vibes',        weights: [400],           italics: false, fallback: 'cursive',               category: 'script' },
];

export const FONT_IDS = SITE_FONTS.map((f) => f.id);

export const findSiteFont = (id: string): SiteFont =>
  SITE_FONTS.find((f) => f.id === id) ?? SITE_FONTS[0];

export const fontStack = (id: string): string => {
  const f = findSiteFont(id);
  return `'${f.family}', ${f.fallback}`;
};

/** css2 URL loading exactly the families a design uses (deduped). */
export function googleFontsHref(fontIds: string[]): string {
  const seen = new Set<string>();
  const params: string[] = [];
  for (const id of fontIds) {
    const f = findSiteFont(id);
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const fam = f.family.replace(/ /g, '+');
    if (f.italics) {
      const tuples = [
        ...f.weights.map((w) => `0,${w}`),
        ...f.weights.map((w) => `1,${w}`),
      ].join(';');
      params.push(`family=${fam}:ital,wght@${tuples}`);
    } else {
      params.push(`family=${fam}:wght@${f.weights.join(';')}`);
    }
  }
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
