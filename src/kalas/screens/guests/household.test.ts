import { describe, it, expect } from 'vitest';
import { EN } from '../../strings';
import {
  AGE_GROUPS, ageCountLabel, ageCounts, ageGroupOf, householdHeadOptions, householdMembers, orderByHousehold,
} from './household';

const g = (id: string, name: string, extra: { age_group?: 'adult' | 'child' | 'baby'; household_head?: string | null } = {}) =>
  ({ id, name, ...extra });

describe('age groups', () => {
  it('reads a guest saved before the column as an adult', () => {
    expect(ageGroupOf({})).toBe('adult');
    expect(ageGroupOf({ age_group: 'baby' })).toBe('baby');
  });

  it('counts the list by age', () => {
    expect(ageCounts([{}, { age_group: 'child' }, { age_group: 'child' }, { age_group: 'baby' }]))
      .toEqual({ adult: 1, child: 2, baby: 1 });
  });

  it('has English for every label', () => {
    for (const { id, label } of AGE_GROUPS) {
      expect(EN[label], label).toBeTruthy();
      for (const n of [1, 2]) expect(EN[ageCountLabel(id, n)], ageCountLabel(id, n)).toBeTruthy();
    }
  });

  it('says one child, not one children', () => {
    expect(ageCountLabel('child', 1)).toBe('{n} barn');
    expect(ageCountLabel('child', 3)).toBe('{n} børn');
    expect(ageCountLabel('adult', 1)).toBe('{n} voksen');
  });
});

describe('households', () => {
  const list = [
    g('mette', 'Mette Holm'),
    g('ida', 'Ida Sønderby'),
    g('jonas', 'Jonas Holm', { household_head: 'mette' }),
    g('asta', 'Asta Holm', { household_head: 'mette', age_group: 'child' }),
  ];

  it('finds the members of a household', () => {
    expect(householdMembers(list, 'mette').map((m) => m.id)).toEqual(['jonas', 'asta']);
    expect(householdMembers(list, 'ida')).toEqual([]);
  });

  it('offers only heads who are not members themselves, alphabetically', () => {
    expect(householdHeadOptions(list, 'ida').map((o) => o.id)).toEqual(['mette']);
    expect(householdHeadOptions(list, null).map((o) => o.id)).toEqual(['ida', 'mette']);
  });

  it('offers nothing to a guest who already heads a household', () => {
    expect(householdHeadOptions(list, 'mette')).toEqual([]);
  });

  it('never offers a guest to themselves', () => {
    expect(householdHeadOptions([g('a', 'A')], 'a')).toEqual([]);
  });

  it('puts members straight under their head', () => {
    const order = orderByHousehold([list[2], list[1], list[0], list[3]]);
    expect(order.map((r) => [r.guest.id, r.member])).toEqual([
      ['ida', false], ['mette', false], ['jonas', true], ['asta', true],
    ]);
  });

  it('keeps a member whose head is filtered out as an ordinary row', () => {
    const order = orderByHousehold([list[2], list[1]]);
    expect(order.map((r) => [r.guest.id, r.member])).toEqual([['jonas', false], ['ida', false]]);
  });
});
