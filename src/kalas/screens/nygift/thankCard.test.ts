import { describe, it, expect } from 'vitest';
import { thankContent, thankMailBody, thankWords, greetingFor } from './thankCard';
import { parseInviteContent } from '../../invitations/content';

const invitation = parseInviteContent({
  partnerA: 'Alberte',
  partnerB: 'Espen',
  date: '2027-06-12',
  time: '14:00',
  venue: 'Broholm Slot',
  venueDetail: 'Gudme, Fyn',
  rsvpBy: '2027-05-01',
  note: 'Dresscode: sommerlig',
  language: 'da',
});

describe('thankContent', () => {
  it('keeps the names and the day — the card looks back at it', () => {
    const c = thankContent(invitation);
    expect(c.partnerA).toBe('Alberte');
    expect(c.partnerB).toBe('Espen');
    expect(c.date).toBe('2027-06-12');
    expect(c.language).toBe('da');
  });

  it('drops everything that asks something of the guest', () => {
    const c = thankContent(invitation);
    expect(c.venue).toBe('');
    expect(c.venueDetail).toBe('');
    expect(c.time).toBe('');
    expect(c.rsvpBy).toBe('');
  });

  it("puts the couple's own words where the invitation's note was", () => {
    expect(thankContent(invitation, 'Tak for dansen, Mormor.').note).toBe('Tak for dansen, Mormor.');
    expect(thankContent(invitation).note).toBe('');
    expect(thankContent(invitation, '   ').note).toBe('');
  });
});

describe('thankWords', () => {
  it('speaks about the day as something that happened', () => {
    expect(thankWords('da').eyebrow).toBe('Tak fordi I kom');
    expect(thankWords('en').eyebrow).toBe('Thank you for coming');
    expect(thankWords('en').closing).toBe('With love');
  });
});

describe('thankMailBody', () => {
  it('carries the default line when they wrote nothing', () => {
    const body = thankMailBody(thankContent(invitation));
    expect(body.split('\n')[0]).toBe('Kære alle');
    expect(body).toContain(thankWords('da').line);
    expect(body).toContain('Alberte & Espen');
    expect(body).not.toContain('Broholm');
  });

  it('carries their own words instead when they wrote some', () => {
    const body = thankMailBody(thankContent(invitation, 'Tak for dansen.'));
    expect(body).toContain('Tak for dansen.');
    expect(body).not.toContain(thankWords('da').line);
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
