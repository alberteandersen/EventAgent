/* Central mock data for Kalas. Every SaaS surface is *pre-populated* from
   the onboarding interview, nothing is an empty bucket. This module is the
   single source of truth the screens read from. */

export const img = (id: string, w = 1100) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/* Curated, reusable imagery. Cards always sit on a warm fallback colour, so a
   missed photo still reads as intentional. */
export const IMAGES = {
  orangeri: img('1519225421980-715cb0215aed'),
  arch: img('1606800052052-a08af7148866'),
  lavender: img('1499002238440-d264edd596ec'),
  invitation: img('1607344645866-009c320b63e0'),
  olive: img('1445510861639-5651173bc5d5'),
  candles: img('1464195244916-405fa0a82545'),
  longTable: img('1530103862676-de8c9debad1d'),
  florals: img('1522673607200-164d1b6ce486'),
  barn: img('1464366400600-7168b8af9bc3'),
  ceremony: img('1465495976277-4387d4b0b4c6'),
  cake: img('1535254973040-607b474cb50d'),
  rings: img('1591604466107-ec97de577aff'),
  portrait: img('1519741497674-611481863552'),
};

export type Couple = {
  a: string;
  b: string;
  dateISO: string;        // wedding date
  dateLabel: string;
  guests: number;
  budgetTotal: number;    // DKK
  region: string;
  style: string;
  email: string;
};

export const couple: Couple = {
  a: 'Emma',
  b: 'Frederik',
  dateISO: '2026-09-12',
  dateLabel: '12. september 2026',
  guests: 118,
  budgetTotal: 180000,
  region: 'Sjælland · nær København',
  style: 'Rustik elegance',
  email: 'emma.frederik@gmail.com',
};

/* Days until the wedding, from a fixed "today" so the demo is stable. */
export const TODAY = new Date('2026-06-14');
export const daysUntil = Math.max(
  0,
  Math.round((new Date(couple.dateISO).getTime() - TODAY.getTime()) / 86400000),
);

/* ── Approval queue — the heart of "she does it, you oversee it" ──────── */
export type QueueItem = {
  id: string;
  index: string;
  kicker: string;
  title: string;
  body: string;
  image: keyof typeof IMAGES;
  primary: string;
  secondary: string;
};

export const queue: QueueItem[] = [
  {
    id: 'venues',
    index: '01',
    kicker: 'Venue · shortlist',
    title: `Jeg har fundet 12 steder, der matcher jeres stil '${couple.style}' og budget på ${Math.round(couple.budgetTotal / 3000)}.000 kr.`,
    body: 'Klar til at swipe igennem? Det tager omkring tre minutter, I markerer dem, I elsker, og jeg rækker ud i morgen tidlig.',
    image: 'orangeri',
    primary: 'Start swipe-mode',
    secondary: 'Senere',
  },
  {
    id: 'outreach',
    index: '02',
    kicker: 'Outreach · udkast',
    title: 'Udkast til de 6 lokationer, I godkendte. Klar til at sende via Gmail.',
    body: `Ava sender personlige mails med jeres dato (${couple.dateLabel}), ${couple.guests} gæster og stilen '${couple.style}'. Klar til godkendelse.`,
    image: 'longTable',
    primary: 'Godkend & send',
    secondary: 'Læs udkast',
  },
  {
    id: 'photographers',
    index: '03',
    kicker: 'Fotograf · sammenligning',
    title: 'Tre fotografer har svaret. Pris og stil ligger side om side.',
    body: 'Spændet er 18.500 – 32.000 kr. Jeg har markeret den, der bedst rammer jeres moodboard.',
    image: 'invitation',
    primary: 'Sammenlign & vælg',
    secondary: 'Læs samtalerne',
  },
];

/* ── Timeline / planning ─────────────────────────────────────────────── */
export type Task = {
  id: string;
  title: string;
  description: string;
  dateISO: string;
  status: 'done' | 'active' | 'upcoming';
  owner: 'ava' | 'couple';
};

export const timeline: Task[] = [
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

/* ── Budget allocation — Ava's proposal, editable by the couple ──────── */
export type BudgetLine = {
  id: string;
  label: string;
  pct: number;          // share of total
  spent: number;        // DKK committed/paid
  hint: string;
  icon: string;         // BudgetIconId, fixed for standards, pickable for custom
  color: string;        // hex, fixed for standards, pickable for custom
};

export const budgetLines: BudgetLine[] = [
  { id: 'venue',    label: 'Venue',                  pct: 26, spent: 0, hint: '', icon: 'building', color: '#4A5D3A' },
  { id: 'rental',   label: 'Leje & udstyr',          pct:  7, spent: 0, hint: '', icon: 'tent',     color: '#9A8354' },
  { id: 'catering', label: 'Mad & drikke',           pct: 27, spent: 0, hint: '', icon: 'utensils', color: '#C17A4A' },
  { id: 'photo',    label: 'Foto & film',            pct: 11, spent: 0, hint: '', icon: 'camera',   color: '#5A6E7A' },
  { id: 'florals',  label: 'Blomster & dekoration',  pct:  9, spent: 0, hint: '', icon: 'flower',   color: '#A66B7A' },
  { id: 'music',    label: 'Musik & underholdning',  pct:  7, spent: 0, hint: '', icon: 'music',    color: '#8B6B3A' },
  { id: 'attire',   label: 'Tøj & beauty',           pct:  8, spent: 0, hint: '', icon: 'shirt',    color: '#8B5E4A' },
  { id: 'misc',     label: 'Invitationer & andet',   pct:  5, spent: 0, hint: '', icon: 'mail',     color: '#6B7568' },
];

/* ── Vendors / quote tracker ─────────────────────────────────────────── */
export type VendorStatus = 'replied' | 'sent' | 'pending' | 'booked';
export type Vendor = {
  id: string;
  name: string;
  category: string;
  status: VendorStatus;
  price?: string;
  match: number;
  image: keyof typeof IMAGES;
  blurb: string;
};

export const vendors: Vendor[] = [
  { id: 'v1', name: 'Sonnerupgaard Gods', category: 'Venue', status: 'replied', price: '58.000 kr', match: 96, image: 'orangeri', blurb: 'Orangeri + lade, plads til 130. Dato ledig.' },
  { id: 'v2', name: 'Kongsdal Gods', category: 'Venue', status: 'sent', match: 91, image: 'barn', blurb: 'Romantisk avlsgård med lange borde.' },
  { id: 'v3', name: 'Studio Hald Foto', category: 'Fotograf', status: 'replied', price: '24.000 kr', match: 94, image: 'portrait', blurb: 'Lyst, dokumentarisk. Rammer moodboard.' },
  { id: 'v4', name: 'Marie Lyng Foto', category: 'Fotograf', status: 'replied', price: '18.500 kr', match: 88, image: 'rings', blurb: 'Filmisk, varm tonalitet.' },
  { id: 'v5', name: 'Lupin & Lavendel', category: 'Florist', status: 'pending', match: 90, image: 'florals', blurb: 'Sæsonens markblomster, jordnær stil.' },
  { id: 'v6', name: 'Tang & Bord Catering', category: 'Catering', status: 'pending', match: 87, image: 'longTable', blurb: 'Nordisk, råvaredrevet menu.' },
];

/* ── Venue comparison — side-by-side, the way Ava presents it ─────────── */
export type VenueCompare = {
  id: string;
  name: string;
  note: string;
  price: string;
  capacity: string;
  included: string[];
  excluded: string[];
  available: boolean;
  image: keyof typeof IMAGES;
};

export const venueCompare: VenueCompare[] = [
  {
    id: 'sonnerup', name: 'Sonnerupgaard Gods', note: "Bedste match på 'rustik elegance'",
    price: '62.000 kr', capacity: 'Op til 140 gæster',
    included: ['Fri bar inkluderet', 'Stole & borde', 'Værelser til 24'],
    excluded: ['Rengøring ekstra', 'Kage ikke inkluderet'],
    available: true, image: 'orangeri',
  },
  {
    id: 'sohuset', name: 'Søhuset Pier', note: 'Smukkest til middag, kortere aften',
    price: '78.500 kr', capacity: 'Op til 110 gæster',
    included: ['Catering inkluderet', 'Lydanlæg', 'Levende lys'],
    excluded: ['Værelser ikke inkluderet', 'Sluttid kl. 01'],
    available: true, image: 'longTable',
  },
  {
    id: 'lade', name: 'Lille Lade', note: 'Datoen er optaget, bedt om alternativ weekend',
    price: '52.000 kr', capacity: 'Op til 160 gæster',
    included: ['Råt rum', 'Adgang dagen før', 'Egen catering tilladt'],
    excluded: ['Intet køkken', 'Toiletter udendørs'],
    available: false, image: 'barn',
  },
];

/* ── Website "lenses" (themes) ───────────────────────────────────────── */
export type Lens = { id: string; name: string; tagline: string; image: keyof typeof IMAGES };
export const lenses: Lens[] = [
  { id: 'minimal', name: 'The Minimalist', tagline: 'Luft, ro og få ord.', image: 'candles' },
  { id: 'editorial', name: 'The Editorial', tagline: 'Magasin-grid med store overskrifter.', image: 'invitation' },
  { id: 'organic', name: 'The Organic', tagline: 'Jordnær, botanisk, varm.', image: 'olive' },
  { id: 'garden', name: 'The Garden', tagline: 'Lyst orangeri, grønt overalt.', image: 'orangeri' },
  { id: 'waterside', name: 'The Waterside', tagline: 'Skumring ved vandet.', image: 'lavender' },
];

/* ── RSVP aggregate (drives the guest rings) ─────────────────────────── */
export const rsvpStats = { invited: 80, total: couple.guests, ja: 64, nej: 2, afventer: 14 };

/* ── Inspiration / moodboard ─────────────────────────────────────────── */
export const moodboard: Array<{ id: string; image: keyof typeof IMAGES; tall?: boolean; caption: string }> = [
  { id: 'm1', image: 'olive', caption: 'Olivengrøn · dæmpet' },
  { id: 'm2', image: 'orangeri', tall: true, caption: 'Orangeri ved skumring' },
  { id: 'm3', image: 'invitation', caption: 'Papir & segl' },
  { id: 'm4', image: 'candles', tall: true, caption: 'Stearinlys, lange borde' },
  { id: 'm5', image: 'lavender', caption: 'Lavendel' },
  { id: 'm6', image: 'florals', caption: 'Markblomster' },
  { id: 'm7', image: 'arch', tall: true, caption: 'Blomsterbue' },
  { id: 'm8', image: 'cake', caption: 'Naken kage' },
];

export const palette = ['#2e3325', '#9da980', '#dfe2cf', '#b98e72', '#f1e8e0', '#e4dfd1'];

/* ── Wedding DNA traits ──────────────────────────────────────────────── */
export type DNATrait = { label: string; pct: number };
export const dnaTraits: DNATrait[] = [
  { label: 'European Romance', pct: 95 },
  { label: 'Natural Elegance', pct: 91 },
  { label: 'Modern Luxury', pct: 74 },
  { label: 'Garden & Botanical', pct: 68 },
  { label: 'Rustic', pct: 12 },
];

/* ── Venue recommendations (DNA-matched) ─────────────────────────────── */
export type VenueRec = {
  id: string;
  name: string;
  location: string;
  image: keyof typeof IMAGES;
  match: number;
  price: string;
  capacity: string;
  tags: string[];
  why: string[];
  quote: string;
};

export const venueRecs: VenueRec[] = [
  {
    id: 'villa-cph',
    name: 'Villa Copenhagen',
    location: 'Indre By, København',
    image: 'orangeri',
    match: 98,
    price: '65.000 kr',
    capacity: '120 gæster',
    tags: ['EGET KØKKEN', 'WEEKEND LEDIGT', 'OVERNATNING'],
    why: [
      'Matcher jeres moodboard tættest',
      'Passer præcis til 120 gæster',
      'Indenfor 250.000 kr budget',
      'Lignende steder fik jeres ❤️',
    ],
    quote: 'Lyset her ved skumring er ikke til at beskrive, det er den slags, der gør fotografer glade.',
  },
  {
    id: 'kokkedal',
    name: 'Kokkedal Slot',
    location: 'Kokkedal, Nordsjælland',
    image: 'arch',
    match: 96,
    price: '72.000 kr',
    capacity: '130 gæster',
    tags: ['SLOTSPARK', 'OVERNATNING 24', 'EGET KØKKEN'],
    why: [
      'European Romance 95%, stærkt match',
      'Botanisk have matcher Natural Elegance',
      'Historisk charme, moderne service',
      'Ava anbefaler lørdag 12. september',
    ],
    quote: 'En lørdag i september i slotsparken er noget af det smukkeste, Sjælland kan tilbyde.',
  },
  {
    id: 'nimb',
    name: 'Nimb Terrasse',
    location: 'Tivoli, København',
    image: 'candles',
    match: 93,
    price: '89.000 kr',
    capacity: '100 gæster',
    tags: ['BYUDSIGT', 'MICHELIN CATERING', 'EKSKLUSIVT'],
    why: [
      'Modern Luxury 74% i jeres DNA',
      'Catering inkluderet i prisen',
      'Unik Tivoli-udsigt om aftenen',
      'Eksklusivt lukket for private events',
    ],
    quote: 'Tivoli om natten som baggrund til jeres første dans.',
  },
];

/* ── Guests / RSVP ───────────────────────────────────────────────────── */
export type Guest = {
  id: string;
  name: string;
  side: 'Emma' | 'Frederik' | 'Fælles';
  rsvp: 'ja' | 'nej' | 'afventer';
  meal?: 'kød' | 'fisk' | 'vegetar';
};

export const guests: Guest[] = [
  { id: 'g1', name: 'Sofie & Mathias Holm', side: 'Emma', rsvp: 'ja', meal: 'kød' },
  { id: 'g2', name: 'Anders Bisgaard', side: 'Frederik', rsvp: 'ja', meal: 'fisk' },
  { id: 'g3', name: 'Familien Lund', side: 'Fælles', rsvp: 'ja', meal: 'vegetar' },
  { id: 'g4', name: 'Caroline Vinther', side: 'Emma', rsvp: 'afventer' },
  { id: 'g5', name: 'Jonas & Mette', side: 'Frederik', rsvp: 'ja', meal: 'kød' },
  { id: 'g6', name: 'Onkel Per', side: 'Frederik', rsvp: 'nej' },
  { id: 'g7', name: 'Ida Sønderby', side: 'Emma', rsvp: 'afventer' },
  { id: 'g8', name: 'Kollegaer · bord 7', side: 'Fælles', rsvp: 'ja', meal: 'fisk' },
];

/* ── Ava conversation seeds ──────────────────────────────────────────── */
export type ChatMsg = { id: string; from: 'ava' | 'me'; text: string };

export const avaThread: ChatMsg[] = [
  { id: 'c1', from: 'ava', text: 'Godmorgen! Sonnerupgaard svarede i nat, datoen er ledig, og de tilbyder orangeriet til 58.000 kr. inkl. borde og stole. Skal jeg booke en visning?' },
  { id: 'c2', from: 'me', text: 'Ja tak, gerne en lørdag.' },
  { id: 'c3', from: 'ava', text: 'Perfekt. Jeg foreslår lørdag d. 28. juni kl. 11. Jeg sender en bekræftelse, så snart de svarer. Imens: vil I se de tre fotograftilbud side om side?' },
];

export const onboardingScript: ChatMsg[] = [
  { id: 'o1', from: 'ava', text: 'Hej Emma og Frederik. Jeg er Ava, jeg planlægger jeres bryllup, så I kan nyde det. Lad os tage en kort snak. Hvornår drømmer I om at gifte jer?' },
  { id: 'o2', from: 'me', text: 'Vi tænker september næste år, gerne en lørdag.' },
  { id: 'o3', from: 'ava', text: 'Dejligt, sensommer er smukt. Hvor mange gæster regner I cirka med?' },
  { id: 'o4', from: 'me', text: 'Omkring 120.' },
  { id: 'o5', from: 'ava', text: 'Noteret. Og hvor i landet? Hvor langt vil I rejse for det rette sted?' },
  { id: 'o6', from: 'me', text: 'Sjælland, nær København. Op til en times kørsel.' },
  { id: 'o7', from: 'ava', text: 'Sidste store: hvad er jeres samlede budget, et cirkatal er fint.' },
  { id: 'o8', from: 'me', text: 'Vi har sat 180.000 af.' },
  { id: 'o9', from: 'ava', text: 'Og stemningen? Beskriv det med tre ord, eller vis mig et billede.' },
  { id: 'o10', from: 'me', text: 'Rustik elegance, lange borde, stearinlys, et glashus eller en lade.' },
];
