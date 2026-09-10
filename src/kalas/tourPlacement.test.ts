import { describe, expect, it } from 'vitest';
import { CARD_W, EDGE, overlapArea, overlaps, placeCard, type Box } from './tourPlacement';

const VIEW = { width: 1440, height: 900 };
const CARD_H = 260;

/** The card must always be on screen, whatever the target does. */
function onScreen(card: { top: number; left: number }, cardH = CARD_H, view = VIEW) {
  return card.left >= EDGE
    && card.left + CARD_W <= view.width - EDGE
    && card.top >= EDGE
    && card.top + cardH <= view.height - EDGE;
}

describe('placeCard', () => {
  it('sits to the right of a nav icon against the left edge', () => {
    const nav: Box = { top: 300, left: 20, width: 44, height: 44 };
    const card = placeCard(nav, CARD_H, VIEW);
    expect(card.left).toBeGreaterThan(nav.left + nav.width);
    expect(overlaps(card, CARD_H, nav)).toBe(false);
  });

  it('drops below a wide banner rather than beside it', () => {
    const hero: Box = { top: 90, left: 140, width: 1100, height: 220 };
    const card = placeCard(hero, CARD_H, VIEW);
    expect(card.top).toBeGreaterThanOrEqual(hero.top + hero.height);
    expect(overlaps(card, CARD_H, hero)).toBe(false);
  });

  it('retreats to an edge over a region that fills the page — the globe', () => {
    /* Roughly what the venue map occupies beside the sidebar: there is no
       384px margin anywhere around it, so some overlap is unavoidable. What
       the card must do is take the least of it and stay on screen — not fall
       into the middle, which is what it used to do. */
    const globe: Box = { top: 250, left: 272, width: 1120, height: 558 };
    const card = placeCard(globe, CARD_H, VIEW);
    expect(onScreen(card)).toBe(true);

    // No other placement covers less of it.
    const alternatives = [
      { left: EDGE, top: EDGE },
      { left: VIEW.width - CARD_W - EDGE, top: EDGE },
      { left: EDGE, top: VIEW.height - CARD_H - EDGE },
      { left: globe.left, top: globe.top },
    ];
    for (const alt of alternatives) {
      expect(overlapArea(card, CARD_H, globe)).toBeLessThanOrEqual(overlapArea(alt, CARD_H, globe));
    }
  });

  it('takes the widest margin when the target leaves room on one side only', () => {
    // Hard against the right: the only real room is to the left.
    const panel: Box = { top: 80, left: 700, width: 720, height: 740 };
    const card = placeCard(panel, CARD_H, VIEW);
    expect(card.left).toBeLessThan(panel.left);
    expect(overlaps(card, CARD_H, panel)).toBe(false);
  });

  it('stays on screen even when the target is larger than the viewport', () => {
    const huge: Box = { top: -200, left: -200, width: 2000, height: 1400 };
    const card = placeCard(huge, CARD_H, VIEW);
    expect(onScreen(card)).toBe(true);
  });

  it('stays on screen for a tall card in a short viewport', () => {
    const view = { width: 1024, height: 620 };
    const nav: Box = { top: 200, left: 20, width: 44, height: 44 };
    const card = placeCard(nav, 560, view);
    expect(onScreen(card, 560, view)).toBe(true);
  });

  it('never lands on the target, across a sweep of shapes and positions', () => {
    const shapes: Box[] = [
      { top: 40, left: 40, width: 44, height: 44 },
      { top: 400, left: 20, width: 44, height: 44 },
      { top: 60, left: 200, width: 1000, height: 160 },
      { top: 500, left: 1200, width: 200, height: 300 },
      { top: 16, left: 16, width: 1408, height: 300 },
    ];
    for (const box of shapes) {
      for (const h of [200, 260, 420]) {
        const card = placeCard(box, h, VIEW);
        expect(onScreen(card, h)).toBe(true);
        // A target that leaves no free margin at all cannot be cleared; every
        // shape here leaves one, so the card must be off it.
        expect(overlaps(card, h, box)).toBe(false);
      }
    }
  });
});
