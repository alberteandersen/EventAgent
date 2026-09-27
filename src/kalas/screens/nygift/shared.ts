export type NygiftTab = 'takkeliste' | 'takkekort' | 'album' | 'anmeldelser' | 'del';

const TAB_KEY = 'kalas_nygift_tab';
const TABS: NygiftTab[] = ['takkeliste', 'takkekort', 'album', 'anmeldelser', 'del'];

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
