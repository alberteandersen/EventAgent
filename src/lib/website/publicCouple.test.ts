import { describe, it, expect } from 'vitest';
import { publicCouple, siteTitle, coupleNames, siteLanguage } from './publicCouple';

const event = { title: 'Alberte', event_date: '2027-06-12', date_hint: null };
const da = { display_name: 'Alberte Bech', partner_name: 'Espen Nord', language: 'da' as const };
const en = { ...da, language: 'en' as const };

describe('publicCouple', () => {
  it('writes the date in the couple\'s own language', () => {
    // The bug: this was pinned to da-DK, so an English couple's guests read a
    // Danish date on an otherwise English page.
    expect(publicCouple(event, da).dateLabel).toBe('12. juni 2027');
    expect(publicCouple(event, en).dateLabel).toBe('12 June 2027');
  });

  it('uses first names only — that is how the site addresses them', () => {
    const c = publicCouple(event, da);
    expect(c.a).toBe('Alberte');
    expect(c.b).toBe('Espen');
  });

  it('falls back to what they told us when there is no firm date', () => {
    const c = publicCouple({ ...event, event_date: null, date_hint: 'Forår 2028' }, da);
    expect(c.dateLabel).toBe('Forår 2028');
    expect(c.dateISO).toBeNull();
  });

  it('says nothing rather than a broken date when there is neither', () => {
    expect(publicCouple({ ...event, event_date: null, date_hint: null }, da).dateLabel).toBe('');
  });

  it('takes the name from the event when the profile has none', () => {
    expect(publicCouple(event, null).a).toBe('Alberte');
    expect(publicCouple(event, null).b).toBe('');
  });
});

describe('siteTitle', () => {
  it('names the couple, in their language', () => {
    expect(siteTitle({ a: 'Alberte', b: 'Espen' }, 'da')).toBe('Alberte & Espens bryllup');
    expect(siteTitle({ a: 'Alberte', b: 'Espen' }, 'en')).toBe("Alberte & Espen's wedding");
  });

  it('works with one name', () => {
    expect(coupleNames({ a: 'Alberte', b: '' })).toBe('Alberte');
    expect(siteTitle({ a: 'Alberte', b: '' }, 'da')).toBe('Albertes bryllup');
  });

  it('falls back to the product rather than a title with a hole in it', () => {
    // "'s bryllup" in a family group chat is worse than no name at all.
    expect(siteTitle({ a: '', b: '' }, 'da')).toBe('Kalas');
  });
});

describe('siteLanguage', () => {
  it('defaults to Danish, and only "en" means English', () => {
    expect(siteLanguage(null)).toBe('da');
    expect(siteLanguage({ display_name: null, partner_name: null, language: 'da' })).toBe('da');
    expect(siteLanguage(en)).toBe('en');
  });
});
