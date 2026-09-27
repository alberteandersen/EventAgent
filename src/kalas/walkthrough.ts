/* Ava's guided tour — the script.
 *
 * One step per page, walked down the sidebar in the order the menu itself
 * lists them. The order is not written here: it is derived from NAV, so the
 * two cannot drift apart and a new menu entry cannot be silently skipped.
 * What lives here is the only thing NAV does not know — what to say about
 * each page.
 *
 * The copy rule, learned the hard way: say what Ava does for them, not what
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
  /** Forces chat open or closed as the step opens. Left undefined, the
   *  couple's current mode stands. */
  chat?: boolean;
  /** What to ring, when it should not be the next page's menu button — a
   *  `data-tour` value. Used by the chat step, where the thing to press is
   *  the mode switch rather than a page. */
  target?: string;
  /** Renders the chat-vs-classic choice, and ends the tour. */
  final?: boolean;
};

/** What to say about each page. Keyed by ScreenId; the order comes from NAV.
 *  A page with no entry gets no step. */
const PAGE_COPY: Partial<Record<ScreenId, { title: string; body: string }>> = {
  home: {
    title: 'Det her er jeres side',
    body: 'Jeres navne, jeres dato og hvor længe der er til — alt hvad I fortalte mig, står allerede her.\n\nJeg holder **Kom godt i gang** opdateret nedenunder, ét skridt ad gangen.',
  },
  planning: {
    title: 'Tidsplanen regnes baglæns fra jeres dato',
    body: 'Milepælene lægger sig selv ud fra dagen og hjem, så I altid ved **hvad der haster nu**. Tjeklisten har over 200 punkter fordelt på områder — I skal ikke selv finde på dem.\n\nOg **Bryllupsdagen** er selve dagen, minut for minut, når I når dertil.',
  },
  inbox: {
    title: 'Her lander svarene fra stederne',
    body: 'Tom lige nu. Når jeg har skrevet til et sted, samler jeg tråden her, trækker **prisen** ud af mailen og lægger **et forslag til svar** klar. I skal bare godkende det.',
  },
  team: {
    title: 'Jeg søger stederne frem for jer',
    body: 'Jeg leder på **det åbne web**, tjekker at stederne findes, og lægger dem på tavlen. I swiper dem til jeres **shortlist**, og jeg kan skrive til dem for jer.',
  },
  budget: {
    title: 'Budgettet fordeler sig selv',
    body: 'Jeg fordeler beløbet på kategorier og siger til, **før I rammer loftet**. Bed mig om et forslag, så regner jeg en fordeling ud fra jeres tal.\n\nUploader I en kontrakt, læser jeg prisen og betalingsdatoerne ud af den.',
  },
  guests: {
    title: 'Gæstelisten svarer selv',
    body: 'Hver gæst får sit **eget svar-link**. De svarer, og listen opdaterer sig — også med kostbehov og overnatning, så I ikke skal spørge to gange.',
  },
  website: {
    title: 'En rigtig hjemmeside, ikke et udkast',
    body: 'Jeg bygger den ud fra jeres oplysninger, og I kan udgive den på **en offentlig adresse**, I kan dele med gæsterne. Programmet og svar-formularen hænger sammen med resten her.',
  },
  registry: {
    title: 'Ønskelisten, uden dobbeltgaver',
    body: 'I skriver ønskerne, gæsterne reserverer dem på jeres side — og I kan ikke se hvem, før I selv vil.',
  },
  invites: {
    title: 'Invitationskort, malet til jer',
    body: 'Vælg en stemning og skriv jeres ord, så maler jeg et kort kun til jer. I henter det til Canva, hvor alt kan rettes, eller printer det, som det er.',
  },
  seating: {
    title: 'Bordplanen kender jeres gæster',
    body: 'Gæsterne kommer herover fra listen, grupperet efter side, med kostbehov markeret. I trækker dem på plads.',
  },
  honeymoon: {
    title: 'Bryllupsrejsen, når I orker at tænke på den',
    body: 'Find destinationer og gem dem, I kan lide. Den venter på jer.',
  },
  nygift: {
    title: 'Og bagefter',
    body: 'Album til billederne og en takkeliste, der holder styr på hvem I har takket. Den er der, når dagen er ovre.',
  },
  guides: {
    title: 'Når I er i tvivl',
    body: 'Guides til **budget, vielse, lokale og gæster**, og svar på det, alle par spørger om. Hver guide har en knap, der åbner det sted her, hvor I gør det.',
  },
};

/* The sidebar, top to bottom, then the two steps that are not pages. */
export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  ...NAV.flatMap((item): WalkthroughStep[] => {
    const copy = PAGE_COPY[item.id];
    if (!copy) return [];
    return [{
      id: item.id,
      page: item.id,
      eyebrow: item.label,
      title: copy.title,
      body: copy.body,
      // Onboarding lands every couple in chat, so without this the tour
      // explains a page from behind the chat column covering it.
      ...(item.id === 'home' ? { chat: false } : {}),
    }];
  }),
  {
    id: 'chat',
    page: 'home',
    eyebrow: 'Ava',
    /* Deliberately does NOT force chat on. The step is about the switch, so
       they press it themselves and watch it happen — forcing it first would
       leave the ring pointing at a control that was already on, which is the
       exact fault this tour started with. */
    target: 'ava-chat',
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
