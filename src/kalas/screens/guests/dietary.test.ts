import { describe, expect, it } from 'vitest';
import { DIETARY_TAGS, dietarySummary, isAllergyTag, parseLegacyDietary, tagLabel } from './dietary';

describe('dietarySummary', () => {
  it('is empty when there is nothing to say', () => {
    expect(dietarySummary([], '')).toBe('');
    expect(dietarySummary(null, null)).toBe('');
    expect(dietarySummary(undefined, undefined)).toBe('');
  });

  it('reads the tags as their Danish labels', () => {
    expect(dietarySummary(['vegetarian', 'gluten_free'], '')).toBe('Vegetarisk · Glutenfri');
  });

  it('keeps free text on its own', () => {
    expect(dietarySummary([], 'nøddeallergi')).toBe('nøddeallergi');
  });

  it('puts the tags first and the typed detail last', () => {
    expect(dietarySummary(['vegan'], 'ingen svampe')).toBe('Vegansk · ingen svampe');
  });

  it('does not invent a separator around blank free text', () => {
    expect(dietarySummary(['halal'], '   ')).toBe('Halal');
  });

  it('falls back to the raw id for a tag it does not know', () => {
    expect(tagLabel('something_new')).toBe('something_new');
    expect(dietarySummary(['something_new'], '')).toBe('something_new');
  });
});

describe('parseLegacyDietary', () => {
  it('is empty for empty input', () => {
    expect(parseLegacyDietary('')).toEqual({ tags: [], rest: '' });
    expect(parseLegacyDietary(null)).toEqual({ tags: [], rest: '' });
  });

  it('recognises what a couple typed by hand', () => {
    expect(parseLegacyDietary('vegetar, glutenfri')).toEqual({
      tags: ['vegetarian', 'gluten_free'],
      rest: '',
    });
  });

  it('matches case-insensitively and on a longer phrase', () => {
    expect(parseLegacyDietary('Vegetarisk; NØDDEALLERGI').tags).toEqual(['vegetarian', 'nut_free']);
  });

  it('never drops what it did not understand', () => {
    const out = parseLegacyDietary('vegan, ingen svampe');
    expect(out.tags).toEqual(['vegan']);
    expect(out.rest).toBe('ingen svampe');
  });

  it('knows shellfish and egg allergies as typed', () => {
    expect(parseLegacyDietary('ingen skaldyr, ægallergi').tags).toEqual(['shellfish_free', 'egg_free']);
  });

  it('keeps unrecognised text whole when nothing matches', () => {
    expect(parseLegacyDietary('spiser alt')).toEqual({ tags: [], rest: 'spiser alt' });
  });

  it('does not repeat a tag named twice', () => {
    expect(parseLegacyDietary('vegetar, vegetarisk').tags).toEqual(['vegetarian']);
  });

  it('round-trips through dietarySummary without losing the free text', () => {
    const { tags, rest } = parseLegacyDietary('glutenfri, ingen svampe');
    expect(dietarySummary(tags, rest)).toBe('Glutenfri · ingen svampe');
  });
});

describe('allergies and diets', () => {
  it('tells an allergy from a choice of menu', () => {
    expect(isAllergyTag('nut_free')).toBe(true);
    expect(isAllergyTag('vegan')).toBe(false);
    expect(isAllergyTag('unknown')).toBe(false);
  });

  it('never has two tags with the same id', () => {
    const ids = DIETARY_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
