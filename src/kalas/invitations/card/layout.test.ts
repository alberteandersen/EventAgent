import { describe, it, expect } from 'vitest';
import { layoutCard, type Measure, type TextItem } from './layout';
import { CARD_FORMATS, cardHeight } from './formats';
import { CARD_VIBES, findVibe, starterSpec } from './vibes';
import { parseInviteContent } from '../content';

// Every glyph half an em wide: close enough to real faces to test the rules.
const measure: Measure = (text, f) => [...text].length * f.size * 0.5;

const content = parseInviteContent({
  partnerA: 'Samira', partnerB: 'Rufus', date: '2027-06-12', time: '14:00',
  venue: 'Broholm Slot', venueDetail: 'Gudme, Fyn', rsvpBy: '2027-04-01', language: 'da',
});
const portrait = CARD_FORMATS[0];
const texts = (roles: string[], l: ReturnType<typeof layoutCard>) =>
  l.blocks.filter((b) => roles.includes(b.role)).flatMap((b) => b.items).filter((i): i is TextItem => i.kind === 'text').map((i) => i.text);

describe('layoutCard', () => {
  it('sets the facts from the content, not from the design', () => {
    const l = layoutCard(starterSpec(findVibe('akvarel'), portrait, 'da'), content, measure);
    expect(texts(['names'], l)).toEqual(['Samira & Rufus']);
    expect(texts(['venue'], l)).toEqual(['BROHOLM SLOT', 'GUDME, FYN']);
    // The date row: month, day, year, weekday, time.
    expect(texts(['dateRow'], l)).toEqual(['JUNI', '12', '2027', 'LØRDAG', 'KL. 14:00']);
  });

  it('keeps the time when the design sets the date on one line', () => {
    const base = starterSpec(findVibe('akvarel'), portrait, 'da');
    const spec = { ...base, blocks: base.blocks.map((b) => (b.role === 'dateRow' ? { ...b, role: 'date' as const, caps: false, size: 28 } : b)) };
    const l = layoutCard(spec, content, measure);
    expect(texts(['date'], l).map((t) => t.replace(/\u00a0/g, ' '))).toEqual(['Lørdag · den 12. juni 2027', 'KL. 14:00']); // the time in the block's supporting style
  });

  it('sets the classic and playful vibes the way their references do', () => {
    const at = (vibe: string) => layoutCard(starterSpec(findVibe(vibe), portrait, 'da'), content, measure);
    // Medaljon: "+" between the names, the date without its weekday.
    expect(texts(['names'], at('medaljon'))).toEqual(['Samira + Rufus']);
    expect(texts(['date'], at('medaljon'))).toEqual(['12. JUNI 2027', 'kl. 14:00']);
    // Håndtegnet fest: all lowercase, "og" between the names, hearts as the divider.
    expect(texts(['names'], at('fest'))).toEqual(['samira og rufus']);
    expect(texts(['divider'], at('fest'))).toEqual(['♥ ♥']);
    // Bølgeramme: the date in numbers, "+" in its own face between stacked names.
    expect(texts(['date'], at('bolge'))).toEqual(['12.06.27', 'KL. 14:00']);
    const names = at('bolge').blocks.find((b) => b.role === 'names')!.items as TextItem[];
    expect(names.map((n) => n.text)).toEqual(['Samira', '+', 'Rufus']);
    expect(names[1].family).toBe('Quicksand');
    // Ren typografi: names in capitals, a script "og" between them.
    const ren = at('ren').blocks.find((b) => b.role === 'names')!.items as TextItem[];
    expect(ren.map((n) => [n.text, n.family])).toEqual([['SAMIRA', 'Cormorant Garamond'], ['og', 'Great Vibes'], ['RUFUS', 'Cormorant Garamond']]);
  });

  it('sets a left-aligned vibe flush against the left of its text area', () => {
    const spec = starterSpec(findVibe('valmue'), portrait, 'da');
    const l = layoutCard(spec, content, measure);
    const items = l.blocks.flatMap((b) => b.items).filter((i): i is TextItem => i.kind === 'text');
    expect(items.every((i) => i.anchor === 'start' && Math.abs(i.box.x - spec.textArea.left * 1000) < 0.01)).toBe(true);
  });

  it("keeps a frame for the couple's photo before they have picked one", () => {
    const l = layoutCard(starterSpec(findVibe('foto'), portrait, 'da'), content, measure);
    const photo = l.blocks.find((b) => b.role === 'photo')!.items[0];
    expect(photo).toMatchObject({ kind: 'photo', tone: 'bw', tape: true });
    if (photo.kind === 'photo') expect(photo.w / photo.h).toBeCloseTo(1.08);
  });

  it("uses the couple's own wording over the design's", () => {
    const l = layoutCard(starterSpec(findVibe('akvarel'), portrait, 'da'), content, measure, { closing: 'Middag og dans' });
    expect(texts(['closing'], l)).toEqual(['Middag og dans']);
  });

  it('leaves out blocks with nothing to say', () => {
    const bare = parseInviteContent({ partnerA: 'Anna', partnerB: 'Emil', language: 'da' });
    const l = layoutCard(starterSpec(findVibe('akvarel'), portrait, 'da'), bare, measure);
    expect(l.blocks.map((b) => b.role)).toEqual(['eyebrow', 'names', 'invite', 'closing']);
  });

  it('keeps every line inside the text area, in every vibe and format', () => {
    const long = { ...content, partnerA: 'Christoffer Alexander', partnerB: 'Anne-Katrine Marie', note: 'Dresscode: festligt. Vi danser til den lyse morgen, og der er natmad klokken to.' };
    for (const vibe of CARD_VIBES) {
      for (const format of CARD_FORMATS) {
        const spec = starterSpec(vibe, format, 'da');
        const l = layoutCard(spec, long, measure);
        const h = cardHeight(format);
        const area = { l: spec.textArea.left * 1000, r: (1 - spec.textArea.right) * 1000, t: spec.textArea.top * h, b: (1 - spec.textArea.bottom) * h };
        for (const item of l.blocks.flatMap((b) => b.items)) {
          if (item.kind !== 'text') continue;
          expect(item.box.x, `${vibe.id} ${format.id} "${item.text}"`).toBeGreaterThanOrEqual(area.l - 1);
          expect(item.box.x + item.box.w, `${vibe.id} ${format.id} "${item.text}"`).toBeLessThanOrEqual(area.r + 1);
          expect(item.box.y, `${vibe.id} ${format.id}`).toBeGreaterThanOrEqual(area.t - 1);
          expect(item.box.y + item.box.h, `${vibe.id} ${format.id}`).toBeLessThanOrEqual(area.b + 1);
        }
      }
    }
  });

  it('shrinks names to their line, and stacks them when that would be too small', () => {
    const spec = starterSpec(findVibe('akvarel'), portrait, 'da');
    const fits = layoutCard(spec, { ...content, partnerA: 'Christoffer', partnerB: 'Anna' }, measure);
    expect(texts(['names'], fits)).toEqual(['Christoffer & Anna']);
    const stacks = layoutCard(spec, { ...content, partnerA: 'Christoffer Alexander', partnerB: 'Anne-Katrine' }, measure);
    expect(texts(['names'], stacks)).toEqual(['Christoffer Alexander', '&', 'Anne-Katrine']);
  });
});
