/* The Indhold tab as an outline: the site's sections grouped into a few
   steps in the order a couple would think them through, and for each
   section whether it is ready to show guests. "Ready" means nothing a guest
   would see is missing, not that the words are good. Strings are Danish
   source strings, shown through t() / tn(). */

import { hasContact, type SectionId, type SiteConfig } from './config';

export type ContentStepId = 'welcome' | 'day' | 'guests' | 'gifts' | 'hub';

export interface ContentStep {
  id: ContentStepId;
  label: string;
  title: string;
  intro: string;
  sections: SectionId[];
}

/** Every section appears in exactly one step. */
export const CONTENT_STEPS: ContentStep[] = [
  {
    id: 'welcome', label: 'Velkomst', title: 'Det første, gæsterne ser',
    intro: 'Navne og dato kommer fra jeres profil. Skriv en velkomst og, hvis I har lyst, jeres historie.',
    sections: ['hero', 'story'],
  },
  {
    id: 'day', label: 'Dagen', title: 'Hvad der sker, og hvor',
    intro: 'Programmet, adressen og hvad man tager på. Det er det, gæsterne slår op flest gange.',
    sections: ['program', 'transport', 'dresscode'],
  },
  {
    id: 'guests', label: 'Gæsterne', title: 'Svar, overnatning og spørgsmål',
    intro: 'Hvad gæsterne skal svare på, hvor de kan sove, og hvem de kan spørge.',
    sections: ['rsvp', 'hotel', 'faq', 'contact'],
  },
  {
    id: 'gifts', label: 'Gaver & billeder', title: 'Gaver og billeder',
    intro: 'Jeres ønsker, et galleri, og et sted hvor gæsterne kan dele deres billeder fra dagen.',
    sections: ['gifts', 'gallery', 'photos'],
  },
  {
    id: 'hub', label: 'På dagen', title: 'Til selve dagen',
    intro: 'To ting gæsterne bruger på telefonen, mens festen står på. Kalas driver dem, I skal bare slå dem til.',
    sections: ['seat', 'guestbook'],
  },
];

export type SectionState = 'ready' | 'todo' | 'off';

export interface SectionStatus {
  state: SectionState;
  /** What is missing, for 'todo'. With `n`, `note` is the plural form. */
  note?: string;
  n?: number;
  one?: string;
}

/** What the content alone cannot tell. */
export interface OutlineExtras {
  /** Registry items render into the gifts section on their own. */
  hasRegistry?: boolean;
}

const filled = (s: string) => s.trim().length > 0;
const ready: SectionStatus = { state: 'ready' };
const todo = (note: string): SectionStatus => ({ state: 'todo', note });

export function sectionStatus(id: SectionId, config: SiteConfig, extras: OutlineExtras = {}): SectionStatus {
  const meta = config.sections.find((s) => s.id === id);
  if (!meta || (!meta.enabled && !meta.locked)) return { state: 'off' };

  switch (id) {
    case 'story':
      return filled(config.storyText) ? ready : todo('Mangler jeres historie');
    case 'program': {
      const rows = config.program.filter((p) => filled(p.label) || filled(p.time));
      if (rows.length === 0) return todo('Ingen programpunkter');
      const partial = rows.filter((p) => !filled(p.label) || !filled(p.time)).length;
      return partial === 0 ? ready : { state: 'todo', n: partial, one: 'Ét punkt mangler tid eller navn', note: '{n} punkter mangler tid eller navn' };
    }
    case 'rsvp':
      return filled(config.rsvpDeadline) ? ready : todo('Mangler svarfrist');
    case 'gallery':
      return config.galleryKeys.length > 0 ? ready : todo('Ingen billeder valgt');
    case 'transport':
      return filled(config.transport) ? ready : todo('Mangler adresse');
    case 'dresscode':
      return filled(config.dresscode) ? ready : todo('Mangler tekst');
    case 'gifts':
      return filled(config.giftsText) || filled(config.giftsUrl) || extras.hasRegistry ? ready : todo('Mangler tekst');
    case 'hotel':
      return config.hotels.some((h) => filled(h.name)) ? ready : todo('Ingen hoteller endnu');
    case 'faq': {
      const asked = config.faq.filter((f) => filled(f.q));
      if (asked.length === 0) return todo('Ingen spørgsmål');
      const open = asked.filter((f) => !filled(f.a)).length;
      return open === 0 ? ready : { state: 'todo', n: open, one: 'Ét svar mangler', note: '{n} svar mangler' };
    }
    case 'contact':
      return hasContact(config.contact) ? ready : todo('Mangler navn og telefon');
    default:
      // The hero, guest photos, seat finder and guestbook need nothing typed.
      return ready;
  }
}

export interface StepSummary {
  /** Sections switched on (the hero always is). */
  on: number;
  /** Of those, the ones with something missing. */
  todo: number;
}

export function stepSummary(step: ContentStep, config: SiteConfig, extras: OutlineExtras = {}): StepSummary {
  const states = step.sections.map((id) => sectionStatus(id, config, extras).state);
  return {
    on: states.filter((s) => s !== 'off').length,
    todo: states.filter((s) => s === 'todo').length,
  };
}

/** The whole site: sections on, and how many of them still miss something. */
export function outlineSummary(config: SiteConfig, extras: OutlineExtras = {}): StepSummary {
  return CONTENT_STEPS.reduce<StepSummary>((acc, step) => {
    const s = stepSummary(step, config, extras);
    return { on: acc.on + s.on, todo: acc.todo + s.todo };
  }, { on: 0, todo: 0 });
}
