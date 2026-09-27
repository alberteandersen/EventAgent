export type NygiftTab = 'takkeliste' | 'takkekort' | 'album' | 'del';

const TAB_KEY = 'kalas_nygift_tab';
const TABS: NygiftTab[] = ['takkeliste', 'takkekort', 'album', 'del'];

export function readNygiftTab(): NygiftTab {
  if (typeof window === 'undefined') return 'takkeliste';
  const saved = sessionStorage.getItem(TAB_KEY);
  return TABS.includes(saved as NygiftTab) ? (saved as NygiftTab) : 'takkeliste';
}

export function writeNygiftTab(tab: NygiftTab) {
  if (typeof window !== 'undefined') sessionStorage.setItem(TAB_KEY, tab);
}

/** Whole days since the wedding, or null before it (or with no date set). */
export function daysMarried(iso: string | null | undefined, today = new Date()): number | null {
  const day = iso?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((now - then) / 86_400_000);
  return days >= 0 ? days : null;
}

/** How long before the day Nygift joins the menu: the guest album's QR code
 *  and the thank-you list are worth finding in the last week. */
export const NYGIFT_LEAD_DAYS = 7;

/** Whether Nygift belongs in the menu yet. Only with an exact date, and from
 *  a week before it: while the date is a season or undecided, the wedding is
 *  still ahead, and a page for after it is one more thing on the list. */
export function nygiftInMenu(iso: string | null | undefined, today = new Date()): boolean {
  const day = iso?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return (then - now) / 86_400_000 <= NYGIFT_LEAD_DAYS;
}
