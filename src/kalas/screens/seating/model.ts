/* The seating plan: tables on a canvas, and a named chair for every guest.
 *
 * The old plan gave each table a bag of guest ids. That is enough to answer
 * "who is at table 4" and nothing else — not who sits next to whom, not which
 * chairs are still free, and not the one thing a venue actually asks for,
 * which is a drawing. Here a table has SEATS, an ordered array with one slot
 * per chair, and `null` is an empty chair rather than a missing guest.
 *
 * Everything in this file is pure: geometry, moves and the migration off the
 * old shape. The screen keeps no seating logic of its own, so a swap can be
 * tested without a browser.
 */

export type TableShape = 'round' | 'rect' | 'head';

/** A guest as the plan needs them: a name, a colour group, and the two flags
 *  a printed chart has to carry. Kept free of the database row so the seating
 *  logic stays testable on plain objects. */
export interface PlanGuest {
  id: string;
  name: string;
  group: string;
  dietary: string | null;
  /** False for a declined RSVP — they keep their chair but are drawn faded. */
  attending: boolean;
}

/** Two letters for a chair. "Anne-Marie Bo" → "AB", "Grandma" → "GR". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name under a chair, short enough not to collide with its neighbours. */
export function seatLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

export interface SeatingTable {
  id: string;
  name: string;
  shape: TableShape;
  seats: number;
  /** Canvas position of the table's centre, in plan units. */
  x: number;
  y: number;
  /** One slot per chair, clockwise from the top. `null` is an empty chair. */
  seated: (string | null)[];
}

export interface SeatingPlan {
  version: 2;
  tables: SeatingTable[];
  /** Everything on the floor that is not a table. Optional, so every plan
   *  saved before it existed still reads as a version 2 plan. */
  elements?: FloorElement[];
}

/* ── The rest of the room ─────────────────────────────────────────────────
   A venue's floor plan is not only tables: the dance floor decides where the
   top table goes, and nobody wants to sit with their back to the buffet.
   These carry no chairs and no guests, only a name, a place and a size. */

export type FloorElementKind =
  | 'dansegulv' | 'dj' | 'buffet' | 'kage' | 'bar' | 'gaver' | 'scene' | 'fotoboks' | 'indgang';

export interface FloorElement {
  id: string;
  kind: FloorElementKind;
  label: string;
  /** Canvas position of the centre and the footprint, in plan units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Order is the order of the "Mere" menu; w/h is the medium size. */
export const ELEMENTS: { id: FloorElementKind; label: string; w: number; h: number }[] = [
  { id: 'dansegulv', label: 'Dansegulv', w: 260, h: 200 },
  { id: 'dj', label: 'DJ / band', w: 180, h: 90 },
  { id: 'buffet', label: 'Madbord', w: 260, h: 80 },
  { id: 'kage', label: 'Kagebord', w: 120, h: 120 },
  { id: 'bar', label: 'Bar', w: 200, h: 80 },
  { id: 'gaver', label: 'Gavebord', w: 160, h: 80 },
  { id: 'scene', label: 'Scene', w: 280, h: 120 },
  { id: 'fotoboks', label: 'Fotoboks', w: 120, h: 120 },
  { id: 'indgang', label: 'Indgang', w: 140, h: 56 },
];

export type ElementSize = 'S' | 'M' | 'L';
export const ELEMENT_SIZES: { id: ElementSize; scale: number }[] = [
  { id: 'S', scale: 0.7 },
  { id: 'M', scale: 1 },
  { id: 'L', scale: 1.4 },
];

/** A chair's offset from its table's centre, and which way the guest faces. */
export interface SeatPoint {
  x: number;
  y: number;
  /** Degrees, 0 = facing right. Used to push the name label outwards. */
  angle: number;
}

export const SHAPES: { id: TableShape; label: string; seats: number; hint: string }[] = [
  { id: 'round', label: 'Rundt bord', seats: 8, hint: 'Typisk 6–12 gæster' },
  { id: 'rect', label: 'Langbord', seats: 12, hint: 'Typisk 8–24 gæster' },
  // NOT "Bordplan" — that is the name of this whole screen, and a button
  // reading "+ Bordplan" inside the bordplan says nothing at all.
  { id: 'head', label: 'Brudebord', seats: 8, hint: 'Til brudeparret og de nærmeste' },
];

export const MIN_SEATS = 2;
export const MAX_SEATS = 30;

/* Chair spacing along an edge, and the radius of a chair dot. The pitch is
   set by the NAME under each chair rather than the chair itself: eight chairs
   in a row is legible at any spacing, and eight first names is not. */
const PITCH = 58;
export const SEAT_R = 15;

/** How big the table's own body is, in plan units. */
export function tableSize(shape: TableShape, seats: number): { w: number; h: number } {
  const n = Math.max(MIN_SEATS, seats);
  if (shape === 'round') {
    const d = Math.max(120, (n * PITCH) / Math.PI - 40);
    return { w: d, h: d };
  }
  if (shape === 'head') {
    return { w: Math.max(200, n * PITCH), h: 78 };
  }
  const perSide = Math.ceil(n / 2);
  return { w: Math.max(200, perSide * PITCH), h: 96 };
}

/**
 * Where each chair sits relative to the table's centre.
 *
 * Round tables run clockwise from twelve o'clock. Long tables fill the top
 * edge left-to-right and then the bottom edge, so seat 1 and the seat opposite
 * it are a predictable distance apart in the array. A top table seats everyone
 * along one side, facing the room — which is the whole point of a top table.
 */
export function seatPoints(shape: TableShape, seats: number): SeatPoint[] {
  const n = Math.max(MIN_SEATS, seats);
  const { w, h } = tableSize(shape, n);

  if (shape === 'round') {
    const r = w / 2 + 30;
    return Array.from({ length: n }, (_, i) => {
      const deg = (360 / n) * i - 90;
      const rad = (deg * Math.PI) / 180;
      return { x: Math.cos(rad) * r, y: Math.sin(rad) * r, angle: deg };
    });
  }

  if (shape === 'head') {
    const gap = w / n;
    return Array.from({ length: n }, (_, i) => ({
      x: -w / 2 + gap * (i + 0.5),
      y: -h / 2 - 30,
      angle: -90,
    }));
  }

  const top = Math.ceil(n / 2);
  const bottom = n - top;
  const out: SeatPoint[] = [];
  for (let i = 0; i < top; i++) {
    out.push({ x: -w / 2 + (w / top) * (i + 0.5), y: -h / 2 - 30, angle: -90 });
  }
  for (let i = 0; i < bottom; i++) {
    out.push({ x: w / 2 - (w / bottom) * (i + 0.5), y: h / 2 + 30, angle: 90 });
  }
  return out;
}

/** The box a table needs on the canvas, chairs and labels included. */
export function tableBounds(table: SeatingTable): { w: number; h: number } {
  const pts = seatPoints(table.shape, table.seats);
  const { w, h } = tableSize(table.shape, table.seats);
  const padX = Math.max(...pts.map((p) => Math.abs(p.x)), w / 2) + SEAT_R + 8;
  const padY = Math.max(...pts.map((p) => Math.abs(p.y)), h / 2) + SEAT_R + 20;
  return { w: padX * 2, h: padY * 2 };
}

/* ── Plan-wide reads ──────────────────────────────────────────────────── */

export function seatedIds(plan: SeatingPlan): Set<string> {
  const out = new Set<string>();
  for (const t of plan.tables) for (const id of t.seated) if (id) out.add(id);
  return out;
}

/** Where a guest is sitting, or null when they are still on the list. */
export function seatOf(plan: SeatingPlan, guestId: string): { tableId: string; index: number } | null {
  for (const t of plan.tables) {
    const index = t.seated.indexOf(guestId);
    if (index !== -1) return { tableId: t.id, index };
  }
  return null;
}

export function freeSeats(table: SeatingTable): number {
  return table.seated.filter((s) => s === null).length;
}

/* ── Floor elements ───────────────────────────────────────────────────── */

const specOf = (kind: FloorElementKind) => ELEMENTS.find((e) => e.id === kind)!;

/**
 * A new element, dropped to the right of everything already on the plan so it
 * never lands on top of a table the couple has already arranged.
 */
export function makeElement(plan: SeatingPlan, kind: FloorElementKind, label: string): FloorElement {
  const spec = specOf(kind);
  const elements = plan.elements ?? [];
  const right = Math.max(
    0,
    ...plan.tables.map((t) => t.x + tableBounds(t).w / 2),
    ...elements.map((e) => e.x + e.w / 2),
  );
  return {
    id: `e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind,
    label,
    x: right + 40 + spec.w / 2,
    y: 60 + spec.h / 2 + (elements.length % 3) * 150,
    w: spec.w,
    h: spec.h,
  };
}

export function addElement(plan: SeatingPlan, element: FloorElement): SeatingPlan {
  return { ...plan, elements: [...(plan.elements ?? []), element] };
}

export function patchElement(
  plan: SeatingPlan,
  id: string,
  patch: Partial<Pick<FloorElement, 'label' | 'x' | 'y'>>,
): SeatingPlan {
  const elements = plan.elements ?? [];
  if (!elements.some((e) => e.id === id)) return plan;
  return {
    ...plan,
    elements: elements.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...patch };
      // Kept on the canvas, the same way a dragged table is.
      return { ...next, x: Math.max(next.w / 2 + 10, next.x), y: Math.max(next.h / 2 + 10, next.y) };
    }),
  };
}

/** Resize to one of the three sizes, around the element's own centre. */
export function resizeElement(plan: SeatingPlan, id: string, size: ElementSize): SeatingPlan {
  const scale = ELEMENT_SIZES.find((s) => s.id === size)?.scale ?? 1;
  const elements = plan.elements ?? [];
  if (!elements.some((e) => e.id === id)) return plan;
  return {
    ...plan,
    elements: elements.map((e) => {
      if (e.id !== id) return e;
      const spec = specOf(e.kind);
      return { ...e, w: Math.round(spec.w * scale), h: Math.round(spec.h * scale) };
    }),
  };
}

/** Which of the three sizes an element is, or null when it matches none. */
export function sizeOf(element: FloorElement): ElementSize | null {
  const spec = specOf(element.kind);
  return ELEMENT_SIZES.find((s) => Math.round(spec.w * s.scale) === element.w)?.id ?? null;
}

export function removeElement(plan: SeatingPlan, id: string): SeatingPlan {
  if (!(plan.elements ?? []).some((e) => e.id === id)) return plan;
  return { ...plan, elements: (plan.elements ?? []).filter((e) => e.id !== id) };
}

/* ── Moves ────────────────────────────────────────────────────────────── */

const replace = (plan: SeatingPlan, tables: SeatingTable[]): SeatingPlan => ({ ...plan, tables });

/**
 * Put a guest in a chair.
 *
 * Dropping onto a taken chair swaps the two guests rather than refusing the
 * move or silently evicting someone — swapping two people around a table is
 * the single most common edit, and every other behaviour makes it a
 * three-step job.
 */
export function seatGuest(
  plan: SeatingPlan,
  guestId: string,
  tableId: string,
  index: number
): SeatingPlan {
  const target = plan.tables.find((t) => t.id === tableId);
  if (!target || index < 0 || index >= target.seated.length) return plan;

  const from = seatOf(plan, guestId);
  if (from && from.tableId === tableId && from.index === index) return plan;
  const displaced = target.seated[index];
  if (displaced === guestId) return plan;

  return replace(plan, plan.tables.map((t) => {
    const seated = [...t.seated];
    let touched = false;
    // Lift the guest out of their old chair, and drop whoever was in the
    // target chair into it — an empty target just leaves it empty.
    if (from && from.tableId === t.id) {
      seated[from.index] = displaced ?? null;
      touched = true;
    }
    if (t.id === tableId) {
      seated[index] = guestId;
      touched = true;
    } else if (!from || from.tableId !== t.id) {
      // A guest can only be in one chair, so clear any stale copy.
      const stale = seated.indexOf(guestId);
      if (stale !== -1) { seated[stale] = null; touched = true; }
    }
    return touched ? { ...t, seated } : t;
  }));
}

/** Take a guest out of their chair and back onto the list. */
export function unseatGuest(plan: SeatingPlan, guestId: string): SeatingPlan {
  const at = seatOf(plan, guestId);
  if (!at) return plan;
  return replace(plan, plan.tables.map((t) =>
    t.id === at.tableId
      ? { ...t, seated: t.seated.map((s, i) => (i === at.index ? null : s)) }
      : t
  ));
}

/** The first free chair at a table, or -1 when it is full. */
export function firstFreeSeat(table: SeatingTable): number {
  return table.seated.indexOf(null);
}

/**
 * Seat a guest at a table without choosing the chair: the first free one.
 * `null` takes them off the plan. Used from the guest dialog, where the
 * question is "which table", and the chair is the plan's business.
 *
 * Unchanged when they already sit at that table (no reshuffle to chair one),
 * and when the table is full or does not exist.
 */
export function placeAtTable(plan: SeatingPlan, guestId: string, tableId: string | null): SeatingPlan {
  if (tableId === null) return unseatGuest(plan, guestId);
  if (seatOf(plan, guestId)?.tableId === tableId) return plan;
  const target = plan.tables.find((t) => t.id === tableId);
  if (!target) return plan;
  const index = firstFreeSeat(target);
  return index === -1 ? plan : seatGuest(plan, guestId, tableId, index);
}

/**
 * The tables a guest could be put at, for a picker: every table with a free
 * chair, plus the one they already sit at even when it is full, so the picker
 * can show where they are.
 */
export function tableOptions(
  plan: SeatingPlan,
  guestId: string | null,
): { id: string; name: string; free: number; current: boolean }[] {
  const at = guestId ? seatOf(plan, guestId) : null;
  return plan.tables
    .map((t) => ({ id: t.id, name: t.name, free: freeSeats(t), current: at?.tableId === t.id }))
    .filter((t) => t.current || t.free > 0);
}

export function setSeatCount(table: SeatingTable, next: number): SeatingTable {
  const seats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, next));
  if (seats === table.seats) return table;
  if (seats > table.seats) {
    return { ...table, seats, seated: [...table.seated, ...Array(seats - table.seats).fill(null)] };
  }
  /* Shrinking must not silently drop a guest. Keep everyone who is seated by
     closing up the gaps first, and only lose chairs that were empty. */
  const occupied = table.seated.filter((s): s is string => s !== null);
  const kept = occupied.slice(0, seats);
  const seated: (string | null)[] = [...kept, ...Array(Math.max(0, seats - kept.length)).fill(null)];
  return { ...table, seats, seated };
}

export function changeShape(table: SeatingTable, shape: TableShape): SeatingTable {
  return { ...table, shape };
}

/* ── Reading and writing the stored blob ──────────────────────────────── */

interface LegacyTable {
  id?: unknown;
  name?: unknown;
  shape?: unknown;
  capacity?: unknown;
  guestIds?: unknown;
}

const EMPTY: SeatingPlan = { version: 2, tables: [] };

/**
 * Read whatever is in `seating_plans.data`.
 *
 * Version 1 stored `{tables: [{capacity, guestIds}], positions: {id: {x,y}}}`
 * — a bag of guests per table and the table's canvas spot in a second map.
 * Those plans are real couples' work, so they are converted rather than
 * dropped: every guest keeps their table and lands in the first chairs.
 */
export function readPlan(raw: unknown): SeatingPlan {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const data = raw as Record<string, unknown>;

  if (data.version === 2 && Array.isArray(data.tables)) {
    const tables = (data.tables as unknown[]).flatMap((t) => {
      const parsed = readTable(t);
      return parsed ? [parsed] : [];
    });
    const elements = Array.isArray(data.elements)
      ? (data.elements as unknown[]).flatMap((e) => {
          const parsed = readElement(e);
          return parsed ? [parsed] : [];
        })
      : [];
    return elements.length > 0 ? { version: 2, tables, elements } : { version: 2, tables };
  }

  if (!Array.isArray(data.tables)) return EMPTY;
  const positions = (data.positions ?? {}) as Record<string, { x?: number; y?: number }>;
  const tables = (data.tables as LegacyTable[]).flatMap((t, i): SeatingTable[] => {
    if (typeof t?.id !== 'string') return [];
    const guestIds = Array.isArray(t.guestIds)
      ? (t.guestIds as unknown[]).filter((g): g is string => typeof g === 'string')
      : [];
    const seats = Math.max(
      MIN_SEATS,
      Math.min(MAX_SEATS, typeof t.capacity === 'number' ? t.capacity : 8, ),
    );
    const room = Math.max(seats, guestIds.length);
    const pos = positions[t.id] ?? {};
    return [{
      id: t.id,
      name: typeof t.name === 'string' ? t.name : `Bord ${i + 1}`,
      shape: t.shape === 'rect' ? 'rect' : t.shape === 'horseshoe' ? 'head' : 'round',
      seats: room,
      x: typeof pos.x === 'number' ? pos.x : 200 + (i % 3) * 340,
      y: typeof pos.y === 'number' ? pos.y : 200 + Math.floor(i / 3) * 320,
      seated: [...guestIds, ...Array(Math.max(0, room - guestIds.length)).fill(null)],
    }];
  });
  return { version: 2, tables };
}

function readTable(raw: unknown): SeatingTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string') return null;
  const seats = typeof t.seats === 'number'
    ? Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.round(t.seats)))
    : 8;
  const seated = Array.isArray(t.seated)
    ? (t.seated as unknown[]).map((s) => (typeof s === 'string' ? s : null))
    : [];
  return {
    id: t.id,
    name: typeof t.name === 'string' ? t.name : 'Bord',
    shape: t.shape === 'rect' || t.shape === 'head' ? t.shape : 'round',
    seats,
    x: typeof t.x === 'number' ? t.x : 200,
    y: typeof t.y === 'number' ? t.y : 200,
    seated: [...seated.slice(0, seats), ...Array(Math.max(0, seats - seated.length)).fill(null)],
  };
}

/** One stored element, or null for anything this version does not know. */
function readElement(raw: unknown): FloorElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || !ELEMENTS.some((x) => x.id === e.kind)) return null;
  const spec = specOf(e.kind as FloorElementKind);
  const dim = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(40, Math.min(800, Math.round(v))) : fallback;
  return {
    id: e.id,
    kind: spec.id,
    label: typeof e.label === 'string' && e.label.trim() ? e.label : spec.label,
    x: typeof e.x === 'number' ? e.x : 200,
    y: typeof e.y === 'number' ? e.y : 200,
    w: dim(e.w, spec.w),
    h: dim(e.h, spec.h),
  };
}

/** Drop guests who are no longer on the guest list — deleted, or never real. */
export function pruneToGuests(plan: SeatingPlan, guestIds: Set<string>): SeatingPlan {
  let changed = false;
  const tables = plan.tables.map((t) => {
    if (!t.seated.some((s) => s && !guestIds.has(s))) return t;
    changed = true;
    return { ...t, seated: t.seated.map((s) => (s && guestIds.has(s) ? s : null)) };
  });
  return changed ? replace(plan, tables) : plan;
}

/** A fresh table, dropped clear of the ones already on the canvas. */
export function makeTable(plan: SeatingPlan, shape: TableShape, name: string): SeatingTable {
  const spec = SHAPES.find((s) => s.id === shape)!;
  const row = plan.tables.length % 3;
  const col = Math.floor(plan.tables.length / 3);
  return {
    id: `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name,
    shape,
    seats: spec.seats,
    x: 260 + row * 360,
    y: 260 + col * 340,
    seated: Array(spec.seats).fill(null),
  };
}
