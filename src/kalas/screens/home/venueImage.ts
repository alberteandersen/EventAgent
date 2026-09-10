/* The picture on the "Find jeres venue" card.
 *
 * It used to be one fixed stock photo of an American ballroom — chandeliers
 * and gold chiavari chairs — on a card inviting a Danish couple to find a
 * place that matches their mood. Once they have chosen or shortlisted
 * somewhere, the card shows that instead: their own wedding, like the rest of
 * the screen.
 *
 * Pure so the precedence can be tested without a browser.
 */

import type { VenueRow } from '@/lib/db/types';

type VenueLike = Pick<VenueRow, 'id' | 'category' | 'swipe_status' | 'image_url' | 'photo_urls'>;

/** The first usable photo on a venue row, whichever field carries it. */
function photoOf(v: VenueLike): string | null {
  const first = Array.isArray(v.photo_urls)
    ? v.photo_urls.find((u): u is string => typeof u === 'string' && u.trim() !== '')
    : undefined;
  return first ?? (v.image_url?.trim() ? v.image_url : null);
}

/**
 * The venue they picked wins; otherwise the first one they liked. A rejected
 * venue never shows — putting a place they swiped away on the card inviting
 * them to find one would be worse than a stock photo.
 */
export function venueCardImage(
  venues: VenueLike[],
  chosenVenueId: string | null | undefined,
  fallback: string,
): string {
  const isVenue = (v: VenueLike) => v.category === 'venue';

  if (chosenVenueId) {
    const chosen = venues.find((v) => v.id === chosenVenueId);
    const photo = chosen && photoOf(chosen);
    if (photo) return photo;
  }

  for (const v of venues) {
    if (!isVenue(v) || v.swipe_status !== 'liked') continue;
    const photo = photoOf(v);
    if (photo) return photo;
  }

  return fallback;
}
