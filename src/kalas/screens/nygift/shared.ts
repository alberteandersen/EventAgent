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
