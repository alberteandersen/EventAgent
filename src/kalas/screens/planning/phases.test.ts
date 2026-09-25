import { describe, expect, it } from 'vitest';
import type { TimelineTaskRow } from '@/lib/db/types';
import { phaseNow, phaseOfRow, phaseWindow, planByPhase } from './phases';

let seq = 0;
const row = (title: string, extra: Partial<TimelineTaskRow> = {}): TimelineTaskRow => ({
  id: `r${++seq}`, event_id: 'e', user_id: 'u', title, due_date: null, done: false, category: null,
  kind: 'milestone', sort: seq, created_at: '2026-01-01T00:00:00Z', ...extra,
});
const check = (title: string, extra: Partial<TimelineTaskRow> = {}) => row(title, { kind: 'check', category: 'okonomi', ...extra });

const WEDDING = '2027-09-11';
const TODAY = '2026-09-25'; // 351 days out

describe('phaseOfRow', () => {
  it('places a milestone by its date', () => {
    expect(phaseOfRow(row('Book fotograf', { due_date: '2026-11-11' }), WEDDING, '9-12')).toBe('9-12');
    expect(phaseOfRow(row('Invitationer sendt', { due_date: '2027-08-19' }), WEDDING, '9-12')).toBe('maaned');
  });

  it('puts the wedding day on the day', () => {
    expect(phaseOfRow(row('Jeres dag', { due_date: WEDDING, category: 'wedding_day' }), WEDDING, '9-12')).toBe('dagen');
  });

  it('files a default to-do by its seeded phase, unless the couple dated it', () => {
    expect(phaseOfRow(check('Bestil vielsesringe'), WEDDING, '9-12')).toBe('3-6');
    expect(phaseOfRow(check('Bestil vielsesringe', { due_date: '2026-10-01' }), WEDDING, '9-12')).toBe('9-12');
  });

  it('keeps a to-do of their own, with no date, where they are now', () => {
    expect(phaseOfRow(check('Vores eget punkt'), WEDDING, '6-9')).toBe('6-9');
  });
});

describe('phaseWindow', () => {
  it('turns a phase into the dates it covers', () => {
    expect(phaseWindow('9-12', WEDDING)).toEqual({ from: '2026-09-12', to: '2026-12-11' });
    expect(phaseWindow('uge', WEDDING)).toEqual({ from: '2027-09-04', to: '2027-09-10' });
    expect(phaseWindow('dagen', WEDDING)).toEqual({ from: WEDDING, to: WEDDING });
  });
});

describe('planByPhase', () => {
  it('holds every phase, each with its milestones and to-dos and a count', () => {
    const groups = planByPhase([
      row('Book fotograf', { due_date: '2026-11-11' }),
      row('Save-the-dates', { due_date: '2026-10-11', done: true }),
      check('Saml alle tilbud I har fået hjem ét sted'),
      check('Bestil vielsesringe'),
    ], WEDDING, TODAY);
    expect(groups.map((g) => g.phase)).toEqual(['12-18', '9-12', '6-9', '3-6', '1-3', 'maaned', 'uge', 'dagen', 'efter']);
    const nine = groups.find((g) => g.phase === '9-12')!;
    expect(nine.milestones.map((r) => r.title)).toEqual(['Save-the-dates', 'Book fotograf']);
    expect(nine.todos.map((r) => r.title)).toEqual(['Saml alle tilbud I har fået hjem ét sted']);
    expect([nine.done, nine.total]).toEqual([1, 3]);
    expect(groups.find((g) => g.phase === '3-6')!.todos).toHaveLength(1);
  });

  it('starts at the beginning of the plan without a date', () => {
    expect(phaseNow(null, TODAY)).toBe('12-18');
    expect(phaseNow(WEDDING, TODAY)).toBe('9-12');
  });
});
