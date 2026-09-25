import { describe, expect, it } from 'vitest';
import type { TimelineTaskRow } from '@/lib/db/types';
import { nextSteps } from './next-steps';

let seq = 0;
const row = (title: string, extra: Partial<TimelineTaskRow> = {}): TimelineTaskRow => ({
  id: `r${++seq}`, event_id: 'e', user_id: 'u', title, due_date: null, done: false, category: null,
  kind: 'milestone', sort: seq, created_at: '2026-01-01T00:00:00Z', ...extra,
});
const check = (title: string, extra: Partial<TimelineTaskRow> = {}) => row(title, { kind: 'check', category: 'okonomi', ...extra });

const TODAY = '2026-09-25';
const WEDDING = '2027-09-11'; // 351 days out: the 9–12 months phase
const none = () => null;

describe('nextSteps', () => {
  it('puts what is late first, then what is coming up, then this phase of the checklist', () => {
    const steps = nextSteps([
      row('Save-the-dates', { due_date: '2026-10-11' }),
      row('Book venue', { due_date: '2026-09-11' }),
      row('Book fotograf', { due_date: '2026-11-11' }),
      check('Saml alle tilbud I har fået hjem ét sted'), // 9–12
      check('Bliv enige om det samlede beløb I vil bruge'), // 12–18
      check('Bestil vielsesringe'), // 3–6: not yet
    ], { today: TODAY, weddingISO: WEDDING, looksDone: none });
    // Book fotograf is 47 days out, past SOON_DAYS, and not the next one.
    expect(steps.map((s) => `${s.why}:${s.row.title}`)).toEqual([
      'overdue:Book venue',
      'soon:Save-the-dates',
      'phase:Bliv enige om det samlede beløb I vil bruge',
      'phase:Saml alle tilbud I har fået hjem ét sted',
    ]);
  });

  it('always shows the next milestone, however far off', () => {
    const steps = nextSteps([row('Brudekjole & jakkesæt', { due_date: '2027-01-11' })],
      { today: TODAY, weddingISO: WEDDING, looksDone: none });
    expect(steps.map((s) => `${s.why}:${s.row.title}`)).toEqual(['soon:Brudekjole & jakkesæt']);
  });

  it('offers the tick for a milestone the app says is done, late or not', () => {
    const steps = nextSteps([
      row('Book venue', { due_date: '2026-09-11' }),
      row('Book fotograf', { due_date: '2027-01-11' }),
    ], {
      today: TODAY, weddingISO: WEDDING,
      looksDone: (t) => (t === 'Book venue' ? 'I har valgt jeres venue' : t === 'Book fotograf' ? 'I har booket en fotograf' : null),
    });
    expect(steps.map((s) => [s.why, s.row.title, s.reason])).toEqual([
      ['looks-done', 'Book venue', 'I har valgt jeres venue'],
      ['looks-done', 'Book fotograf', 'I har booket en fotograf'],
    ]);
  });

  it('leaves out what is done, the wedding day itself, and anything past the limit', () => {
    const steps = nextSteps([
      row('Sæt budget & gæsteliste', { due_date: '2026-07-11', done: true }),
      row('Jeres dag', { due_date: '2026-10-01', category: 'wedding_day' }),
      ...Array.from({ length: 8 }, (_, i) => row(`Sen ${i}`, { due_date: `2026-09-0${i + 1}` })),
    ], { today: TODAY, weddingISO: WEDDING, looksDone: none, limit: 3 });
    expect(steps.map((s) => s.row.title)).toEqual(['Sen 0', 'Sen 1', 'Sen 2']);
  });

  it('starts from the beginning of the checklist when there is no date', () => {
    const steps = nextSteps([
      check('Saml alle tilbud I har fået hjem ét sted'),
      check('Bliv enige om det samlede beløb I vil bruge'),
    ], { today: TODAY, weddingISO: null, looksDone: none });
    expect(steps.map((s) => s.row.title)).toEqual(['Bliv enige om det samlede beløb I vil bruge']);
  });
});
