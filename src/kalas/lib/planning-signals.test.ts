import { describe, expect, it } from 'vitest';
import { planningSignals, suggestedDone } from './planning-signals';

const none = {
  budget: null, chosenVenueId: null, venues: [], guests: [], invitations: [],
  inviteStageComplete: false, seatingData: null,
};

describe('suggestedDone', () => {
  it('says nothing when nothing has happened', () => {
    const s = planningSignals(none);
    for (const title of ['Sæt budget & gæsteliste', 'Book venue', 'Book fotograf', 'Invitationer sendt', 'Bordplan & menu låst']) {
      expect(suggestedDone(title, s)).toBeNull();
    }
  });

  it('reads a chosen venue and a booked photographer', () => {
    const s = planningSignals({
      ...none,
      chosenVenueId: 'v1',
      venues: [{ category: 'photographer', booked_at: '2026-09-01' }, { category: 'florist', booked_at: null }],
    });
    expect(suggestedDone('Book venue', s)).toBe('I har valgt jeres venue');
    expect(suggestedDone('Book fotograf', s)).toBe('I har booket en fotograf');
    expect(suggestedDone('Florist & dekoration', s)).toBeNull();
  });

  it('wants a budget and ten guests before the first milestone looks done', () => {
    const guests = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, rsvp: 'ja' as const }));
    expect(suggestedDone('Sæt budget & gæsteliste', planningSignals({ ...none, budget: 200000, guests }))).toBeNull();
    const ten = [...guests, { id: 'g9', rsvp: 'afventer' as const }];
    expect(suggestedDone('Sæt budget & gæsteliste', planningSignals({ ...none, budget: 200000, guests: ten })))
      .toBe('Budget og gæsteliste er på plads');
  });

  it('counts the seating plan done only when every yes has a seat', () => {
    const guests = [{ id: 'a', rsvp: 'ja' as const }, { id: 'b', rsvp: 'ja' as const }, { id: 'c', rsvp: 'nej' as const }];
    const table = (seated: (string | null)[]) => ({
      version: 2, tables: [{ id: 't1', name: 'Bord 1', shape: 'round', seats: 4, x: 0, y: 0, seated }],
    });
    expect(suggestedDone('Bordplan & menu låst', planningSignals({ ...none, guests, seatingData: table(['a', null, null, null]) }))).toBeNull();
    expect(suggestedDone('Bordplan & menu låst', planningSignals({ ...none, guests, seatingData: table(['a', 'b', null, null]) })))
      .toBe('Alle gæster har en plads');
  });

  it('takes a published invitation as the invitations being out', () => {
    const s = planningSignals({ ...none, invitations: [{ status: 'published' }] });
    expect(suggestedDone('Invitationer sendt', s)).toBe('Jeres invitation er sendt ud');
    expect(suggestedDone('Min egen milepæl', s)).toBeNull();
  });
});
