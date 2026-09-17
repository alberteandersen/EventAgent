import { describe, it, expect } from 'vitest';
import { cateringReport, hasNeed, needsOf } from './catering';
import type { SeatingPlan } from '../seating/model';

const g = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, rsvp: 'ja' as const, dietary: null, dietary_tags: [] as string[], overnight: false, no_alcohol: false,
  age_group: 'adult' as const, ...extra,
});

const guests = [
  g('a', 'Mette', { dietary_tags: ['vegan'], overnight: true }),
  g('b', 'Jonas', { dietary_tags: ['vegan', 'gluten_free'], no_alcohol: true, meal: 'Fisk' }),
  g('c', 'Asta', { age_group: 'child', dietary: 'nøddeallergi' }),
  g('d', 'Ida', { rsvp: 'afventer', dietary_tags: ['halal'] }),
  g('e', 'Per', { rsvp: 'nej', dietary_tags: ['vegan'], overnight: true }),
  g('f', 'Sofie', { dietary: 'vegetar, ingen svampe', meal: 'fisk' }),
];

const plan: SeatingPlan = {
  version: 2,
  tables: [
    { id: 't1', name: 'Bord 1', shape: 'round', seats: 4, x: 0, y: 0, seated: ['a', 'b', 'e', null] },
    { id: 't2', name: 'Bord 2', shape: 'round', seats: 4, x: 0, y: 0, seated: [null, null, null, null] },
  ],
};

describe('cateringReport', () => {
  it('counts confirmed guests only, by default', () => {
    const r = cateringReport(guests, plan);
    expect(r.counted).toBe(4);
    expect(r.pending).toBe(1);
    expect(r.declined).toBe(1);
    expect(r.ages).toEqual({ adult: 3, child: 1, baby: 0 });
    expect(r.children).toEqual([{ id: 'c', name: 'Asta', age: 'child' }]);
  });

  it('adds the unanswered when asked to', () => {
    const r = cateringReport(guests, plan, { includePending: true });
    expect(r.counted).toBe(5);
    expect(r.diets.find((d) => d.id === 'halal')?.guests.map((x) => x.name)).toEqual(['Ida']);
  });

  it('names who eats what, never counting a declined guest', () => {
    const vegan = cateringReport(guests, plan).diets.find((d) => d.id === 'vegan');
    expect(vegan?.guests.map((x) => x.name)).toEqual(['Mette', 'Jonas']);
  });

  it('reads tags out of needs that were only ever typed', () => {
    const r = cateringReport(guests, plan);
    expect(r.diets.find((d) => d.id === 'vegetarian')?.guests.map((x) => x.name)).toEqual(['Sofie']);
    // "nøddeallergi" is the nut-free tag in words; "ingen svampe" has no tag.
    expect(r.allergies.find((d) => d.id === 'nut_free')?.guests.map((x) => x.name)).toEqual(['Asta']);
    expect(r.other).toEqual([{ guest: { id: 'f', name: 'Sofie' }, text: 'ingen svampe' }]);
  });

  it('keeps allergies apart from diets, and counts each', () => {
    const r = cateringReport(guests, plan);
    expect(r.allergies.map((d) => d.id)).toEqual(['gluten_free', 'nut_free']);
    expect(r.diets.map((d) => d.id)).toEqual(['vegetarian', 'vegan']);
    // Jonas (gluten), Asta (nuts), Sofie (typed, treated as an allergy until known).
    expect(r.withAllergies).toBe(3);
    // Mette, Jonas (vegan), Sofie (vegetarian).
    expect(r.withDiets).toBe(3);
  });

  it('counts menu choices from the RSVP form, however they were cased', () => {
    expect(cateringReport(guests, plan).meals).toEqual([
      { label: 'Fisk', guests: [{ id: 'b', name: 'Jonas' }, { id: 'f', name: 'Sofie' }] },
    ]);
  });

  it('lists who stays the night and who is not drinking', () => {
    const r = cateringReport(guests, plan);
    expect(r.overnight.map((x) => x.name)).toEqual(['Mette']);
    expect(r.noAlcohol.map((x) => x.name)).toEqual(['Jonas']);
  });

  it('tells each table what its guests need, and skips empty tables', () => {
    const [t1, ...rest] = cateringReport(guests, plan).tables;
    expect(rest).toEqual([]);
    expect(t1).toMatchObject({ name: 'Bord 1', seated: 2 });
    expect(t1.diets).toEqual([{ label: 'Vegansk', count: 2 }]);
    expect(t1.allergies).toEqual([{ label: 'Glutenfri', count: 1 }]);
  });
});

describe('guest needs', () => {
  it('prefers tags, and keeps typed text alongside them', () => {
    expect(needsOf({ dietary_tags: ['vegan'], dietary: 'ingen koriander' })).toEqual({ tags: ['vegan'], text: 'ingen koriander' });
  });

  it('matches the list filters', () => {
    expect(hasNeed(guests[0], 'overnight')).toBe(true);
    expect(hasNeed(guests[1], 'noAlcohol')).toBe(true);
    expect(hasNeed(guests[2], 'children')).toBe(true);
    expect(hasNeed(guests[2], 'diet')).toBe(true);
    expect(hasNeed(g('x', 'X'), 'diet')).toBe(false);
    expect(hasNeed(guests[0], 'allergy')).toBe(false); // vegan is a diet
    expect(hasNeed(guests[1], 'allergy')).toBe(true);
  });
});
