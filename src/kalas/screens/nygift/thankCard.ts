/* "Tak fordi I kom" — the card that goes out after the day.
 *
 * Built on the invitation engine rather than beside it: the couple already
 * chose a look for their invitation, and the thank-you that follows it should
 * be able to match. All twenty templates render from one InvitationData shape
 * (invitations/types.ts), so the whole job here is phrasing the same fields in
 * the past tense — the invitation says "we invite you", the thank-you says
 * "thank you for being there".
 *
 * Pure, so the wording can be tested without a browser or a template.
 */

import { defaultDataFor } from '../../invitations/data';
import type { InvitationData, Language, TemplateMeta } from '../../invitations/types';

export interface ThankCardInput {
  partnerA?: string;
  partnerB?: string;
  /** The wedding itself: the card looks back at it, so it is a past date. */
  isoDate?: string | null;
  venue?: string;
  venueDetail?: string;
  language?: Language;
  /** A line the couple wrote themselves; replaces the default middle. */
  personalNote?: string;
}

interface Copy {
  label: string;
  introLines: string[];
  closing: string;
  /** Stands where the invitation put "R.S.V.P." */
  footer: string;
}

const COPY: Record<Language, Copy> = {
  da: {
    label: 'Tak fordi I kom',
    introLines: ['Tak, fordi I fejrede dagen med os.', 'Den blev, som den blev, på grund af jer.'],
    closing: 'Med kærlighed',
    footer: 'Vi ses snart',
  },
  en: {
    label: 'Thank you for coming',
    introLines: ['Thank you for celebrating the day with us.', 'It was what it was because of you.'],
    closing: 'With love',
    footer: 'See you soon',
  },
};

/** Where the invitation named the date ahead, the card names the day that was. */
function lookBack(displayDate: string, language: Language): string {
  if (!displayDate) return '';
  return language === 'da' ? `Vi blev gift ${displayDate}` : `We were married ${displayDate}`;
}

/**
 * The same fields the templates already render, phrased for afterwards.
 * `meta` decides the date wording and which fields the template shows, exactly
 * as it does for an invitation.
 */
export function thankCardData(meta: TemplateMeta, input: ThankCardInput): InvitationData {
  const language: Language = input.language ?? 'da';
  const base = defaultDataFor(meta, input);
  const copy = COPY[language];
  const note = input.personalNote?.trim();

  return {
    ...base,
    label: copy.label,
    // A note they wrote themselves is the point of the card; the default is a
    // placeholder for the couple who has nothing particular to add.
    introLines: note ? [note] : copy.introLines,
    displayDate: lookBack(base.displayDate, language),
    closing: copy.closing,
    rsvpLabel: copy.footer,
    // An invitation tells you where to go. A thank-you does not, and a venue
    // line reads as an instruction to attend something that already happened.
    venue: '',
    venueDetail: undefined,
    time: undefined,
  };
}

/**
 * Whether this template renders the couple's own words at all.
 *
 * `introLines` is an optional field: only some templates lay it out, and the
 * rest drop it silently. A couple who writes a greeting and then picks a
 * design that swallows it has been quietly failed, so the gallery narrows to
 * the designs that carry it as soon as they write one.
 */
export function showsNote(meta: TemplateMeta): boolean {
  return meta.fields.includes('introLines');
}

/** Danish, because the card is addressed to one guest at a time. */
export function greetingFor(name: string | null | undefined, language: Language = 'da'): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (!first) return language === 'da' ? 'Kære alle' : 'Dear all';
  return language === 'da' ? `Kære ${first}` : `Dear ${first}`;
}
