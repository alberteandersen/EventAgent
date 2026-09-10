import { describe, it, expect } from 'vitest';
import { buildIcs } from './ics';

const NOW = new Date('2026-09-07T10:30:00Z');
const base = { uid: 'wedding-abc@kalas', title: 'Alberte & Espens bryllup', dateISO: '2027-06-06', now: NOW };

/** The unfolded body, so assertions read like the file does. */
const lines = (ics: string) => ics.split('\r\n');

describe('buildIcs', () => {
  it('wraps a single VEVENT and terminates every line with CRLF', () => {
    const ics = buildIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lines(ics)).toContain('BEGIN:VEVENT');
    expect(lines(ics)).toContain('DTSTAMP:20260907T103000Z');
  });

  it('makes an all-day entry when there is no start time', () => {
    const l = lines(buildIcs(base));
    expect(l).toContain('DTSTART;VALUE=DATE:20270606');
    // All-day DTEND is exclusive, so it is the following day.
    expect(l).toContain('DTEND;VALUE=DATE:20270607');
  });

  it('uses floating local time when a start time is given', () => {
    const l = lines(buildIcs({ ...base, startTime: '14:00', endTime: '23:00' }));
    // No trailing Z and no TZID: "14:00" means 14:00 where the wedding is.
    expect(l).toContain('DTSTART:20270606T140000');
    expect(l).toContain('DTEND:20270606T230000');
  });

  it('rolls an end time past midnight onto the next day', () => {
    const l = lines(buildIcs({ ...base, startTime: '14:00', endTime: '02:00' }));
    expect(l).toContain('DTEND:20270607T020000');
  });

  it('gives a five-hour default when only the start is known', () => {
    const l = lines(buildIcs({ ...base, startTime: '14:00' }));
    expect(l).toContain('DTEND:20270606T190000');
  });

  it('falls back to all-day when the time cannot be parsed', () => {
    for (const bad of ['eftermiddag', '25:00', '14:99', '']) {
      const l = lines(buildIcs({ ...base, startTime: bad }));
      expect(l).toContain('DTSTART;VALUE=DATE:20270606');
    }
  });

  it('escapes the characters that would otherwise break the file', () => {
    const ics = buildIcs({
      ...base,
      location: 'Broholm Slot, Gudme; Fyn',
      description: 'Vielse kl. 14\nFest bagefter',
    });
    expect(ics).toContain('LOCATION:Broholm Slot\\, Gudme\\; Fyn');
    expect(ics).toContain('DESCRIPTION:Vielse kl. 14\\nFest bagefter');
  });

  it('folds a long line and continues it with a leading space', () => {
    const long = 'Broholm Slot, '.repeat(12);
    const l = lines(buildIcs({ ...base, location: long }));
    const folded = l.filter((x) => x.startsWith(' '));
    expect(folded.length).toBeGreaterThan(0);
    // No content line may exceed 75 octets.
    for (const line of l) expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
  });

  it('keeps multi-byte characters whole across a fold', () => {
    const ics = buildIcs({ ...base, location: `Rådhuspladsen æøå ${'ø'.repeat(80)}` });
    // A split inside a UTF-8 sequence would leave a replacement character.
    expect(ics).not.toContain('�');
  });

  it('omits the optional fields it was not given', () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('URL:');
  });
});
