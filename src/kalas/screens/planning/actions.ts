/* Carrying out a MILESTONE_ACTIONS entry: open the screen (and the vendor
   hub's tab and category, when it is the hub), or the guide. Shared by the
   timeline's rows and the Overblik tab. */

import type { ScreenId } from '../../Shell';
import { navigateToHub } from '../../lib/hub-nav';
import { openGuide } from '../guides/links';
import type { MilestoneAction } from './shared';

export function runMilestoneAction(act: MilestoneAction, onNavigate?: (s: ScreenId) => void) {
  if (act.kind === 'guide') { openGuide(act.slug); return; }
  if (act.hub) navigateToHub(act.hub.tab, act.hub.cat);
  onNavigate?.(act.screen);
}

/** Whether the action can be taken here: a guide always, a screen only when
 *  the host can navigate. */
export function canRun(act: MilestoneAction | undefined, onNavigate?: (s: ScreenId) => void): act is MilestoneAction {
  return !!act && (act.kind === 'guide' || !!onNavigate);
}
