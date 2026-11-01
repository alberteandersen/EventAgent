/* How the app points at the guide. The guide itself is public, on the
   website under /guide; the app only links to it, so no article is part of
   the app's bundle. */

import type { ScreenId } from '../../Shell';

/** The guide's front page, with every article and the FAQ. */
export const GUIDE_HUB_HREF = '/guide';

/** An article's page on the website. */
export const guideHref = (slug: string) => `${GUIDE_HUB_HREF}/${slug}`;

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

/** Opens an article beside the app, so the couple keeps their place in it. */
export function openGuide(slug: string) {
  window.open(guideHref(slug), '_blank', 'noopener');
}
