import { NAV, type ScreenId } from '../Shell';
import type { AgentUiAction } from '@/lib/db/types';
import { batchHubCat, batchHubTab } from '@/lib/vendor-batch';
import {
  HUB_CAT_KEY,
  HUB_TAB_KEY,
  isLegacyHubScreen,
  legacyScreenToHub,
  type HubCat,
  type HubTab,
} from '../screens/team/shared';

export type NavigateTarget = ScreenId | 'venues' | 'vendors';

export function navigateToHub(tab: HubTab, cat?: HubCat) {
  sessionStorage.setItem(HUB_TAB_KEY, tab);
  if (cat) sessionStorage.setItem(HUB_CAT_KEY, cat);
}

/** Map legacy screen ids to the unified team hub before navigation. */
export function resolveScreenNavigation(target: NavigateTarget): ScreenId {
  if (isLegacyHubScreen(target)) {
    const { tab, cat } = legacyScreenToHub(target);
    navigateToHub(tab, cat);
    return 'team';
  }
  return target;
}

/**
 * Resolve an agent navigate action to the screen to show, writing the vendor
 * hub deep-link (tab/category) to sessionStorage when the action targets the
 * board. Returns the ScreenId the caller should switch to.
 */
export function agentActionToScreen(action: AgentUiAction): ScreenId {
  if (action.page === 'vendors') {
    const cat = action.vendor_category;
    const tab = action.hub_tab ?? (cat ? batchHubTab(cat) : 'explore');
    navigateToHub(tab, cat ? batchHubCat(cat) : undefined);
    return 'team';
  }
  return action.page;
}

const PAGES = new Set<string>(NAV.map((n) => n.id));

/** The screen a tab reopens on. Old hub ids go to the hub; anything that is
 *  not a page any more (a removed screen, or chat) opens Hjem. */
export function migrateSavedScreen(saved: string | null): ScreenId | null {
  if (!saved) return null;
  if (isLegacyHubScreen(saved)) {
    const { tab, cat } = legacyScreenToHub(saved);
    navigateToHub(tab, cat);
    return 'team';
  }
  return PAGES.has(saved) ? (saved as ScreenId) : null;
}
