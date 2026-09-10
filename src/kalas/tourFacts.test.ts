import { describe, it, expect } from 'vitest';
import { tourFact, nextTask, daysUntil, type TourFactInput } from './tourFacts';

const NOW = new Date('2026-09-08T09:00:00Z');

const base: TourFactInput = {
  region: 'Fyn',
  guestEstimate: 75,
  budgetTotal: 0,
  dateISO: null,
  venues: [],
  guests: [],
  tasks: [],
  unreadReplies: 0,
  now: NOW,
};

const task = (title: string, due: string | null, done = false) => ({ title, due_date: due, done });

describe('daysUntil', () => {
  it('counts whole days regardless of the time of day', () => {
    expect(daysUntil('2026-09-08', NOW)).toBe(0);
    expect(daysUntil('2026-09-11', NOW)).toBe(3);
    expect(daysUntil('2026-09-01', NOW)).toBe(-7);
  });
});

describe('nextTask', () => {
  it('picks the soonest open task with a date', () => {
    const t = nextTask([task('Sen', '2026-12-01'), task('Snart', '2026-09-20')]);
    expect(t?.title).toBe('Snart');
  });

  it('ignores finished tasks and ones with no date', () => {
    const t = nextTask([task('Klaret', '2026-09-10', true), task('Udateret', null), task('Ægte', '2026-11-01')]);
    expect(t?.title).toBe('Ægte');
  });

  it('still returns an overdue task — it is the most urgent thing there is', () => {
    const t = nextTask([task('Forsinket', '2026-08-01'), task('Senere', '2026-10-01')]);
    expect(t?.title).toBe('Forsinket');
  });

  it('returns null when nothing is actionable', () => {
    expect(nextTask([task('Klaret', '2026-09-10', true)])).toBeNull();
  });
});

describe('tourFact', () => {
  it('names the next thing on the timeline, with how long there is', () => {
    const f = tourFact('planning', { ...base, tasks: [task('Book fotograf', '2026-10-12')] });
    expect(f).toBe('Næste opgave: Book fotograf — om 34 dage.');
  });

  it('says an overdue task is overdue rather than counting forwards', () => {
    const f = tourFact('planning', { ...base, tasks: [task('Send save the dates', '2026-09-01')] });
    expect(f).toBe('Næste opgave: Send save the dates — den skulle have været klar for 7 dage siden.');
  });

  it('says "i dag" instead of "om 0 dage"', () => {
    const f = tourFact('planning', { ...base, tasks: [task('Ring til stedet', '2026-09-08')] });
    expect(f).toBe('Næste opgave: Ring til stedet — i dag.');
  });

  it('counts only shortlisted venues, not every card on the board', () => {
    const venues: TourFactInput['venues'] = [
      { category: 'venue', swipe_status: 'liked' },
      { category: 'venue', swipe_status: 'rejected' },
      { category: 'venue', swipe_status: 'liked' },
      // A liked photographer is not a venue on the shortlist.
      { category: 'photographer', swipe_status: 'liked' },
    ];
    expect(tourFact('vendors', { ...base, venues })).toBe(
      'I har 2 på jeres shortlist. Jeg kan finde flere, der har plads til 75.',
    );
  });

  it('falls back to what it will look for when the board is empty', () => {
    expect(tourFact('vendors', base)).toBe(
      'Ingen steder på tavlen endnu. Jeg leder efter noget i Fyn med plads til 75.',
    );
  });

  it('reports the guest list against the estimate they gave', () => {
    expect(tourFact('guests', base)).toBe('Listen er tom. I regner med omkring 75.');
    expect(tourFact('guests', { ...base, guests: [{ rsvp: 'ja' }, { rsvp: 'afventer' }, { rsvp: 'ja' }] }))
      .toBe('3 på listen, 2 har sagt ja.');
  });

  it('puts the venue share of the budget in kroner they recognise', () => {
    expect(tourFact('budget', { ...base, budgetTotal: 225000 }))
      .toBe('Af jeres 225.000 kr er ca. 74.500 kr sat af til stedet.');
  });

  it('says nothing rather than filler when the data is not there', () => {
    // No budget, no date, no region: every one of these would otherwise be a
    // sentence with a hole in it.
    expect(tourFact('budget', base)).toBeNull();
    expect(tourFact('intro', base)).toBeNull();
    expect(tourFact('planning', base)).toBeNull();
    expect(tourFact('vendors', { ...base, region: '' })).toBeNull();
    expect(tourFact('rest', base)).toBeNull();
  });

  it('counts down to the day itself on the opening steps', () => {
    expect(tourFact('intro', { ...base, dateISO: '2026-09-18' })).toBe('Der er 10 dage til.');
  });
});
