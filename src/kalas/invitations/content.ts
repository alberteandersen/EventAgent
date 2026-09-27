/* What an invitation says, as opposed to how it looks. The look is a version
   in invitation_designs (a vibe's tokens, then Ava's HTML); the words live in
   invitations.data and are the only facts Ava may put on the card. Pure and
   server-safe: the build pipeline and the public page read it too.

   Rows saved by the old template editor carry `isoDate` and a free-text
   `time`; parseInviteContent reads those, so a couple's details survive the
   move. */

export type Language = 'da' | 'en';

export interface InviteContent {
  partnerA: string;
  partnerB: string;
  /** YYYY-MM-DD, or '' while the date is open. */
  date: string;
  /** Free text as the couple wrote it: "14:00", "Kl. 16". */
  time: string;
  venue: string;
  venueDetail: string;
  /** YYYY-MM-DD, the last day to answer, or ''. */
  rsvpBy: string;
  /** Anything else guests should know: dresscode, a line about the party. */
  note: string;
  language: Language;
  /** The card's own lines, when the couple wrote them over the design's. */
  wording?: Partial<Record<'eyebrow' | 'invite' | 'closing', string>>;
  /** The couple's photo on a card with a photo block (a site_photos id). */
  photoId?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v: unknown) => {
  const s = str(v, 40).slice(0, 10);
  return DATE_RE.test(s) ? s : '';
};

/** Parse an untrusted invitations.data blob over the wedding's own facts. */
export function parseInviteContent(raw: unknown, fallback: Partial<InviteContent> = {}): InviteContent {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof InviteContent, v: string) => v || str(fallback[key]);
  return {
    partnerA: pick('partnerA', str(o.partnerA, 60)),
    partnerB: pick('partnerB', str(o.partnerB, 60)),
    date: day(o.date) || day(o.isoDate) || day(fallback.date),
    time: pick('time', str(o.time, 60)),
    venue: pick('venue', str(o.venue, 120)),
    venueDetail: pick('venueDetail', str(o.venueDetail, 120)),
    rsvpBy: day(o.rsvpBy) || day(fallback.rsvpBy),
    note: pick('note', str(o.note, 400)),
    language: o.language === 'en' || o.language === 'da' ? o.language : fallback.language ?? 'da',
    wording: parseWording(o.wording),
    photoId: typeof o.photoId === 'string' && /^[0-9a-f-]{36}$/i.test(o.photoId) ? o.photoId : undefined,
  };
}

function parseWording(raw: unknown): InviteContent['wording'] {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: NonNullable<InviteContent['wording']> = {};
  for (const key of ['eyebrow', 'invite', 'closing'] as const) {
    if (typeof o[key] === 'string' && o[key].trim()) out[key] = (o[key] as string).slice(0, 160);
  }
  return out;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const MONTHS_DA = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

/** "Lørdag · den 12. september 2026" / "Saturday · the 12th of September 2026". */
function longDate(iso: string, language: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // Non-breaking spaces bind the month to its year and the weekday to its
  // separator. Without them a long Danish date wrapping inside a 280px card
  // strands "2026" on its own line and leaves "·" dangling at a line end.
  if (language === 'da') {
    const weekday = d.toLocaleDateString('da-DK', { weekday: 'long' });
    const wd = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${wd} · den ${day}. ${MONTHS_DA[month]} ${year}`;
  }

  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday} · the ${ordinal(day)} of ${monthName} ${year}`;
}

/** The wedding date as the card says it: "Lørdag · den 12. september 2026". */
export function dateLine(c: InviteContent): string {
  return c.date ? longDate(`${c.date}T12:00:00`, c.language) : '';
}

/** "Svar venligst senest 1. august 2026". */
export function rsvpLine(c: InviteContent): string {
  if (!c.rsvpBy) return '';
  const d = new Date(`${c.rsvpBy}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return c.language === 'da'
    ? `Svar venligst senest ${d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `Kindly reply by ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** "Anna & Emil", or one name while the partner's is missing. */
export function coupleNames(c: InviteContent): string {
  return [c.partnerA, c.partnerB].filter(Boolean).join(' & ');
}

/** The facts as a built card states them. A build stores it, and the builder
    compares it with the details as they stand to spot a card gone stale. */
export function contentKey(c: InviteContent): string {
  return JSON.stringify([c.partnerA, c.partnerB, c.date, c.time, c.venue, c.venueDetail, c.rsvpBy, c.note, c.language]);
}
