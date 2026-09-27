import { describe, it, expect } from 'vitest';
import { parseCardSpec } from './spec';
import { CARD_FORMATS } from './formats';
import { findVibe, starterSpec } from './vibes';

const fallback = starterSpec(findVibe('roser'), CARD_FORMATS[0], 'da');

describe('parseCardSpec', () => {
  it('keeps a good design and clamps what is out of range', () => {
    const spec = parseCardSpec({
      ...fallback,
      palette: { ink: '#112233', accent: 'red', paper: '#FFFFFF' },
      blocks: [{ ...fallback.blocks[1], size: 999, font: 'comic-sans', tracking: 3 }],
    }, fallback);
    expect(spec.palette).toEqual({ ink: '#112233', accent: fallback.palette.accent, paper: '#ffffff' });
    expect(spec.blocks).toHaveLength(1);
    expect(spec.blocks[0]).toMatchObject({ role: 'names', size: 260, font: fallback.blocks[1].font, tracking: 0.5 });
  });

  it('refuses a design without the names, and a text area too small to hold words', () => {
    const spec = parseCardSpec({ blocks: [{ role: 'eyebrow', text: 'Hej' }], textArea: { top: 0.5, bottom: 0.5 } }, fallback);
    expect(spec.blocks).toEqual(fallback.blocks);
    expect(spec.textArea).toEqual(fallback.textArea);
  });

  it('only keeps art from our own storage shape or the shipped samples', () => {
    const ok = 'a3f1c2de-0000-4000-8000-000000000001/b3f1c2de-0000-4000-8000-000000000002/c3f1c2de-0000-4000-8000-000000000003.png';
    expect(parseCardSpec({ ...fallback, art: { path: ok, sample: '/invitations/vibes/roser-5x7.webp' } }, fallback).art.path).toBe(ok);
    const bad = parseCardSpec({ ...fallback, art: { path: 'https://evil.example/x.png', sample: 'javascript:alert(1)' } }, fallback);
    expect(bad.art).toEqual({ path: null, sample: fallback.art.sample });
  });

  it('drops a repeated role and roles it does not know', () => {
    const spec = parseCardSpec({ blocks: [fallback.blocks[1], fallback.blocks[1], { role: 'script' }] }, fallback);
    expect(spec.blocks.map((b) => b.role)).toEqual(['names']);
  });
});
