import { describe, it, expect } from 'vitest';
import { venueCardImage } from './venueImage';

const FALLBACK = 'stock.jpg';
const v = (over: Partial<Parameters<typeof venueCardImage>[0][number]>) => ({
  id: 'a', category: 'venue' as const, swipe_status: 'liked' as const,
  image_url: null, photo_urls: [], ...over,
});

describe('venueCardImage', () => {
  it('falls back when they have no venues at all', () => {
    expect(venueCardImage([], null, FALLBACK)).toBe(FALLBACK);
  });

  it('shows the venue they chose, over any they merely liked', () => {
    const venues = [
      v({ id: 'liked', photo_urls: ['liked.jpg'] }),
      v({ id: 'chosen', photo_urls: ['chosen.jpg'] }),
    ];
    expect(venueCardImage(venues, 'chosen', FALLBACK)).toBe('chosen.jpg');
  });

  it('falls through to a liked venue when the chosen one has no photo', () => {
    const venues = [
      v({ id: 'chosen', photo_urls: [] }),
      v({ id: 'liked', photo_urls: ['liked.jpg'] }),
    ];
    expect(venueCardImage(venues, 'chosen', FALLBACK)).toBe('liked.jpg');
  });

  it('never shows a venue they swiped away', () => {
    // A place they rejected, on the card asking them to find one, would be
    // worse than a stock photo.
    const venues = [v({ swipe_status: 'rejected', photo_urls: ['no.jpg'] })];
    expect(venueCardImage(venues, null, FALLBACK)).toBe(FALLBACK);
  });

  it('ignores vendors — this card is about the venue', () => {
    const venues = [v({ category: 'photographer', photo_urls: ['photographer.jpg'] })];
    expect(venueCardImage(venues, null, FALLBACK)).toBe(FALLBACK);
  });

  it('takes image_url when there are no photo_urls', () => {
    expect(venueCardImage([v({ image_url: 'single.jpg' })], null, FALLBACK)).toBe('single.jpg');
  });

  it('skips blanks rather than rendering an empty background', () => {
    const venues = [v({ photo_urls: ['', '  ', 'real.jpg'] })];
    expect(venueCardImage(venues, null, FALLBACK)).toBe('real.jpg');
  });

  it('falls back when a chosen id matches nothing', () => {
    expect(venueCardImage([v({ id: 'x', photo_urls: [] })], 'gone', FALLBACK)).toBe(FALLBACK);
  });
});
