/* Where a couple goes to see what a honeymoon hotel actually costs.
 *
 * Deliberately deep links, not integrations. Booking.com, Momondo and the rest
 * gate live prices behind partner agreements and API keys nobody has yet, and a
 * search URL built from the hotel's own name gets the couple to the same page
 * today with nothing to sign. If those agreements ever land, only this file
 * changes — the cards call `providerLinks()` and know nothing about who is on
 * the other end.
 *
 * Pure and dependency-free so the URL building can be tested without a browser.
 */

export type ProviderId = 'booking' | 'google';

export interface ProviderLink {
  id: ProviderId;
  /** Shown on the button. Danish is the source string; t() translates it. */
  label: string;
  url: string;
}

export interface HotelQuery {
  name: string;
  /** "Santorini, Grækenland" — narrows a name that exists in ten countries. */
  location?: string | null;
  /** ISO dates. Both or neither; a one-sided range is not a stay. */
  checkIn?: string | null;
  checkOut?: string | null;
  /** Danish couples get the Danish storefronts. */
  lang?: 'da' | 'en';
}

/** The search phrase: the hotel, plus where it is when that adds anything. */
function phrase({ name, location }: HotelQuery): string {
  const n = name.trim();
  const l = (location ?? '').trim();
  // "Katikies Santorini" in "Santorini, Greece" should not become
  // "Katikies Santorini Santorini, Greece".
  if (!l || n.toLowerCase().includes(l.split(',')[0].trim().toLowerCase())) return n;
  return `${n}, ${l}`;
}

/** Both dates, or neither — Booking ignores a half-open range anyway. */
function stay(q: HotelQuery): { checkin: string; checkout: string } | null {
  const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(q.checkIn) || !isDate(q.checkOut)) return null;
  if (q.checkOut <= q.checkIn) return null;
  return { checkin: q.checkIn, checkout: q.checkOut };
}

export function providerLinks(q: HotelQuery): ProviderLink[] {
  const search = phrase(q);
  const da = (q.lang ?? 'da') === 'da';
  const nights = stay(q);

  const booking = new URL('https://www.booking.com/searchresults.html');
  booking.searchParams.set('ss', search);
  booking.searchParams.set('lang', da ? 'da' : 'en-gb');
  if (nights) {
    booking.searchParams.set('checkin', nights.checkin);
    booking.searchParams.set('checkout', nights.checkout);
    booking.searchParams.set('group_adults', '2');
    booking.searchParams.set('no_rooms', '1');
  }

  /* Momondo was here and is not any more: every path shape I could build for
     it either redirected to /stays with the search dropped or 404'd, and a
     button that quietly loses what the couple was looking at is worse than one
     button fewer. Its deep-link format is not documented; add it back when
     there is a partner agreement and a URL that can be verified. */
  const google = new URL('https://www.google.com/search');
  google.searchParams.set('q', `${search} hotel`);
  google.searchParams.set('hl', da ? 'da' : 'en');

  return [
    { id: 'booking', label: 'Se priser på Booking', url: booking.toString() },
    { id: 'google', label: 'Søg på Google', url: google.toString() },
  ];
}
