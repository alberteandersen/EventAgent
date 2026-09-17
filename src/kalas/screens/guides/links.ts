/* How the app and the guide point at each other. Kept apart from the guide
   content so a page header can link to its guide without pulling every
   article into the app's first bundle; the Guides screen loads lazily. */

import type { ScreenId } from '../../Shell';
import type { NavigateTarget } from '../../lib/hub-nav';

/** Fired to open a guide (or "faq") from anywhere in the app. */
export const OPEN_GUIDE_EVENT = 'kalas:open-guide';
const PENDING_KEY = 'kalas_guide';

/** The screen an article's advice is carried out on, and the button that opens it. */
export const GUIDE_ACTION: Record<string, { target: NavigateTarget; label: string }> = {
  'bryllup-tjekliste': { target: 'planning', label: 'Åbn tjeklisten' },
  'hvad-koster-et-bryllup': { target: 'budget', label: 'Åbn budgettet' },
  'saadan-bliver-i-gift': { target: 'planning', label: 'Åbn tjeklisten' },
  'find-bryllupslokale': { target: 'venues', label: 'Find lokaler' },
  'gaesteliste-til-bryllup': { target: 'guests', label: 'Åbn gæstelisten' },
  'save-the-date-og-invitationer': { target: 'invites', label: 'Åbn invitationer' },
  'bordplan-til-bryllup': { target: 'seating', label: 'Åbn bordplanen' },
  'bryllupshjemmeside': { target: 'website', label: 'Åbn hjemmesiden' },
  'program-for-bryllupsdagen': { target: 'planning', label: 'Åbn tidslinjen' },
};

/** The guide a screen's header links to, with a short title for the link. */
export const SCREEN_GUIDE: Partial<Record<ScreenId, { slug: string; title: string }>> = {
  planning: { slug: 'bryllup-tjekliste', title: 'Hvad skal I gøre hvornår?' },
  budget: { slug: 'hvad-koster-et-bryllup', title: 'Hvad koster et bryllup?' },
  team: { slug: 'find-bryllupslokale', title: 'Sådan finder I bryllupslokalet' },
  guests: { slug: 'gaesteliste-til-bryllup', title: 'Gæsteliste til bryllup' },
  seating: { slug: 'bordplan-til-bryllup', title: 'Bordplan til bryllup' },
  invites: { slug: 'save-the-date-og-invitationer', title: 'Save the date og invitationer' },
  website: { slug: 'bryllupshjemmeside', title: 'Hvad skal stå på hjemmesiden?' },
};

/** Opens the Guides screen on `slug` (an article, or "faq"). The slug waits in
    sessionStorage for a screen that has not mounted yet; the event reaches one
    that has, and tells the app to switch to it. */
export function openGuide(slug: string) {
  try { sessionStorage.setItem(PENDING_KEY, slug); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: slug }));
}

/** Read without clearing: safe in a state initializer, which React may run twice. */
export function peekPendingGuide(): string | null {
  try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; }
}

export function takePendingGuide(): string | null {
  try {
    const slug = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return slug;
  } catch {
    return null;
  }
}
