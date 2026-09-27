/* The default plan's milestones, dated for a wedding on 12 September 2026.
   milestones.ts re-anchors them on the couple's own date, keeping the lead
   times (venue about a year out, invitations about three weeks). */

export type DefaultMilestone = {
  id: string;
  title: string;
  description: string;
  dateISO: string;
  status: 'done' | 'active' | 'upcoming';
  owner: 'ava' | 'couple';
};

export const defaultTimeline: DefaultMilestone[] = [
  { id: 't1', title: 'Sæt budget & gæsteliste', description: 'Skab rammen, alt andet hænger på de to tal.', dateISO: '2025-07-12', status: 'done', owner: 'couple' },
  { id: 't2', title: 'Book venue', description: 'Vigtigste beslutning. Avas top 3 ligger klar.', dateISO: '2025-09-12', status: 'done', owner: 'couple' },
  { id: 't3', title: 'Save-the-dates', description: 'Især hvis I gifter jer i højsæson eller i udlandet.', dateISO: '2025-10-12', status: 'done', owner: 'couple' },
  { id: 't4', title: 'Book fotograf', description: 'Editorial-fotografer booker 12-18 mdr. i forvejen.', dateISO: '2025-11-12', status: 'done', owner: 'couple' },
  { id: 't5', title: 'Brudekjole & jakkesæt', description: 'Regn med 3-4 prøvninger og tilretning.', dateISO: '2026-01-12', status: 'done', owner: 'couple' },
  { id: 't6', title: 'Florist & dekoration', description: 'Brief: stil, palet, antal borde.', dateISO: '2026-03-12', status: 'done', owner: 'ava' },
  { id: 't7', title: 'Musik / DJ / band', description: 'Ceremoni, middag, fest, tre forskellige stemninger.', dateISO: '2026-03-12', status: 'done', owner: 'ava' },
  { id: 't8', title: 'Kage & dessert', description: 'Smagsprøver bør ske 2-3 mdr. inden.', dateISO: '2026-04-12', status: 'done', owner: 'ava' },
  { id: 't9', title: 'Vielsesattest & jura', description: 'Prøvelsesattest gælder kun 4 måneder.', dateISO: '2026-06-12', status: 'done', owner: 'couple' },
  { id: 't10', title: 'Endelig prøvepasning', description: 'Tøj, sko, smykker, alt samlet én gang.', dateISO: '2026-07-12', status: 'active', owner: 'couple' },
  { id: 't11', title: 'Bordplan & menu låst', description: 'Trækkes fra RSVP-svar.', dateISO: '2026-08-12', status: 'upcoming', owner: 'couple' },
  { id: 't12', title: 'Invitationer sendt', description: 'Send 8-10 uger inden, giv gæsterne tid.', dateISO: '2026-08-20', status: 'upcoming', owner: 'couple' },
  { id: 't13', title: 'Koordinering med leverandører', description: 'Bekræft alle tider og fremmøde.', dateISO: '2026-09-05', status: 'upcoming', owner: 'ava' },
  { id: 't14', title: 'Jeres dag', description: 'Bare vær til stede.', dateISO: '2026-09-12', status: 'upcoming', owner: 'couple' },
];
