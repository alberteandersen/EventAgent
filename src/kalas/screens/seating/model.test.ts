import { describe, expect, it } from 'vitest';
import { EN } from '../../strings';
import {
  freeSeats, initials, makeTable, pruneToGuests, readPlan, seatGuest, seatOf, seatPoints, seatLabel,
  seatedIds, setSeatCount, tableSize, unseatGuest, placeAtTable, tableOptions,
  ELEMENTS, addElement, makeElement, patchElement, removeElement, resizeElement, sizeOf,
  type SeatingPlan, type SeatingTable,
} from './model';

const table = (over: Partial<SeatingTable> = {}): SeatingTable => ({
  id: 't1', name: 'Bord 1', shape: 'round', seats: 4,
  x: 0, y: 0, seated: [null, null, null, null], ...over,
});

const plan = (...tables: SeatingTable[]): SeatingPlan => ({ version: 2, tables });

describe('seat geometry', () => {
  it('puts the first chair at the top of a round table', () => {
    const [first] = seatPoints('round', 8);
    expect(first.x).toBeCloseTo(0);
    expect(first.y).toBeLessThan(0);
  });

  it('spaces a round table evenly all the way round', () => {
    const pts = seatPoints('round', 6);
    const radii = pts.map((p) => Math.hypot(p.x, p.y));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
    // Every chair is in a different place.
    const keys = new Set(pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(keys.size).toBe(6);
  });

  it('splits a long table between its two long sides', () => {
    const pts = seatPoints('rect', 10);
    expect(pts.filter((p) => p.y < 0)).toHaveLength(5);
    expect(pts.filter((p) => p.y > 0)).toHaveLength(5);
  });

  it('puts an odd chair on the top side of a long table', () => {
    const pts = seatPoints('rect', 7);
    expect(pts.filter((p) => p.y < 0)).toHaveLength(4);
    expect(pts.filter((p) => p.y > 0)).toHaveLength(3);
  });

  it('seats a top table along one side only, facing the room', () => {
    const pts = seatPoints('head', 8);
    expect(pts.every((p) => p.y < 0)).toBe(true);
    expect(pts.every((p) => p.angle === -90)).toBe(true);
    // Left to right, in order.
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
  });

  it('grows the table with its guest count', () => {
    expect(tableSize('round', 12).w).toBeGreaterThan(tableSize('round', 6).w);
    expect(tableSize('rect', 20).w).toBeGreaterThan(tableSize('rect', 8).w);
  });

  it('always returns one point per chair', () => {
    for (const shape of ['round', 'rect', 'head'] as const) {
      for (const n of [2, 3, 8, 13, 30]) {
        expect(seatPoints(shape, n)).toHaveLength(n);
      }
    }
  });
});

describe('seating a guest', () => {
  it('puts them in an empty chair', () => {
    const next = seatGuest(plan(table()), 'g1', 't1', 2);
    expect(next.tables[0].seated).toEqual([null, null, 'g1', null]);
  });

  it('moves them between chairs at the same table', () => {
    const next = seatGuest(plan(table({ seated: ['g1', null, null, null] })), 'g1', 't1', 3);
    expect(next.tables[0].seated).toEqual([null, null, null, 'g1']);
  });

  it('moves them between tables', () => {
    const p = plan(
      table({ seated: ['g1', null, null, null] }),
      table({ id: 't2', seated: [null, null, null, null] }),
    );
    const next = seatGuest(p, 'g1', 't2', 0);
    expect(next.tables[0].seated).toEqual([null, null, null, null]);
    expect(next.tables[1].seated).toEqual(['g1', null, null, null]);
  });

  /* The move a couple makes most: "these two should swap". */
  it('swaps two seated guests instead of evicting one', () => {
    const p = plan(table({ seated: ['g1', 'g2', null, null] }));
    const next = seatGuest(p, 'g1', 't1', 1);
    expect(next.tables[0].seated).toEqual(['g2', 'g1', null, null]);
  });

  it('swaps across two tables', () => {
    const p = plan(
      table({ seated: ['g1', null, null, null] }),
      table({ id: 't2', seated: ['g2', null, null, null] }),
    );
    const next = seatGuest(p, 'g1', 't2', 0);
    expect(next.tables[0].seated).toEqual(['g2', null, null, null]);
    expect(next.tables[1].seated).toEqual(['g1', null, null, null]);
  });

  it('displaces nobody when the guest was not seated yet', () => {
    const p = plan(table({ seated: ['g2', null, null, null] }));
    const next = seatGuest(p, 'g1', 't1', 0);
    // g2 had no chair of g1's to fall into, so they go back on the list.
    expect(next.tables[0].seated).toEqual(['g1', null, null, null]);
    expect(seatOf(next, 'g2')).toBeNull();
  });

  it('is a no-op when the guest is already in that chair', () => {
    const p = plan(table({ seated: ['g1', null, null, null] }));
    expect(seatGuest(p, 'g1', 't1', 0)).toBe(p);
  });

  it('ignores a chair that does not exist', () => {
    const p = plan(table());
    expect(seatGuest(p, 'g1', 't1', 9)).toBe(p);
    expect(seatGuest(p, 'g1', 'nope', 0)).toBe(p);
  });

  it('never leaves a guest in two chairs', () => {
    let p: SeatingPlan = plan(table(), table({ id: 't2' }));
    p = seatGuest(p, 'g1', 't1', 0);
    p = seatGuest(p, 'g1', 't2', 3);
    const count = p.tables.flatMap((t) => t.seated).filter((s) => s === 'g1').length;
    expect(count).toBe(1);
  });
});

describe('unseating', () => {
  it('empties the chair', () => {
    const p = plan(table({ seated: ['g1', 'g2', null, null] }));
    expect(unseatGuest(p, 'g1').tables[0].seated).toEqual([null, 'g2', null, null]);
  });

  it('leaves the plan alone when they are not seated', () => {
    const p = plan(table());
    expect(unseatGuest(p, 'g1')).toBe(p);
  });
});

describe('changing the number of chairs', () => {
  it('adds empty chairs', () => {
    const next = setSeatCount(table({ seated: ['g1', null, null, null] }), 6);
    expect(next.seats).toBe(6);
    expect(next.seated).toEqual(['g1', null, null, null, null, null]);
  });

  /* Shrinking a table used to be the fastest way to lose a guest. */
  it('closes the gaps rather than dropping a seated guest', () => {
    const next = setSeatCount(table({ seats: 4, seated: [null, 'g1', null, 'g2'] }), 2);
    expect(next.seated).toEqual(['g1', 'g2']);
  });

  it('clamps to the allowed range', () => {
    expect(setSeatCount(table(), 0).seats).toBe(2);
    expect(setSeatCount(table(), 999).seats).toBe(30);
  });
});

describe('plan-wide reads', () => {
  it('lists everyone with a chair', () => {
    const p = plan(table({ seated: ['g1', null, 'g2', null] }), table({ id: 't2', seated: ['g3'] }));
    expect(seatedIds(p)).toEqual(new Set(['g1', 'g2', 'g3']));
  });

  it('counts the free chairs', () => {
    expect(freeSeats(table({ seated: ['g1', null, null, null] }))).toBe(3);
  });

  it('drops guests who left the guest list', () => {
    const p = plan(table({ seated: ['g1', 'gone', null, null] }));
    const next = pruneToGuests(p, new Set(['g1']));
    expect(next.tables[0].seated).toEqual(['g1', null, null, null]);
  });

  it('leaves the plan untouched when every guest still exists', () => {
    const p = plan(table({ seated: ['g1', null, null, null] }));
    expect(pruneToGuests(p, new Set(['g1', 'g2']))).toBe(p);
  });
});

describe('reading the stored blob', () => {
  it('survives nonsense', () => {
    expect(readPlan(null).tables).toEqual([]);
    expect(readPlan('nope').tables).toEqual([]);
    expect(readPlan({}).tables).toEqual([]);
  });

  it('reads a v2 plan back', () => {
    const p = plan(table({ seated: ['g1', null, null, null] }));
    expect(readPlan(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('pads a v2 table whose seat list is short', () => {
    const raw = { version: 2, tables: [{ id: 't1', name: 'A', shape: 'round', seats: 4, x: 0, y: 0, seated: ['g1'] }] };
    expect(readPlan(raw).tables[0].seated).toEqual(['g1', null, null, null]);
  });

  /* Real couples have v1 plans saved. Converting beats starting them over. */
  it('converts a version 1 plan, keeping everyone at their table', () => {
    const legacy = {
      tables: [
        { id: 't1', name: 'Bord 1', shape: 'round', capacity: 6, guestIds: ['g1', 'g2'] },
        { id: 'head', name: 'Bordplan', shape: 'horseshoe', capacity: 4, guestIds: [] },
      ],
      positions: { t1: { x: 100, y: 120 } },
    };
    const next = readPlan(legacy);
    expect(next.version).toBe(2);
    expect(next.tables[0].seats).toBe(6);
    expect(next.tables[0].seated).toEqual(['g1', 'g2', null, null, null, null]);
    expect(next.tables[0].x).toBe(100);
    // The old horseshoe has no equivalent; a top table is the nearest thing.
    expect(next.tables[1].shape).toBe('head');
  });

  it('grows a v1 table that was overfilled past its capacity', () => {
    const legacy = { tables: [{ id: 't1', capacity: 2, guestIds: ['g1', 'g2', 'g3'] }] };
    const next = readPlan(legacy);
    expect(next.tables[0].seats).toBe(3);
    expect(next.tables[0].seated).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('makeTable', () => {
  it('starts empty with the shape default', () => {
    const t = makeTable(plan(), 'rect', 'Bord 1');
    expect(t.seats).toBe(12);
    expect(t.seated).toHaveLength(12);
    expect(t.seated.every((s) => s === null)).toBe(true);
  });

  it('does not stack a new table on the last one', () => {
    const first = makeTable(plan(), 'round', 'A');
    const second = makeTable(plan(first), 'round', 'B');
    expect([second.x, second.y]).not.toEqual([first.x, first.y]);
  });
});

describe('name helpers', () => {
  it('takes the first and last initial', () => {
    expect(initials('Anne-Marie Bo')).toBe('AB');
    expect(initials('Chidi Okafor')).toBe('CO');
  });

  it('falls back to two letters of a single name', () => {
    expect(initials('Grandma')).toBe('GR');
    expect(initials('  ')).toBe('?');
  });

  it('labels a chair with the first name, truncated', () => {
    expect(seatLabel('Margaret Whitfield')).toBe('Margaret');
    expect(seatLabel('Bartholomew Jones')).toBe('Bartholom…');
  });
});

describe('placing a guest from the guest dialog', () => {
  const two = () => plan(
    table({ id: 't1', name: 'Bord 1', seated: ['a', null, null, null] }),
    table({ id: 't2', name: 'Bord 2', seats: 2, seated: ['b', 'c'] }),
  );

  it('sits them in the first free chair', () => {
    expect(placeAtTable(two(), 'd', 't1').tables[0].seated).toEqual(['a', 'd', null, null]);
  });

  it('moves them out of their old chair', () => {
    const moved = placeAtTable(two(), 'a', 't1');
    expect(moved).toEqual(two()); // already there: nothing moves
    const p = placeAtTable(plan(table({ id: 't1', seated: [null, null, null, null] }), table({ id: 't3', seated: ['a', null, null, null] })), 'a', 't1');
    expect(seatOf(p, 'a')).toEqual({ tableId: 't1', index: 0 });
    expect(p.tables[1].seated).toEqual([null, null, null, null]);
  });

  it('leaves the plan alone when the table is full or gone', () => {
    expect(placeAtTable(two(), 'd', 't2')).toEqual(two());
    expect(placeAtTable(two(), 'd', 'nope')).toEqual(two());
  });

  it('takes them off the plan with null', () => {
    expect(seatOf(placeAtTable(two(), 'a', null), 'a')).toBeNull();
  });

  it('offers tables with room, plus the full one they sit at', () => {
    expect(tableOptions(two(), 'd').map((o) => o.id)).toEqual(['t1']);
    expect(tableOptions(two(), 'b')).toEqual([
      { id: 't1', name: 'Bord 1', free: 3, current: false },
      { id: 't2', name: 'Bord 2', free: 0, current: true },
    ]);
    expect(tableOptions(two(), null).map((o) => o.id)).toEqual(['t1']);
  });
});

describe('floor elements', () => {
  it('reads a plan saved before elements existed', () => {
    const p = readPlan({ version: 2, tables: [table()] });
    expect(p.elements).toBeUndefined();
    expect(p.tables).toHaveLength(1);
  });

  it('keeps the elements it knows and drops the rest', () => {
    const p = readPlan({
      version: 2,
      tables: [],
      elements: [
        { id: 'e1', kind: 'dansegulv', label: 'Dansegulv', x: 300, y: 200, w: 260, h: 200 },
        { id: 'e2', kind: 'hoppeborg', label: '?', x: 0, y: 0, w: 10, h: 10 },
        { id: 'e3', kind: 'bar', x: 100, y: 100, w: 99999 },
      ],
    });
    expect(p.elements?.map((e) => e.id)).toEqual(['e1', 'e3']);
    // A missing label falls back to the kind's own, and a size is clamped.
    expect(p.elements?.[1]).toMatchObject({ label: 'Bar', w: 800, h: 80 });
  });

  it('survives a round trip through the stored blob', () => {
    const p = addElement(plan(table()), makeElement(plan(table()), 'buffet', 'Madbord'));
    expect(readPlan(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('drops a new element clear of the tables', () => {
    const t = table({ x: 400, y: 300, seats: 8 });
    const el = makeElement(plan(t), 'dj', 'DJ');
    expect(el.x - el.w / 2).toBeGreaterThan(400);
  });

  it('keeps the guests when elements change', () => {
    const p = plan(table({ seated: ['a', null, null, null] }));
    const el = makeElement(p, 'bar', 'Bar');
    const next = removeElement(addElement(p, el), el.id);
    expect(seatOf(next, 'a')).toEqual({ tableId: 't1', index: 0 });
    expect(seatGuest(addElement(p, el), 'b', 't1', 1).elements).toEqual([el]);
  });

  it('renames and moves, but never off the canvas', () => {
    const p = addElement(plan(), { id: 'e', kind: 'kage', label: 'Kage', x: 300, y: 300, w: 120, h: 120 });
    const moved = patchElement(p, 'e', { label: 'Kagebordet', x: -50, y: 20 });
    expect(moved.elements?.[0]).toMatchObject({ label: 'Kagebordet', x: 70, y: 70 });
  });

  it('resizes around the kind\'s own proportions', () => {
    const spec = ELEMENTS.find((e) => e.id === 'scene')!;
    const p = addElement(plan(), { id: 'e', kind: 'scene', label: 'Scene', x: 400, y: 400, w: spec.w, h: spec.h });
    expect(sizeOf(p.elements![0])).toBe('M');
    const big = resizeElement(p, 'e', 'L');
    expect(big.elements?.[0]).toMatchObject({ w: Math.round(spec.w * 1.4), h: Math.round(spec.h * 1.4) });
    expect(sizeOf(big.elements![0])).toBe('L');
  });

  it('has English for every element on the menu', () => {
    for (const { label } of ELEMENTS) expect(EN[label], label).toBeTruthy();
  });

  it('leaves the plan alone for an id it does not have', () => {
    const p = plan(table());
    expect(removeElement(p, 'x')).toBe(p);
    expect(patchElement(p, 'x', { label: 'y' })).toBe(p);
    expect(resizeElement(p, 'x', 'S')).toBe(p);
  });
});
