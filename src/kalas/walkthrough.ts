/* Ava's guided tour — the script.
 *
 * One entry per page: a title, a short body, and the prompts the couple can
 * try. The prompts are sent to the agent verbatim, so they genuinely execute —
 * a venue search really lands venues on the board.
 *
 * Copy is Danish source with {named} placeholders, resolved through the same
 * t(source, params) i18n as the rest of the app (see i18n.tsx / strings.ts).
 */

import type { ScreenId } from './Shell';

/** localStorage key holding the current step index — also the "armed" marker. */
export const WALKTHROUGH_KEY = 'kalas_walkthrough';

export type WalkthroughStep = {
  id: string;
  /** Where "Videre" takes them when they do not press the control itself. */
  page: ScreenId | null;
  /** Read at a glance, so a headline rather than a paragraph. */
  title: string;
  /** `**bold**` renders through the same RichText as the chat bubbles. */
  body: string;
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
    anchor: 'home-checklist',
    title: 'Velkommen. Jeg viser rundt',
    body:
      'I behøver ikke lede efter knapper. Jeg åbner den rigtige side og laver arbejdet — I skal bare **sige til**.\n\nRundturen tager fem minutter, og I kan **stoppe når som helst**.',
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
    page: 'home',
    title: 'Der er mere, når I når dertil',
    body:
      'Bryllupsside, invitationer, ønskeliste, bordplan og bryllupsrejse ligger i menuen. **Én ting ad gangen** — de venter på jer.',
  },
  {
    id: 'choose',
    page: null,
    final: true,
    title: 'Det var rundturen',
    body:
      'Nu er I i gang. Jeg er her, hvis I får brug for mig — **skriv bare til mig**, når som helst.',
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
