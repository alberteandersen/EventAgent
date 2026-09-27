/* "Tak fordi I kom" — the card that goes out after the day.
 *
 * Drawn by the invitation's own renderer (invitations/InviteCard.tsx) in the
 * couple's active invitation design, so the thank-you matches what the guests
 * were invited with. The whole job here is phrasing the same facts for
 * afterwards: the invitation says "we're getting married", the thank-you says
 * "thank you for being there" — and it drops everything that asks something
 * of the guest (where to go, when, reply by).
 *
 * Pure, so the wording can be tested without a browser.
 */

import type { InviteContent, Language } from '../../invitations/content';

/** The words InviteCard sets in place of the invitation's. */
export interface ThankWords {
  /** Stands where the invitation said "Vi gifter os". */
  eyebrow: string;
  /** The default middle, for the couple with nothing particular to add. */
  line: string;
  closing: string;
}

const WORDS: Record<Language, ThankWords> = {
  da: {
    eyebrow: 'Tak fordi I kom',
    line: 'Tak, fordi I fejrede dagen med os. Den blev, som den blev, på grund af jer.',
    closing: 'Med kærlighed',
  },
  en: {
    eyebrow: 'Thank you for coming',
    line: 'Thank you for celebrating the day with us. It was what it was because of you.',
    closing: 'With love',
  },
};

export function thankWords(language: Language = 'da'): ThankWords {
  return WORDS[language];
}

/**
 * The invitation's facts, phrased for afterwards. Names and date stay (the
 * card looks back at the day); venue, time and the reply date go, because a
 * venue line on a thank-you reads as an instruction to attend something that
 * already happened. The invitation's own note (dresscode, a line about the
 * party) goes too: in its place are the couple's own words, if they wrote any.
 */
export function thankContent(content: InviteContent, personalNote?: string): InviteContent {
  return {
    ...content,
    time: '',
    venue: '',
    venueDetail: '',
    rsvpBy: '',
    note: personalNote?.trim() ?? '',
  };
}

/** The card's words as a mail, so it is a thank-you when it opens rather than
    an empty draft with a subject line. */
export function thankMailBody(content: InviteContent): string {
  const words = thankWords(content.language);
  return [
    greetingFor(null, content.language),
    '',
    content.note || words.line,
    '',
    words.closing,
    [content.partnerA, content.partnerB].filter(Boolean).join(' & '),
  ].join('\n');
}

/** Danish, because the card is addressed to one guest at a time. */
export function greetingFor(name: string | null | undefined, language: Language = 'da'): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (!first) return language === 'da' ? 'Kære alle' : 'Dear all';
  return language === 'da' ? `Kære ${first}` : `Dear ${first}`;
}
