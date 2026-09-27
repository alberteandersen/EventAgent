import { describe, expect, it } from 'vitest';
import { draftPrompt, factsText, mergeFaqDraft, readDraft, type DraftFacts } from './draft';

const facts: DraftFacts = {
  names: 'Emma & Frederik', dateLabel: '11. september 2027', season: 'efterår', venue: 'Hindsgavl Slot, Middelfart',
  region: 'Fyn', guestCount: 80, style: 'Rustik elegance',
  program: [{ time: '15:00', title: 'Vielse', place: 'Slotskapellet' }],
  rsvpDeadline: '1. juni 2027', transport: '', dresscode: '', hotels: [], contact: '', hasRegistry: false, giftsText: '',
  language: 'da',
};

describe('factsText', () => {
  it('marks what Kalas does not know, so Ava leaves it alone', () => {
    const text = factsText(facts);
    expect(text).toContain('- Sted: Hindsgavl Slot, Middelfart');
    expect(text).toContain('  15:00 Vielse, Slotskapellet');
    expect(text).toContain('- Adresse/transport: (ikke oplyst)');
    expect(text).toContain('- Ønskeliste på siden: (ikke oplyst)');
  });
});

describe('draftPrompt', () => {
  it('writes the story from their answers only', () => {
    const { user } = draftPrompt('story', facts, { story: { met: 'På Roskilde Festival' } });
    expect(user).toContain('Hvordan de mødtes: På Roskilde Festival');
    expect(user).toContain('Hvornår de vidste det: (ikke oplyst)');
  });

  it('lists their FAQ with ids and switches language', () => {
    const { user, system } = draftPrompt('faq', { ...facts, language: 'en' }, { faq: [{ id: 'f1', q: 'Parkering?', a: '' }, { id: 'f2', q: '', a: '' }] });
    expect(user).toContain('f1: Parkering? = (intet svar)');
    expect(user).not.toContain('f2:');
    expect(system).toContain('engelsk');
  });
});

describe('readDraft', () => {
  it('keeps a trimmed text and drops an empty one', () => {
    expect(readDraft('heroTagline', { text: '  Kom og fejr os  ' })).toEqual({ text: 'Kom og fejr os' });
    expect(readDraft('story', { text: '' })).toEqual({});
    expect(readDraft('story', null)).toEqual({});
  });

  it('keeps answers for known ids and new questions, and drops the rest', () => {
    const out = readDraft('faq', { faq: [
      { id: 'f1', q: 'Parkering?', a: 'Ved slottet.' },
      { id: 'zz', q: '', a: 'Et svar uden spørgsmål' },
      { q: 'Hvornår skal vi svare?', a: 'Senest 1. juni 2027.' },
      { q: 'Må børn komme?', a: '' },
    ] }, ['f1']);
    expect(out.faq).toEqual([
      { id: 'f1', q: 'Parkering?', a: 'Ved slottet.' },
      { q: 'Hvornår skal vi svare?', a: 'Senest 1. juni 2027.' },
    ]);
  });
});

describe('mergeFaqDraft', () => {
  it('fills blanks, adds new questions once, and never replaces their words', () => {
    const current = [
      { id: 'f1', q: 'Parkering?', a: '' },
      { id: 'f2', q: 'Dresscode?', a: 'Festligt' },
    ];
    const merged = mergeFaqDraft(current, [
      { id: 'f1', q: 'Parkering?', a: 'Ved slottet.' },
      { id: 'f2', q: 'Dresscode?', a: 'Noget andet' },
      { q: 'dresscode?', a: 'Dublet' },
      { q: 'Hvornår skal vi svare?', a: 'Senest 1. juni.' },
    ], (i) => `new${i}`);
    expect(merged).toEqual([
      { id: 'f1', q: 'Parkering?', a: 'Ved slottet.' },
      { id: 'f2', q: 'Dresscode?', a: 'Festligt' },
      { id: 'new0', q: 'Hvornår skal vi svare?', a: 'Senest 1. juni.' },
    ]);
  });
});
