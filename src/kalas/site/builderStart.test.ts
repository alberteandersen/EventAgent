import { describe, expect, it } from 'vitest';
import { builderStart, OLD_DEADLINE, OLD_STORY, OLD_TRANSPORT } from './builderStart';
import { INIT_PROGRAM } from './config';
import type { DayProgramItemRow, VenueRow, WeddingSiteRow } from '@/lib/db/types';

const venue = { id: 'v1', name: 'Hindsgavl Slot', address: 'Hindsgavl Allé 7, 5500 Middelfart' } as VenueRow;
const day = [
  { id: 'b', time: '18:30:00', title: 'Middag', subtitle: 'Riddersalen' },
  { id: 'a', time: '15:00', title: 'Vielse', subtitle: null },
] as DayProgramItemRow[];
const site = (config: Record<string, unknown>): WeddingSiteRow =>
  ({ domain: 'emma-frederik', published: true, config } as unknown as WeddingSiteRow);

describe('builderStart', () => {
  it('starts a new site from the venue and Bryllupsdagen, and invents nothing', () => {
    const s = builderStart({ site: null, venue, dayProgram: day });
    expect(s.transport).toBe('Hindsgavl Slot, Hindsgavl Allé 7, 5500 Middelfart');
    expect(s.program).toEqual([
      { id: 'd-a', time: '15:00', label: 'Vielse', sublabel: '' },
      { id: 'd-b', time: '18:30', label: 'Middag', sublabel: 'Riddersalen' },
    ]);
    expect(s.storyText).toBe('');
    expect(s.rsvpDeadline).toBe('');
    expect(s.domain).toBeNull();
  });

  it('falls back to the example programme without a Bryllupsdagen', () => {
    expect(builderStart({ site: null, venue: null, dayProgram: [] }).program).toBe(INIT_PROGRAM);
  });

  it('keeps what the couple saved, including an empty programme', () => {
    const s = builderStart({ site: site({ storyText: 'Vi mødtes i Aarhus.', program: [], transport: 'Kirken' }), venue, dayProgram: day });
    expect(s.storyText).toBe('Vi mødtes i Aarhus.');
    expect(s.program).toEqual([]);
    expect(s.transport).toBe('Kirken');
    expect(s.domain).toBe('emma-frederik');
    expect(s.published).toBe(true);
  });

  it('reads the old placeholders as never filled in', () => {
    const s = builderStart({
      site: site({ storyText: `${OLD_STORY} Den 1. juni siger vi ja.`, transport: OLD_TRANSPORT, rsvpDeadline: OLD_DEADLINE }),
      venue, dayProgram: [],
    });
    expect(s.storyText).toBe('');
    expect(s.transport).toBe('Hindsgavl Slot, Hindsgavl Allé 7, 5500 Middelfart');
    expect(s.rsvpDeadline).toBe('');
  });
});

describe('stableJson', () => {
  it('reads reordered keys as the same content, and changed values as not', async () => {
    const { stableJson } = await import('./builderStart');
    expect(stableJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'x' } })).toBe(stableJson({ a: { c: 'x', d: [1, { x: 1, y: 2 }] }, b: 1 }));
    expect(stableJson({ a: [1, 2] })).not.toBe(stableJson({ a: [2, 1] }));
  });
});
