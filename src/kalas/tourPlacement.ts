/* Where the tour card sits, given what it is pointing at.
 *
 * Pulled out of GuidedTour so the geometry can be proven rather than clicked
 * at — this is where the card ended up covering the very thing the step had
 * just told the couple to look at.
 *
 * Two things were wrong. The width it measured against (340) was not the
 * width it drew (352), so a side could "fit" and still overhang by 12px. And
 * every candidate sat flush against the target, which works for a 40px nav
 * icon and cannot work for a region that fills the middle of the screen —
 * there is no edge to sit beside, so it fell back to the bottom-right corner,
 * on top of the content.
 */

export type Box = { top: number; left: number; width: number; height: number };

export type Viewport = { width: number; height: number };

/** Matches `lg:w-[352px]` on the card itself. */
export const CARD_W = 352;
/** Breathing room between the card and the thing it points at. */
export const GAP = 18;
/** Minimum margin to the viewport edge. */
export const EDGE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/**
 * The card's top-left, in viewport coordinates.
 *
 * Beside the target when there is room for that, since sitting next to a small
 * control reads as pointing at it. Otherwise in whichever margin around the
 * target is widest — for a big region that is the honest answer: get out of
 * its way entirely rather than pretend to sit beside it.
 */
export function placeCard(box: Box, cardH: number, viewport: Viewport): { top: number; left: number } {
  const { width: vw, height: vh } = viewport;
  const clampX = (x: number) => clamp(x, EDGE, Math.max(EDGE, vw - CARD_W - EDGE));
  const clampY = (y: number) => clamp(y, EDGE, Math.max(EDGE, vh - cardH - EDGE));

  /* Beside the target first, in the order that reads best, then flush to each
     viewport edge. Every candidate is clamped on screen, and the one that
     covers the least of the target wins — so a small control gets a card
     sitting neatly beside it, and a region that fills the page gets one
     retreating as far into a corner as the screen allows. Ties go to the
     earlier candidate, which is why the "beside" placements come first. */
  const candidates = [
    { left: box.left + box.width + GAP, top: box.top },
    { left: box.left, top: box.top + box.height + GAP },
    { left: box.left, top: box.top - cardH - GAP },
    { left: box.left - CARD_W - GAP, top: box.top },
    { left: vw - CARD_W - EDGE, top: box.top },
    { left: EDGE, top: box.top },
    { left: box.left, top: vh - cardH - EDGE },
    { left: box.left, top: EDGE },
    // The corners. For a region that fills the page these are the only places
    // that clip a mere edge of it rather than a whole band.
    { left: EDGE, top: EDGE },
    { left: vw - CARD_W - EDGE, top: EDGE },
    { left: EDGE, top: vh - cardH - EDGE },
    { left: vw - CARD_W - EDGE, top: vh - cardH - EDGE },
  ].map((c) => ({ left: clampX(c.left), top: clampY(c.top) }));

  let best = candidates[0];
  let bestArea = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const area = overlapArea(c, cardH, box);
    if (area < bestArea) { best = c; bestArea = area; }
    if (area === 0) break;
  }
  return best;
}

/** How much of the target the card would cover, in square pixels. */
export function overlapArea(card: { top: number; left: number }, cardH: number, box: Box): number {
  const w = Math.min(card.left + CARD_W, box.left + box.width) - Math.max(card.left, box.left);
  const h = Math.min(card.top + cardH, box.top + box.height) - Math.max(card.top, box.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** True when the card would land on top of the thing it points at. The tests
 *  assert this never happens; kept exported because it is the whole point. */
export function overlaps(card: { top: number; left: number }, cardH: number, box: Box): boolean {
  return card.left < box.left + box.width
    && card.left + CARD_W > box.left
    && card.top < box.top + box.height
    && card.top + cardH > box.top;
}
