import { describe, it, expect } from 'vitest';
import { providerLinks } from './providers';

const byId = (q: Parameters<typeof providerLinks>[0]) =>
  Object.fromEntries(providerLinks(q).map((l) => [l.id, l.url]));

describe('providerLinks', () => {
  it('sends the hotel and its country to every provider', () => {
    const l = byId({ name: 'Katikies', location: 'Oia, Grækenland' });
    expect(l.booking).toContain('ss=Katikies%2C+Oia%2C+Gr%C3%A6kenland');
    expect(l.google).toContain('q=Katikies%2C+Oia%2C+Gr%C3%A6kenland+hotel');
  });

  it('does not repeat a place the hotel is already named after', () => {
    // "Katikies Santorini, Santorini, Greece" finds less than the name alone.
    const l = byId({ name: 'Katikies Santorini', location: 'Santorini, Grækenland' });
    expect(l.booking).toContain('ss=Katikies+Santorini');
    expect(l.booking).not.toContain('Santorini%2C+Santorini');
  });

  it('carries the dates through when the couple has a stay', () => {
    const l = byId({ name: 'Borgo Egnazia', checkIn: '2027-06-10', checkOut: '2027-06-17' });
    expect(l.booking).toContain('checkin=2027-06-10');
    expect(l.booking).toContain('checkout=2027-06-17');
    expect(l.booking).toContain('group_adults=2');
  });

  it('drops a range that is not a stay rather than sending nonsense', () => {
    for (const bad of [
      { checkIn: '2027-06-10', checkOut: null },
      { checkIn: null, checkOut: '2027-06-17' },
      // Leaving before arriving, and arriving and leaving the same day.
      { checkIn: '2027-06-17', checkOut: '2027-06-10' },
      { checkIn: '2027-06-10', checkOut: '2027-06-10' },
      { checkIn: 'juni 2027', checkOut: 'juli 2027' },
    ]) {
      const l = byId({ name: 'Borgo Egnazia', ...bad });
      expect(l.booking).not.toContain('checkin');
      expect(l.booking).not.toContain('2027');
    }
  });

  it('uses the Danish storefronts by default and the English ones on request', () => {
    expect(byId({ name: 'Amanzoe' }).booking).toContain('lang=da');
    expect(byId({ name: 'Amanzoe' }).google).toContain('hl=da');
    expect(byId({ name: 'Amanzoe', lang: 'en' }).booking).toContain('lang=en-gb');
    expect(byId({ name: 'Amanzoe', lang: 'en' }).google).toContain('hl=en');
  });

  it('produces URLs that parse, whatever the hotel is called', () => {
    const l = providerLinks({ name: 'Hôtel du Cap-Eden-Roc & Spa', location: 'Antibes, Frankrig' });
    for (const link of l) expect(() => new URL(link.url)).not.toThrow();
  });
});
