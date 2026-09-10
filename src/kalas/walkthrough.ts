/* Ava's guided tour — the script.
 *
 * One entry per page: a title, a short body, and an example of what the couple
 * could ask. The example is shown, not fired: a button that started a real
 * agent turn from inside the tour did the asking somewhere they could not see
 * it, and the asking belongs in the chat.
 *
 * Copy is Danish source with {named} placeholders, resolved through the same
 * t(source, params) i18n as the rest of the app (see i18n.tsx / strings.ts).
 */

import type { ScreenId } from './Shell';

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
  /** What the couple clicks to advance in classic — a `data-tour` value. */
  anchor?: string;
  /** "Try writing…" — shown as an example, never sent from here. */
  tries?: string[];
  /** Prompts that only make sense once every placeholder resolved. */
  needs?: ReadonlyArray<keyof WalkthroughParams>;
  /** Renders the chat-vs-classic choice, and ends the tour. */
  final?: boolean;
};

export type WalkthroughParams = {
  city: string;
  guests: number;
  foodBudget: string;
  dateHint: string;
};

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    id: 'intro',
    page: 'home',
    /* Opens on their own wedding rather than on a menu: the names, the date
       and the countdown are the couple's own answers handed back to them, and
       that is a better first frame than a checklist. */
    anchor: 'home-hero',
    title: 'Det her er jeres side',
    body:
      'Jeres navne, jeres dato og hvor længe der er til. Alt hvad I fortalte mig, står allerede her.\n\nKalas kan bruges på to måder: **med mig ved siden af**, hvor I skriver og jeg gør arbejdet, eller **klassisk**, hvor I klikker jer rundt selv. I vælger til sidst — og kan skifte når som helst.',
  },
  {
    id: 'start',
    page: 'home',
    anchor: 'home-checklist',
    title: 'Her står næste skridt',
    body:
      'Jeg holder **Kom godt i gang** opdateret, ét skridt ad gangen, og krydser af efterhånden som I kommer videre.',
  },
  {
    id: 'vendors',
    page: 'team',
    anchor: 'team',
    tries: ['Find et bryllupssted i {city} til {guests} gæster'],
    needs: ['city', 'guests'],
    title: 'Her finder I stederne',
    body:
      'Jeg søger på **det åbne web**, tjekker at stederne findes, og lægger dem på tavlen. I gemmer favoritter på jeres **shortlist** og ser, hvem I har booket.',
  },
  {
    id: 'budget',
    page: 'budget',
    anchor: 'budget',
    tries: ['Sæt budgettet for mad og drikke til {foodBudget} kr'],
    needs: ['foodBudget'],
    title: 'Budgettet holder styr på sig selv',
    body:
      'Jeg fordeler beløbet på **kategorier** og siger til, **før I rammer loftet**. I kan trække i det selv — eller bede mig om at ændre det.',
  },
  {
    id: 'guests',
    page: 'guests',
    anchor: 'guests',
    /* Not "who hasn't replied yet": the walkthrough runs on day one, when the
       list is empty and the honest answer is "nobody, there are no guests".
       A prompt that only works months later is a prompt that fails now. */
    tries: ['Hvordan får vi gæstelisten i gang?'],
    title: 'Gæstelisten, uden regneark',
    body:
      'Importér fra **CSV** eller tilføj dem enkeltvis. Jeg holder styr på **svar**, **plus-ens** og **kostbehov** undervejs.',
  },
  {
    id: 'planning',
    page: 'planning',
    anchor: 'planning',
    tries: ['Hvad bør vi have på plads inden {dateHint}?'],
    needs: ['dateHint'],
    title: 'Tidslinjen regnes baglæns',
    body:
      'Fra jeres dato og hjem, så I altid ved **hvad der haster nu** — og hvad der kan vente.',
  },
  {
    id: 'inbox',
    page: 'inbox',
    anchor: 'inbox',
    title: 'Her lander svarene',
    body:
      'Når jeg har skrevet til et sted, samler jeg tråden, trækker **prisen** ud af mailen og lægger **et forslag til svar** klar. I skal bare godkende.',
  },
  {
    id: 'rest',
    /* Points at one of the pages it is describing. Without a target there is
       nothing to press, and since the skip buttons went the tag is the only
       way forward — a step with no anchor would be a dead end. */
    page: 'website',
    anchor: 'website',
    title: 'Der er mere, når I når dertil',
    body:
      'Bryllupsside, invitationer, ønskeliste, bordplan og bryllupsrejse ligger i menuen. **Én ting ad gangen** — de venter på jer.',
  },
  {
    id: 'choose',
    page: 'home',
    /* Ends on the checklist rather than on a goodbye. "That was the tour" and
       then an empty screen leaves them exactly where they were before it
       started — the last thing a tour owes them is the first thing to do. */
    anchor: 'home-checklist',
    final: true,
    title: 'Sådan kommer I i gang',
    body:
      'Start i **Kom godt i gang** — de næste skridt står der, ét ad gangen, og jeg krydser dem af, efterhånden som I kommer videre.\n\nEr I i tvivl, så spørg mig bare.',
    tries: ['Hvad skal vi gøre først?'],
  },
] as const;

/** Fills {placeholders} that resolved; a step whose needs are unmet drops its tries. */
export function stepTries(
  step: WalkthroughStep,
  params: Partial<WalkthroughParams>,
): string[] {
  if (!step.tries) return [];
  const unmet = (step.needs ?? []).some((k) => params[k] === undefined || params[k] === '');
  return unmet ? [] : step.tries;
}

/** Placeholders for the try-prompts, from the couple's own answers. */
export function walkthroughParams(
  event: { location: string | null; date_hint: string | null } | null,
  couple: { guests: number; budgetTotal: number; dateLabel: string },
): Partial<WalkthroughParams> {
  const p: Partial<WalkthroughParams> = {};
  if (event?.location) p.city = event.location;
  if (couple.guests > 0) p.guests = couple.guests;
  if (couple.budgetTotal > 0) {
    // ~30 % of the total is the usual food-and-drink share; round to 5.000 kr
    // so the suggested prompt reads like something a person would type.
    const food = Math.round((couple.budgetTotal * 0.3) / 5_000) * 5_000;
    if (food > 0) p.foodBudget = food.toLocaleString('da-DK');
  }
  const when = event?.date_hint || couple.dateLabel;
  if (when) p.dateHint = when;
  return p;
}

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
