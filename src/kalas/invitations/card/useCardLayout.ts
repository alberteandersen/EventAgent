'use client';

/* The card set in the browser: loads the design's fonts, then lays the card
   out with canvas text metrics, so the preview and the exports measure with
   the faces they draw with. Until the fonts are in, the layout is null and
   the card shows only its paper and painting. */

import { useEffect, useMemo, useState } from 'react';
import { cardFontsHref, findCardFont, nearestWeight } from './fonts';
import { layoutCard, type CardLayout, type CardWording, type Measure } from './layout';
import type { CardSpec } from './spec';
import type { InviteContent } from '../content';

let ctx: CanvasRenderingContext2D | null = null;

/** canvas measureText, measured large for precision and scaled down. */
export const canvasMeasure: Measure = (text, f) => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * f.size * 0.5;
  ctx.font = `${f.italic ? 'italic ' : ''}${f.weight} 100px "${f.family}", serif`;
  return (ctx.measureText(text).width * f.size) / 100;
};

/** The font faces a design uses, as CSS font shorthands. */
function faces(spec: CardSpec): string[] {
  const out = new Set<string>();
  for (const b of spec.blocks) {
    for (const st of [b, b.sub].filter(Boolean) as { font: string; weight: number; italic: boolean }[]) {
      const f = findCardFont(st.font);
      out.add(`${st.italic && f.italics ? 'italic ' : ''}${nearestWeight(f, st.weight)} 40px "${f.family}"`);
    }
  }
  return [...out];
}

/** Adds the design's stylesheet once and resolves when its faces are usable. */
export async function loadCardFonts(spec: CardSpec): Promise<void> {
  const href = cardFontsHref(spec.blocks.flatMap((b) => [b.font, b.sub?.font].filter(Boolean) as string[]));
  if (!document.querySelector(`link[data-card-fonts="${CSS.escape(href)}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.cardFonts = href;
    document.head.appendChild(link);
    await new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; });
  }
  await Promise.all(faces(spec).map((f) => document.fonts.load(f).catch(() => [])));
}

export function useCardLayout(spec: CardSpec, content: InviteContent, wording?: CardWording): CardLayout | null {
  const fontKey = useMemo(() => faces(spec).join('|'), [spec]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCardFonts(spec).then(() => { if (alive) setLoadedKey(fontKey); });
    return () => { alive = false; };
    // Only a change of faces needs another load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  return useMemo(
    () => (loadedKey === fontKey ? layoutCard(spec, content, canvasMeasure, wording) : null),
    [loadedKey, fontKey, spec, content, wording],
  );
}
