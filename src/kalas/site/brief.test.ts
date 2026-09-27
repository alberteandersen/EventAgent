import { describe, expect, it } from 'vitest';
import { BRIEF_IDEAS, hasIdea, toggleIdea } from './brief';

describe('toggleIdea, the ideas above the brief box', () => {
  it('starts an empty brief with the idea as written', () => {
    expect(toggleIdea('', 'Varme farver')).toBe('Varme farver');
    expect(toggleIdea('  \n', 'Varme farver')).toBe('Varme farver');
  });

  it('adds later ideas as the next item in the list', () => {
    expect(toggleIdea('Varme farver', 'Store billeder af os')).toBe('Varme farver, store billeder af os');
    expect(toggleIdea('Varme farver, ', 'Store billeder af os')).toBe('Varme farver, store billeder af os');
  });

  it('starts a new sentence after a full stop, and follows a colon', () => {
    expect(toggleIdea('Vi elsker grønt.', 'Store billeder af os')).toBe('Vi elsker grønt. Store billeder af os');
    expect(toggleIdea('Vores ønsker:', 'Store billeder af os')).toBe('Vores ønsker: store billeder af os');
  });

  it('takes an idea back out and leaves the rest of the brief alone', () => {
    expect(toggleIdea('Varme farver, store billeder af os, lidt humor i teksterne', 'Store billeder af os'))
      .toBe('Varme farver, lidt humor i teksterne');
    expect(toggleIdea('Store billeder af os, lidt humor i teksterne', 'Store billeder af os'))
      .toBe('Lidt humor i teksterne');
    expect(toggleIdea('Vi elsker grønt. Store billeder af os, lidt humor i teksterne', 'Store billeder af os'))
      .toBe('Vi elsker grønt. Lidt humor i teksterne');
    expect(toggleIdea('Varme farver, store billeder af os. Vi elsker grønt', 'Store billeder af os'))
      .toBe('Varme farver. Vi elsker grønt');
  });

  it('gives back what they had when an idea is tapped twice', () => {
    const starts = ['', 'Vi elsker grønt', 'Vi elsker grønt.', 'Vores ønsker:', 'Lyse farver\nIngen guld'];
    for (const start of starts) {
      for (const idea of BRIEF_IDEAS) {
        expect(toggleIdea(toggleIdea(start, idea), idea)).toBe(start);
      }
    }
  });
});

describe('hasIdea', () => {
  it('lights up for an idea that is its own item, in any case', () => {
    expect(hasIdea('Varme farver, STORE BILLEDER AF OS', 'Store billeder af os')).toBe(true);
    expect(hasIdea('Vi elsker grønt. Store billeder af os!', 'Store billeder af os')).toBe(true);
  });

  it('stays off when the words sit inside a sentence of their own', () => {
    expect(hasIdea('Vi vil have store billeder af os to', 'Store billeder af os')).toBe(false);
  });

  it('lights up once tapped, for every idea', () => {
    for (const idea of BRIEF_IDEAS) {
      expect(hasIdea(toggleIdea('Vi elsker grønt.', idea), idea)).toBe(true);
      expect(hasIdea(toggleIdea('Lyse farver', idea), idea)).toBe(true);
    }
  });

  it('keeps every idea free of separators, which is how they are read back', () => {
    for (const idea of BRIEF_IDEAS) expect(idea).not.toMatch(/[,.;:!?\n]/);
  });
});
