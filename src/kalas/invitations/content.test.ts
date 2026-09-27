import { describe, it, expect } from 'vitest';
import { contentKey, coupleNames, dateLine, parseInviteContent, rsvpLine } from './content';

describe('parseInviteContent', () => {
  it('fills what the couple left blank from the wedding', () => {
    const c = parseInviteContent({ partnerA: 'Anna', venue: '' }, {
      partnerA: 'X', partnerB: 'Emil', date: '2026-09-12', venue: 'Sonnerupgaard', language: 'da',
    });
    expect(c.partnerA).toBe('Anna');
    expect(c.partnerB).toBe('Emil');
    expect(c.date).toBe('2026-09-12');
    expect(c.venue).toBe('Sonnerupgaard');
  });

  it('reads the old template editor rows, whose date is an isoDate', () => {
    const legacy = {
      partnerA: 'Clara', partnerB: 'Elliot', isoDate: '2027-06-21T15:00:00', time: 'Kl. 15',
      venue: 'The Old Orangery', venueDetail: 'Tuscany', language: 'en',
      label: 'A love letter from', introLines: ['are getting married'],
    };
    const c = parseInviteContent(legacy);
    expect(c.date).toBe('2027-06-21');
    expect(c.time).toBe('Kl. 15');
    expect(c.venueDetail).toBe('Tuscany');
    expect(c.language).toBe('en');
    expect(c).not.toHaveProperty('introLines');
  });

  it('drops dates that are not dates and survives junk', () => {
    expect(parseInviteContent({ date: 'next summer', rsvpBy: 42 }).date).toBe('');
    expect(parseInviteContent(null).language).toBe('da');
    expect(parseInviteContent('nope').partnerA).toBe('');
  });
});

describe('card lines', () => {
  const c = parseInviteContent({
    partnerA: 'Anna', partnerB: 'Emil', date: '2026-09-12', rsvpBy: '2026-08-01', language: 'da',
  });

  it('phrases the date and the reply deadline in the card language', () => {
    // phraseDate binds the year to its month with a no-break space.
    expect(dateLine(c).replace(/\u00a0/g, ' ')).toBe('Lørdag · den 12. september 2026');
    expect(rsvpLine(c)).toMatch(/^Svar venligst senest 1\. august 2026$/);
    expect(rsvpLine({ ...c, language: 'en' })).toBe('Kindly reply by 1 August 2026');
  });

  it('names one partner alone while the other is missing', () => {
    expect(coupleNames(c)).toBe('Anna & Emil');
    expect(coupleNames({ ...c, partnerB: '' })).toBe('Anna');
  });

  it('changes its key when a fact on the card changes', () => {
    expect(contentKey(c)).toBe(contentKey({ ...c }));
    expect(contentKey(c)).not.toBe(contentKey({ ...c, time: '14:00' }));
  });
});
