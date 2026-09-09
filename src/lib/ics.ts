/* An iCalendar file for the wedding, so a guest can put it in their calendar
   instead of copying a date and an address by hand.
 *
 * Pure and string-in/string-out, so it can be tested without a request and
 * reused if invitations ever want to carry the same file.
 *
 * Times are FLOATING (no Z, no TZID): "14:00" means two in the afternoon
 * wherever the wedding is. Converting to UTC would need the venue's timezone,
 * which we do not have — a lat/lng is not a timezone — and guessing it puts
 * the ceremony an hour out, which is worse than not converting. Guests are in
 * the venue's timezone on the day, which is exactly when the entry matters.
 */

/** RFC 5545 §3.3.11: backslash, semicolon and comma escape; newlines become \n. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: lines fold at 75 octets, continuations start with a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // 74 leaves room for the leading space on continuation lines. Step back to
    // a character boundary so a folded multi-byte character is not split.
    let end = Math.min(start + (out.length === 0 ? 75 : 74), bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return out[0] + out.slice(1).map((chunk) => `\r\n ${chunk}`).join('');
}

/** "2027-06-06" → "20270606" */
function dateOnly(iso: string): string {
  return iso.replace(/-/g, '');
}

/** "2027-06-06" + "14:00" → "20270606T140000". Bad or missing time → null. */
function dateTime(iso: string, time: string | null | undefined): string | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${dateOnly(iso)}T${String(h).padStart(2, '0')}${m[2]}00`;
}

/** The day after, for an all-day DTEND (which is exclusive). */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateOnly(d.toISOString().slice(0, 10));
}

export interface IcsEvent {
  /** Stable per wedding, so re-downloading updates the entry instead of adding a second one. */
  uid: string;
  title: string;
  /** ISO date, "2027-06-06". Required — there is nothing to add without one. */
  dateISO: string;
  /** "14:00". Omitted or unparseable → an all-day entry. */
  startTime?: string | null;
  /** "23:00". Ignored unless startTime parsed; earlier than start → next morning. */
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  /** The couple's site, so the entry links back to the programme and RSVP. */
  url?: string | null;
  /** Overridable so tests are not clock-dependent. */
  now?: Date;
}

export function buildIcs(e: IcsEvent): string {
  const stamp = `${(e.now ?? new Date()).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const start = dateTime(e.dateISO, e.startTime);

  const when: string[] = [];
  if (start) {
    let end = dateTime(e.dateISO, e.endTime);
    // A party that ends at 02:00 ends the next day, not fourteen hours before
    // it started.
    if (end && end <= start) end = `${nextDay(e.dateISO)}T${end.slice(9)}`;
    when.push(`DTSTART:${start}`);
    // No end time: default to five hours, which is a wedding, not a meeting.
    when.push(`DTEND:${end ?? `${dateOnly(e.dateISO)}T${String(Math.min(23, Number(start.slice(9, 11)) + 5)).padStart(2, '0')}${start.slice(11, 13)}00`}`);
  } else {
    when.push(`DTSTART;VALUE=DATE:${dateOnly(e.dateISO)}`);
    when.push(`DTEND;VALUE=DATE:${nextDay(e.dateISO)}`);
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kalas//Wedding//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(e.uid)}`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.url ? [`URL:${escapeText(e.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF throughout, and a trailing one — Outlook is strict about both.
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
