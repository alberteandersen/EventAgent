/* Where something new goes on the seating plan. A new table or dance floor
 * lands in empty space the couple can already see, so the view stays where
 * they left it. Only when the visible frame has no room for it does it go
 * past the edge, and then the canvas zooms out to show it (fitZoom).
 */

import { tableBounds, type SeatingPlan } from './model';

/** A box in plan units, by its top-left corner. */
export interface Frame { x: number; y: number; w: number; h: number }

/** Clear space kept around a new piece: room for chairs to be reached and a
 *  name label to be read. */
const GAP = 40;
/** How finely the frame is searched, in plan units. */
const STEP = 20;

/** Everything already on the floor, chairs and labels included. */
export function occupied(plan: SeatingPlan): Frame[] {
  return [
    ...plan.tables.map((t) => {
      const b = tableBounds(t);
      return { x: t.x - b.w / 2, y: t.y - b.h / 2, w: b.w, h: b.h };
    }),
    ...(plan.elements ?? []).map((e) => ({ x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h })),
  ];
}

const overlaps = (a: Frame, b: Frame) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The centre of the first free place for a piece of `size` inside `frame`,
 * reading left to right, top to bottom, keeping GAP clear of everything
 * already there and of the frame's edges. Null when there is none.
 */
export function findFreeSpot(
  plan: SeatingPlan,
  size: { w: number; h: number },
  frame: Frame,
): { x: number; y: number } | null {
  const taken = occupied(plan);
  const left = Math.max(0, frame.x) + GAP;
  const top = Math.max(0, frame.y) + GAP;
  const right = frame.x + frame.w - GAP - size.w;
  const bottom = frame.y + frame.h - GAP - size.h;
  for (let y = top; y <= bottom; y += STEP) {
    for (let x = left; x <= right; x += STEP) {
      const box = { x: x - GAP, y: y - GAP, w: size.w + GAP * 2, h: size.h + GAP * 2 };
      if (!taken.some((o) => overlaps(box, o))) return { x: x + size.w / 2, y: y + size.h / 2 };
    }
  }
  return null;
}
