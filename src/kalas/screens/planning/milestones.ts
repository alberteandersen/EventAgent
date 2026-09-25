import { timeline as MOCK_TIMELINE } from '../../data';

// The mock timeline is a proven default plan anchored on its own wedding day.
// We re-anchor every milestone onto the couple's real date, preserving the
// relative lead times (book venue ~12 months out, invitations ~3 weeks, …).
const MOCK_WED_MS = new Date(MOCK_TIMELINE[MOCK_TIMELINE.length - 1].dateISO).getTime();

/** The default milestones' titles, to tell them from ones the couple added. */
export const DEFAULT_MILESTONE_TITLES = new Set(MOCK_TIMELINE.map((m) => m.title));

/**
 * Which checklist area each milestone belongs to, so it sits with that area's
 * to-dos in the plan: the big decision first, the small print under it.
 *
 * "Jeres dag" is deliberately absent: it keeps the 'wedding_day' sentinel that
 * drives the "Dagen" status, and it is the wedding itself rather than a task in
 * an area. `category` can only carry one of the two meanings, and this is the
 * one row where the sentinel wins. See migration 0023 for the backfill.
 */
export const MILESTONE_AREA: Record<string, string> = {
  'Sæt budget & gæsteliste': 'okonomi',
  'Book venue': 'venue',
  'Save-the-dates': 'papir',
  'Book fotograf': 'foto',
  'Brudekjole & jakkesæt': 'stil',
  'Florist & dekoration': 'stil',
  'Musik / DJ / band': 'dagen',
  'Kage & dessert': 'mad',
  'Vielsesattest & jura': 'jura',
  'Endelig prøvepasning': 'stil',
  'Bordplan & menu låst': 'gaester',
  'Invitationer sendt': 'papir',
  'Koordinering med leverandører': 'optil',
};

export function defaultMilestones(weddingISO: string) {
  const wed = new Date(weddingISO).getTime();
  return MOCK_TIMELINE.map((t, i) => {
    const offset = new Date(t.dateISO).getTime() - MOCK_WED_MS;
    return {
      title: t.title,
      due_date: new Date(wed + offset).toISOString().slice(0, 10),
      category: i === MOCK_TIMELINE.length - 1 ? 'wedding_day' : MILESTONE_AREA[t.title] ?? null,
      kind: 'milestone' as const,
      done: false,
      sort: i,
    };
  });
}
