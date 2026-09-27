import type { EmailReplyRow, OutboundEmailRow, VenueRow } from '@/lib/db/types';

export type HubTab = 'explore' | 'shortlist' | 'booked';

export type HubCat =
  | 'venue'
  | 'overnatning'
  | 'fotografi'
  | 'video'
  | 'blomster'
  | 'catering'
  | 'bar'
  | 'kage'
  | 'musik'
  | 'beauty';

export const HUB_TAB_KEY = 'kalas_hub_tab';
export const HUB_CAT_KEY = 'kalas_hub_cat';

export const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'shortlist', label: 'Favoritter' },
  { id: 'booked', label: 'Booked' },
];

export const HUB_CATS: { id: HubCat; label: string }[] = [
  { id: 'venue', label: 'Venue' },
  { id: 'overnatning', label: 'Overnatning' },
  { id: 'fotografi', label: 'Foto' },
  { id: 'video', label: 'Video' },
  { id: 'blomster', label: 'Blomster' },
  { id: 'catering', label: 'Catering' },
  { id: 'bar', label: 'Bar & Drinks' },
  { id: 'kage', label: 'Bryllupskage' },
  { id: 'musik', label: 'Musik' },
  { id: 'beauty', label: 'Beauty' },
];

const HUB_CAT_IDS = new Set<string>(HUB_CATS.map((c) => c.id));

export function isHubCat(value: string | null | undefined): value is HubCat {
  return Boolean(value && HUB_CAT_IDS.has(value));
}

const LEGACY_SCREENS = new Set(['venues', 'vendors']);

export function isLegacyHubScreen(id: string): id is 'venues' | 'vendors' {
  return LEGACY_SCREENS.has(id);
}

export function readHubDeepLink(): { tab?: HubTab; cat?: HubCat } {
  if (typeof window === 'undefined') return {};
  const rawTab = sessionStorage.getItem(HUB_TAB_KEY);
  const rawCat = sessionStorage.getItem(HUB_CAT_KEY);
  if (rawTab) sessionStorage.removeItem(HUB_TAB_KEY);
  if (rawCat) sessionStorage.removeItem(HUB_CAT_KEY);

  // Inbox left the hub — ignore stale deep-links.
  const tab = (rawTab === 'explore' || rawTab === 'shortlist' || rawTab === 'booked')
    ? rawTab
    : undefined;
  const cat = isHubCat(rawCat) ? rawCat : undefined;
  return { tab, cat };
}

export function legacyScreenToHub(screen: 'venues' | 'vendors'): { tab: HubTab; cat?: HubCat } {
  switch (screen) {
    case 'venues':
      return { tab: 'explore', cat: 'venue' };
    case 'vendors':
      return { tab: 'explore', cat: 'fotografi' };
  }
}

export function resolveDefaultTab(
  venues: VenueRow[],
  outbound: OutboundEmailRow[],
  _replies: EmailReplyRow[],
  eventChosenVenueId: string | null | undefined,
): HubTab {
  const sentIds = new Set(outbound.map((o) => o.venue_id));
  const likedNotContacted = venues.some((v) => v.swipe_status === 'liked' && !sentIds.has(v.id));
  const contactedUnbooked = venues.some(
    (v) => sentIds.has(v.id) && !v.booked_at && v.id !== eventChosenVenueId,
  );
  if (likedNotContacted || contactedUnbooked) return 'shortlist';

  const bookedCount = venues.filter((v) => v.booked_at || v.id === eventChosenVenueId).length;
  if (bookedCount > 0) return 'booked';

  return 'explore';
}

export function hubBadges(
  venues: VenueRow[],
  outbound: OutboundEmailRow[],
  _replies: EmailReplyRow[],
  eventChosenVenueId: string | null | undefined,
): Partial<Record<HubTab, number>> {
  const sentIds = new Set(outbound.map((o) => o.venue_id));
  const shortlist = venues.filter((v) => v.swipe_status === 'liked' && !sentIds.has(v.id)).length;
  const booked = venues.filter((v) => v.booked_at || v.id === eventChosenVenueId).length;
  return {
    shortlist: shortlist || undefined,
    booked: booked || undefined,
  };
}

export function matchesHubCat(row: VenueRow, cat: HubCat): boolean {
  if (cat === 'venue') return row.category === 'venue';
  const map: Partial<Record<HubCat, string>> = {
    overnatning: 'accommodation',
    fotografi: 'photographer',
    blomster: 'florist',
    catering: 'caterer',
    musik: 'musician',
  };
  const backend = map[cat];
  if (backend) return row.category === backend;
  if (cat === 'video') return row.category === 'photographer';
  return row.category !== 'venue';
}
