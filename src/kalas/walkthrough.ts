/* Ava's conversational walkthrough — the script.
 *
 * Replaces the old spotlight tour: instead of coach-marks with Next/Back, Ava
 * narrates each page in the chat, pulls it up on the stage, and offers real
 * prompts the couple can try. The prompts are sent to the agent verbatim, so
 * they genuinely execute — a venue search really lands venues on the board.
 *
 * Copy is Danish source with {named} placeholders, resolved through the same
 * t(source, params) i18n as the rest of the app (see i18n.tsx / strings.ts).
 */

import type { ScreenId } from './Shell';

/** localStorage key holding the current step index — also the "armed" marker. */
export const WALKTHROUGH_KEY = 'kalas_walkthrough';

/** sessionStorage slot for a prompt handed from classic mode into the chat. */
export const HANDOFF_KEY = 'kalas_ava_prompt';

export type WalkthroughStep = {
  id: string;
  /** Stage navigates here when the step opens. */
  page: ScreenId | null;
  /** Ava's line. */
  message: string;
  /* Classic mode has no chat thread on screen, so the two steps that talk
     about "writing to me here" would be lying. Only those override. */
  classicMessage?: string;
  /** What the couple clicks to advance in classic — a `data-tour` value. */
  anchor?: string;
  /** "Try asking me…" prompts — sent to the agent for real. */
  tries?: string[];
  /** Prompts that only make sense once every placeholder resolved. */
  needs?: ReadonlyArray<keyof WalkthroughParams>;
  /** Renders the chat-vs-classic choice instead of chips. */
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
    message:
      'Så er I inde, velkommen! Lad mig vise jer rundt. Det korte af det lange: I behøver ikke lede efter knapper. Skriv til mig her, så åbner jeg den rigtige side og laver arbejdet.',
    classicMessage:
      'Så er I inde, velkommen! Lad mig vise jer rundt på fem minutter. I trykker selv undervejs, og I kan stoppe når som helst.',
    anchor: 'home-checklist',
  },
  {
    id: 'vendors',
    page: 'team',
    anchor: 'team',
    message:
      'Det her er leverandører. Her udforsker I steder og folk, gemmer favoritter på jeres shortlist, og ser hvem I har booket. Prøv at bede mig om noget, jeg søger på nettet og lægger rigtige steder på tavlen.',
    tries: ['Find et bryllupssted i {city} til {guests} gæster'],
    needs: ['city', 'guests'],
  },
  {
    id: 'budget',
    page: 'budget',
    anchor: 'budget',
    message:
      'Budgettet. Jeg fordeler det på kategorier og siger til, før I rammer loftet. I kan trække i det selv, eller bare bede mig om at ændre det.',
    tries: ['Sæt budgettet for mad og drikke til {foodBudget} kr'],
    needs: ['foodBudget'],
  },
  {
    id: 'guests',
    page: 'guests',
    anchor: 'guests',
    message:
      'Gæstelisten. Importér fra CSV eller tilføj dem enkeltvis, jeg holder styr på svar, plus-ens og kostbehov undervejs. I kan også bare spørge mig om status.',
    tries: ['Hvem mangler at svare på invitationen?'],
  },
  {
    id: 'planning',
    page: 'planning',
    anchor: 'planning',
    message:
      'Tidslinjen lægger jeg baglæns fra jeres dato, så I altid ved hvad der haster. Spørg mig endelig.',
    tries: ['Hvad bør vi have på plads inden {dateHint}?'],
    needs: ['dateHint'],
  },
  {
    id: 'inbox',
    page: 'inbox',
    anchor: 'inbox',
    message:
      'Og her lander svarene. Når jeg har skrevet til et sted, samler jeg tråden, trækker prisen ud af mailen og lægger et forslag til svar klar, I skal bare godkende.',
  },
  {
    id: 'rest',
    page: 'home',
    message:
      'Der er mere når I når dertil: jeres bryllupsside, invitationer, ønskeliste, bordplan og bryllupsrejse. Bed mig om at åbne en af dem, når I er klar.',
    classicMessage:
      'Der er mere i menuen når I når dertil: jeres bryllupsside, invitationer, ønskeliste, bordplan og bryllupsrejse.',
  },
  {
    id: 'choose',
    page: null,
    message:
      'Det var rundturen. Hvordan vil I helst arbejde? I kan altid skifte oppe i hjørnet.',
    classicMessage:
      'Det var rundturen. Nu er I i gang, jeg er her, hvis I får brug for mig.',
    final: true,
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
