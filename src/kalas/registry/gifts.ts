/* Shared registry maths. Three surfaces render the same gifts — the couple's
   screen, the token site renderer and the AI site's portal grid, and they
   used to each sort and count their own way. Pure, so it can be imported from
   both src/kalas and src/app without dragging any client state along. */

export type SortableGift = {
  favourite?: boolean | null;
  sort: number;
  created_at: string;
};

/** Favourites ("ønskes mest") first, then the couple's own order, then oldest
 *  first so a tie never reshuffles between renders. `favourite` is optional:
 *  a client running ahead of migration 0022 sees undefined, which reads as
 *  "not starred" — the safe fallback. */
export function sortGifts<T extends SortableGift>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const fav = Number(Boolean(b.favourite)) - Number(Boolean(a.favourite));
    if (fav !== 0) return fav;
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** How many of an item guests have taken. Sums `quantity` rather than counting
 *  rows: a claim may cover more than one, and the two disagree the moment it
 *  does. */
export function claimedCount(claims: { quantity?: number | null }[]): number {
  return claims.reduce((n, c) => n + (c.quantity ?? 1), 0);
}

/** Danish thousands separator, no decimals — gift prices are whole kroner in
 *  practice, and "1.299 DKK" reads better than "1299,00". Null in, null out,
 *  so the caller can leave the price out entirely. */
export function formatPrice(priceCents: number | null | undefined, currency: string): string | null {
  if (priceCents == null || !Number.isFinite(priceCents)) return null;
  const amount = priceCents / 100;
  const rounded = Number.isInteger(amount) ? amount : Math.round(amount * 100) / 100;
  return `${rounded.toLocaleString('da-DK')} ${currency}`;
}

/* Price bands, so a guest can find a gift at the level they had in mind
   instead of scrolling the whole list — the one thing everybody recognises
   from Ønskeskyen. Danish kroner, chosen to match what people actually spend
   on a wedding gift rather than to divide the range evenly. Pure, so both the
   couple's screen and the public site can filter the same way. */
export const PRICE_BANDS = [
  { id: 'all', label: 'Alle', min: null, max: null },
  { id: 'under300', label: 'Under 300 kr', min: null, max: 300_00 },
  { id: '300to800', label: '300–800 kr', min: 300_00, max: 800_00 },
  { id: 'over800', label: 'Over 800 kr', min: 800_00, max: null },
] as const;

/** Does this price fall in the band? A gift with no price shows in "Alle"
 *  only — guessing which band it belongs to would put it in front of the
 *  wrong guest. */
export function inBand(priceCents: number | null | undefined, bandId: string): boolean {
  if (bandId === 'all') return true;
  const band = PRICE_BANDS.find((b) => b.id === bandId);
  if (!band) return true;
  if (priceCents == null || !Number.isFinite(priceCents)) return false;
  if (band.min != null && priceCents < band.min) return false;
  if (band.max != null && priceCents >= band.max) return false;
  return true;
}
