import { describe, expect, it } from 'vitest';
import { parseConfig } from '@/kalas/site/config';
import { applyContentEdit } from './contentEdit';
import { buildStamp, structureKey } from './slots';

const saved = {
  storyText: 'Vi mødtes i Aarhus.',
  program: [
    { id: 'e1', time: '14:00', label: 'Vielse', sublabel: '' },
    { id: 'e2', time: '18:00', label: 'Middag', sublabel: '' },
  ],
  faq: [{ id: 'f1', q: 'Parkering?', a: '' }],
};

describe('applyContentEdit', () => {
  it('changes only the texts it was given, and keeps the rest', () => {
    const { config, changed } = applyContentEdit(saved, { texts: { storyText: '  Vi mødtes på en bænk.  ' } });
    expect(config.storyText).toBe('Vi mødtes på en bænk.');
    expect(config.program).toBe(saved.program);
    expect(changed).toEqual(['storyText']);
  });

  it('keeps row ids, so a reworded programme stays a text change', () => {
    const { config } = applyContentEdit(saved, {
      program: [{ time: '14:30', label: 'Vielse i kirken' }, { time: '18:00', label: 'Middag' }],
    });
    expect((config.program as { id: string }[]).map((p) => p.id)).toEqual(['e1', 'e2']);
    expect(structureKey(parseConfig(config))).toBe(buildStamp(parseConfig(saved)).structureKey);
  });

  it('gives a new row a fresh id and drops empty ones', () => {
    const { config } = applyContentEdit(saved, {
      faq: [{ q: 'Parkering?', a: 'Ved slottet.' }, { q: 'Børn?', a: 'Ja' }, { q: '', a: 'x' }],
    }, 'T');
    expect(config.faq).toEqual([
      { id: 'f1', q: 'Parkering?', a: 'Ved slottet.' },
      { id: 'fT-1', q: 'Børn?', a: 'Ja' },
    ]);
  });

  it('switches sections, never the hero, and reports unknown ones', () => {
    const { config, changed, unknownSections } = applyContentEdit(saved, {
      sectionsOn: ['faq', 'dresscode', 'blog'], sectionsOff: ['hero', 'gallery'],
    });
    const sections = config.sections as { id: string; enabled: boolean }[];
    expect(sections.find((x) => x.id === 'faq')?.enabled).toBe(true);
    expect(sections.find((x) => x.id === 'gallery')?.enabled).toBe(false);
    expect(sections.find((x) => x.id === 'hero')?.enabled).toBe(true);
    expect(unknownSections).toEqual(['blog']);
    expect(changed).toContain('on:faq');
  });

  it('refuses an RSVP deadline that is not a date', () => {
    expect(applyContentEdit(saved, { texts: { rsvpDeadline: '1. juni' } }).config.rsvpDeadline).toBeUndefined();
    expect(applyContentEdit(saved, { texts: { rsvpDeadline: '2027-06-01' } }).config.rsvpDeadline).toBe('2027-06-01');
  });

  it('merges a partial contact into the saved one', () => {
    const { config } = applyContentEdit({ contact: { name: 'Sofie', role: 'Toastmaster', phone: '', email: '' } }, { contact: { phone: '20 30 40 50' } });
    expect(config.contact).toEqual({ name: 'Sofie', role: 'Toastmaster', phone: '20 30 40 50', email: '' });
  });
});
