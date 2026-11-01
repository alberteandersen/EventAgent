/* Juno's guided tour — the script.
 *
 * Four pages and then Juno, not the whole menu: on day one a couple needs to
 * know where the plan is, where the venues are and where the answers land.
 * The rest of the menu explains itself when they get there. Labels come from
 * NAV, so a renamed page is renamed here too.
 *
 * The copy rule, learned the hard way: say what Juno does for them, not what
 * the page is called, and never describe a screen that is empty on day one —
 * which is exactly when the tour runs.
 */

import { NAV, type ScreenId } from './Shell';

/** localStorage key holding the current step index — also the "armed" marker. */
export const WALKTHROUGH_KEY = 'kalas_walkthrough';

/** Set once the couple has finished or skipped. Nothing re-arms past this
 *  except an explicit `?walkthrough=1`, which clears it. Without the marker
 *  the tour only had to be re-armed once by any means — a stale key, a fresh
 *  mount — to start over, and it ran in a ring. */
export const WALKTHROUGH_DONE_KEY = 'kalas_walkthrough_done';

/** localStorage key: whether Juno's panel is open on this device. Onboarding
 *  opens it, so a new couple meets her first. */
export const JUNO_OPEN_KEY = 'kalas_ava_open';

export type WalkthroughStep = {
  id: string;
  /** The page the tour opens for this step. */
  page: ScreenId | null;
  /** Read at a glance, so a headline rather than a paragraph. */
  title: string;
  /** `**bold**` renders through the same RichText as the chat bubbles. */
  body: string;
  /** Overrides the card's eyebrow. Needed now that anchors are page regions
   *  rather than nav items, which used to supply the label. */
  eyebrow?: string;
  /** Opens or puts away Juno's panel as the step opens. Left undefined, it
   *  stays as it is. */
  chat?: boolean;
  /** What to ring, when it should not be the next page's menu button — a
   *  `data-tour` value. Used by the Juno step, where the thing to press is
   *  her button rather than a page. */
  target?: string;
  /** The last step: one button that ends the tour. */
  final?: boolean;
};

/** The pages the tour opens, in order, and what it says about each. */
const TOUR_PAGES: { page: ScreenId; title: string; body: string }[] = [
  {
    page: 'home',
    title: 'Det her er jeres side',
    body: 'Jeres navne, jeres dato og hvor længe der er til — alt hvad I fortalte mig, står allerede her.\n\nJeg holder **Kom godt i gang** opdateret nedenunder, ét skridt ad gangen.',
  },
  {
    page: 'planning',
    title: 'Planen regnes baglæns fra jeres dato',
    body: 'Den lægger sig selv ud, fase for fase, så I altid ved **hvad der haster nu**, og I skal ikke selv finde på punkterne.\n\nOg **Bryllupsdagen** er selve dagen, time for time, når I når dertil.',
  },
  {
    page: 'team',
    title: 'Jeg søger stederne frem for jer',
    body: 'Jeg leder på **det åbne web** og tjekker, at stederne findes. I gemmer dem, I kan lide, som **favoritter**, og jeg skriver til dem for jer.',
  },
  {
    page: 'inbox',
    title: 'Her lander svarene fra stederne',
    body: 'Tom lige nu. Når jeg har skrevet til et sted, samler jeg tråden her, trækker **prisen** ud af mailen og lægger **et forslag til svar** klar. I skal bare godkende det.',
  },
];

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  ...TOUR_PAGES.map(({ page, title, body }): WalkthroughStep => ({
    id: page,
    page,
    eyebrow: NAV.find((n) => n.id === page)?.label,
    title,
    body,
    // Onboarding opens Juno's panel, so without this the tour explains a
    // page from behind it.
    ...(page === 'home' ? { chat: false } : {}),
  })),
  {
    id: 'chat',
    page: 'home',
    eyebrow: 'Juno',
    /* Deliberately does NOT open the panel. The step is about her button, so
       they press it themselves and watch it happen — opening it first would
       leave the ring pointing at a control that was already on, which is the
       exact fault this tour started with. */
    target: 'juno-chat',
    title: 'Alt det her kan I også bare bede om',
    body: 'Hver eneste side I lige har set, kan jeg styre for jer herfra. **Sæt budgettet**, **find et sted**, **tilføj en gæst** — skriv det, som I ville sige det til et menneske, så gør jeg det og viser jer resultatet.\n\nI behøver ikke lære menuen at kende først.',
  },
  {
    id: 'choose',
    page: 'home',
    eyebrow: 'Hjem',
    final: true,
    title: 'Sådan kommer I i gang',
    body: 'Start i **Kom godt i gang** — de næste skridt står der, ét ad gangen, og jeg krydser dem af, efterhånden som I kommer videre.\n\nEr I i tvivl, så spørg mig bare.',
  },
] as const;

/** What onboarding writes to hand the couple over to the tour.
 *
 * Both halves, in one place, because they have to agree: setting the progress
 * key alone was not enough — a done marker from an earlier run outranks it in
 * armTour, so finishing the interview a second time armed nothing and the
 * couple arrived to no tour at all.
 */
export function tourHandoff(): { setProgress: string; clearDone: true } {
  return { setProgress: '0', clearDone: true };
}

/** What the app should do about the tour on load, given what is in storage.
 *
 * Pulled out of KalasRoot so the rule can be proven rather than asserted: the
 * tour kept coming back, and "it should not" was not good enough twice in a
 * row. Pure — the caller does the reading and writing.
 */
export function armTour(input: {
  /** The `walkthrough` query param, if any. */
  param: string | null;
  /** Current value of WALKTHROUGH_KEY. */
  progress: string | null;
  /** Current value of WALKTHROUGH_DONE_KEY. */
  done: string | null;
}): { active: boolean; setProgress?: string; clearDone?: boolean; stripParam?: boolean } {
  // An explicit replay beats everything, and clears the done marker on purpose.
  if (input.param === '1') {
    return { active: true, setProgress: '0', clearDone: true, stripParam: true };
  }
  // Been through it once: never again on its own.
  if (input.done) return { active: false };
  return { active: input.progress !== null };
}
