/* How close the seating canvas looks, kept out of the screen so it can be
 * tested: the stops, stepping between them, and the one that shows the whole
 * plan after something new has been put on it.
 */

import { tableBounds, type SeatingPlan } from './model';

/* 50% is where the plan opens, not where it stops — a room with a dozen
   tables needs to get further away than the default. */
export const ZOOMS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.5];

/* The plan opens zoomed out. A seating chart is read as a room before it is
   read as a list of names, at 100% you are nose-to-nose with two tables and
   have to scroll to find out how many there are. */
export const DEFAULT_ZOOM = 0.5;

/* Step to the next zoom stop.
 *
 * Deliberately by nearest value rather than indexOf: a zoom that is not
 * exactly one of the stops made indexOf return -1, and `-1 - 1` clamped to 0 —
 * so one press of the minus button jumped straight from wherever you were to
 * 50%. Nearest-stop stepping cannot do that whatever the current value is. */
export function stepZoom(current: number, dir: 1 | -1): number {
  let nearest = 0;
  for (let i = 1; i < ZOOMS.length; i++) {
    if (Math.abs(ZOOMS[i] - current) < Math.abs(ZOOMS[nearest] - current)) nearest = i;
  }
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, nearest + dir))];
}

/** Room left around the outermost table when fitting, in plan units. */
const FIT_MARGIN = 40;

/** How far right and down the plan's furniture reaches, chairs and labels included. */
export function planExtent(plan: SeatingPlan): { right: number; bottom: number } {
  let right = 0;
  let bottom = 0;
  for (const t of plan.tables) {
    const b = tableBounds(t);
    right = Math.max(right, t.x + b.w / 2);
    bottom = Math.max(bottom, t.y + b.h / 2);
  }
  for (const e of plan.elements ?? []) {
    right = Math.max(right, e.x + e.w / 2);
    bottom = Math.max(bottom, e.y + e.h / 2);
  }
  return { right, bottom };
}

/**
 * The zoom that shows everything on the plan inside the canvas.
 *
 * Only ever the current zoom or further out: putting a table on the plan
 * should never pull the camera closer than the couple left it, and a plan
 * that already fits keeps its zoom. When not even the furthest stop fits, it
 * stops there and the canvas scrolls instead.
 */
export function fitZoom(
  content: { right: number; bottom: number },
  viewport: { w: number; h: number },
  current: number,
): number {
  const w = content.right + FIT_MARGIN;
  const h = content.bottom + FIT_MARGIN;
  const fits = (z: number) => w * z <= viewport.w && h * z <= viewport.h;
  if (fits(current)) return current;
  const candidates = ZOOMS.filter((z) => z < current).reverse();
  return candidates.find(fits) ?? ZOOMS[0];
}
