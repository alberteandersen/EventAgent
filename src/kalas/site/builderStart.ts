/* Where the website builder starts: the couple's saved site, or for a new
   one, what the wedding already knows (their venue, their Bryllupsdagen).
   Read once, before the builder mounts, so its state starts right instead of
   being corrected by an effect after the first render. */

import { sortByTime } from '../screens/planning/dayProgram';
import {
  EMPTY_CONTACT, INIT_FAQ, INIT_HOTELS, INIT_PROGRAM, INIT_SECTIONS, withAllSections,
  type FAQItem, type GuestContact, type HotelItem, type ImageKey, type ProgramEvent, type SectionId, type SectionMeta,
} from './config';
import type { DayProgramItemRow, VenueRow, WeddingSiteRow } from '@/lib/db/types';

/* What the builder used to start every site with. The story was invented,
   the address was somebody else's venue and the deadline has passed, so a
   saved config that still holds one of them was never edited: read it as
   empty, and the outline asks for the real thing. */
export const OLD_STORY = 'Vi mødte hinanden på en tilfældig tirsdag og har ikke kunnet slippe hinanden siden.';
export const OLD_TRANSPORT = 'Sonnerupgaard Gods, Sonnerupvej 8, 4060 Kirke Såby';
export const OLD_DEADLINE = '2026-08-01';

/** Bryllupsdagen, as the programme guests see. */
export const programFromDay = (items: DayProgramItemRow[]): ProgramEvent[] =>
  sortByTime(items).map((d) => ({ id: `d-${d.id}`, time: d.time.slice(0, 5), label: d.title, sublabel: d.subtitle ?? '' }));

/** "Hindsgavl Slot, Hindsgavl Allé 7, 5500 Middelfart", or '' with no venue. */
export const venueLine = (venue: VenueRow | null | undefined): string =>
  venue ? [venue.name, venue.address].filter(Boolean).join(', ') : '';

export interface BuilderStart {
  sections: SectionMeta[];
  aiImages: SectionId[];
  heroTagline: string;
  storyText: string;
  countdown: boolean;
  program: ProgramEvent[];
  rsvpDeadline: string;
  rsvpPlusOne: boolean;
  rsvpMeal: boolean;
  rsvpDietary: boolean;
  galleryKeys: ImageKey[];
  transport: string;
  dresscode: string;
  giftsText: string;
  giftsUrl: string;
  faq: FAQItem[];
  hotels: HotelItem[];
  contact: GuestContact;
  pwProtected: boolean;
  sitePassword: string;
  hideBranding: boolean;
  domain: string | null;
  published: boolean;
}

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const arr = <T,>(v: unknown, d: T[]) => (Array.isArray(v) ? (v as T[]) : d);

export function builderStart({ site, venue, dayProgram }: {
  site: WeddingSiteRow | null;
  venue: VenueRow | null;
  dayProgram: DayProgramItemRow[];
}): BuilderStart {
  const c = (site?.config ?? {}) as Record<string, unknown>;
  const saved = Boolean(site) && Object.keys(c).length > 0;
  const place = venueLine(venue);

  // Nothing here may say something about their wedding that they did not.
  const fresh: BuilderStart = {
    sections: INIT_SECTIONS,
    aiImages: ['dresscode', 'transport', 'gifts'],
    heroTagline: 'Kom og fejr dagen med os',
    storyText: '',
    countdown: true,
    program: dayProgram.length > 0 ? programFromDay(dayProgram) : INIT_PROGRAM,
    rsvpDeadline: '',
    rsvpPlusOne: true,
    rsvpMeal: true,
    rsvpDietary: true,
    galleryKeys: ['florals', 'olive', 'candles', 'arch'],
    transport: place,
    dresscode: '',
    giftsText: '',
    giftsUrl: '',
    faq: INIT_FAQ,
    hotels: INIT_HOTELS,
    contact: EMPTY_CONTACT,
    pwProtected: false,
    sitePassword: '',
    hideBranding: false,
    domain: site?.domain ?? null,
    published: site?.published ?? false,
  };
  if (!saved) return fresh;

  const story = str(c.storyText, '');
  const transport = str(c.transport, '');
  const deadline = str(c.rsvpDeadline, '');
  return {
    ...fresh,
    // Sections added since the site was saved (the guest hub) join in off.
    sections: Array.isArray(c.sections) ? withAllSections(c.sections as SectionMeta[]) : fresh.sections,
    aiImages: arr<SectionId>(c.aiImages, fresh.aiImages),
    heroTagline: str(c.heroTagline, fresh.heroTagline),
    storyText: story.startsWith(OLD_STORY) ? '' : story,
    countdown: bool(c.countdown, true),
    // A saved site keeps its programme, even one they emptied on purpose.
    program: arr<ProgramEvent>(c.program, INIT_PROGRAM),
    rsvpDeadline: deadline === OLD_DEADLINE ? '' : deadline,
    rsvpPlusOne: bool(c.rsvpPlusOne, true),
    rsvpMeal: bool(c.rsvpMeal, true),
    rsvpDietary: bool(c.rsvpDietary, true),
    galleryKeys: arr<ImageKey>(c.galleryKeys, fresh.galleryKeys),
    transport: transport === OLD_TRANSPORT ? place : transport,
    dresscode: str(c.dresscode, ''),
    giftsText: str(c.giftsText, ''),
    giftsUrl: str(c.giftsUrl, ''),
    faq: arr<FAQItem>(c.faq, INIT_FAQ),
    hotels: arr<HotelItem>(c.hotels, INIT_HOTELS),
    contact: c.contact && typeof c.contact === 'object' ? { ...EMPTY_CONTACT, ...(c.contact as Partial<GuestContact>) } : EMPTY_CONTACT,
    pwProtected: bool(c.pwProtected, false),
    sitePassword: str(c.sitePassword, ''),
    hideBranding: bool(c.hideBranding, false),
  };
}

/** JSON with object keys sorted: the database hands a config back with its
    keys reordered, and that must still read as the same content. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v);
}
