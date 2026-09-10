import { describe, it, expect } from 'vitest';
import { thankCardData, greetingFor, showsNote } from './thankCard';
import { TEMPLATE_META } from '../../invitations/templates.meta';

const meta = TEMPLATE_META.find((m) => m.id === 'jardin')!;
const base = {
  partnerA: 'Alberte',
  partnerB: 'Espen',
  isoDate: '2027-06-12T15:00:00',
  venue: 'Broholm Slot',
  venueDetail: 'Gudme, Fyn',
};

describe('thankCardData', () => {
  it('speaks in the past tense about the day', () => {
    const d = thankCardData(meta, base);
    expect(d.label).toBe('Tak fordi I kom');
    expect(d.displayDate.startsWith('Vi blev gift ')).toBe(true);
    // The engine's own date phrasing is kept, only wrapped.
    expect(d.displayDate).toContain('2027');
  });

  it('drops the venue — a thank-you is not an instruction to turn up', () => {
    const d = thankCardData(meta, base);
    expect(d.venue).toBe('');
    expect(d.venueDetail).toBeUndefined();
    expect(d.time).toBeUndefined();
  });

  it("uses the couple's own words when they wrote some", () => {
    const d = thankCardData(meta, { ...base, personalNote: 'Tak for dansen, Mormor.' });
    expect(d.introLines).toEqual(['Tak for dansen, Mormor.']);
  });

  it('falls back to a default that is not addressed to anyone in particular', () => {
    const d = thankCardData(meta, base);
    expect(d.introLines.length).toBeGreaterThan(0);
    expect(d.introLines.join(' ')).toContain('Tak');
  });

  it('ignores a note that is only whitespace', () => {
    const d = thankCardData(meta, { ...base, personalNote: '   ' });
    expect(d.introLines).not.toEqual(['   ']);
  });

  it('keeps the names and the monogram the template renders from', () => {
    const d = thankCardData(meta, base);
    expect(d.partnerA).toBe('Alberte');
    expect(d.partnerB).toBe('Espen');
    expect(d.monogram).toBeTruthy();
  });

  it('carries English through to every line it owns', () => {
    const d = thankCardData(meta, { ...base, language: 'en' });
    expect(d.label).toBe('Thank you for coming');
    expect(d.displayDate.startsWith('We were married ')).toBe(true);
    expect(d.closing).toBe('With love');
  });

  it('renders for every template, not just the one we designed against', () => {
    for (const m of TEMPLATE_META) {
      const d = thankCardData(m, base);
      expect(d.label).toBeTruthy();
      expect(d.partnerA).toBe('Alberte');
      expect(d.language).toBe('da');
    }
  });
});

describe('showsNote', () => {
  it('is true only for templates that lay out introLines', () => {
    for (const m of TEMPLATE_META) {
      expect(showsNote(m)).toBe(m.fields.includes('introLines'));
    }
  });

  it('finds at least one design that can carry their words', () => {
    // If this ever hits zero the note field should stop being offered at all.
    expect(TEMPLATE_META.filter(showsNote).length).toBeGreaterThan(0);
  });
});

describe('greetingFor', () => {
  it('uses the first name, because that is how the card is addressed', () => {
    expect(greetingFor('Mette Sørensen')).toBe('Kære Mette');
    expect(greetingFor('Jonas', 'en')).toBe('Dear Jonas');
  });

  it('falls back to everyone when there is no name', () => {
    expect(greetingFor(null)).toBe('Kære alle');
    expect(greetingFor('  ')).toBe('Kære alle');
    expect(greetingFor(undefined, 'en')).toBe('Dear all');
  });
});
