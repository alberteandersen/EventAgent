/* Hand-crafted template designs — the couple's starting points. Each is a
   complete, opinionated SiteDesign (every section included so content
   toggles always work) that applies instantly with no AI call; Juno then
   personalizes and edits FROM the chosen template. Curated with real
   contrast care: text/bg and onAccent/accent pairs aim for WCAG AA. */

import type { SiteDesign } from './design';

export interface SitePreset {
  id: string;
  /** Chip label in the builder (matches the old vibe vocabulary). */
  label: string;
  /** One-line sell for the card. */
  tagline: string;
  design: SiteDesign;
}

const allSections = (
  overrides: Partial<Record<string, { variant?: string; bg?: 'default' | 'surface' | 'wash' | 'inverse' }>> = {}
): SiteDesign['sections'] => {
  const base: [string, string][] = [
    ['story', 'centered'], ['program', 'timeline'], ['gallery', 'grid'],
    ['gifts', 'cards'], ['transport', 'text'], ['dresscode', 'text'],
    ['hotel', 'cards'], ['faq', 'accordion'], ['rsvp', 'band'],
  ];
  return base.map(([id, variant]) => ({
    id: id as SiteDesign['sections'][number]['id'],
    variant: overrides[id]?.variant ?? variant,
    bg: overrides[id]?.bg ?? 'default',
  }));
};

export const SITE_PRESETS: SitePreset[] = [
  {
    id: 'romantisk',
    label: 'Romantisk',
    tagline: 'Blide rosentoner, buet forsidebillede og håndskriftsdetaljer.',
    design: {
      version: 1,
      concept: { name: 'Rosenbrev', rationale: 'Blødt og hjerteligt, som et kærestebrev sat i tryk, med buede billeder og varme rosentoner.' },
      palette: { bg: '#faf3f0', surface: '#ffffff', text: '#4a2e33', muted: '#96707a', accent: '#a85d5d', onAccent: '#fdf6f4', heroOverlay: 0.3 },
      typography: { displayFont: 'playfair', bodyFont: 'karla', displayWeight: 500, displayItalic: true, uppercaseEyebrows: true, scale: 'large', tracking: 'normal' },
      shape: { radius: 'round', density: 'comfortable', borders: 'hairline', maxWidth: 'normal' },
      hero: { variant: 'arch', showCountdown: true },
      sections: allSections({ story: { variant: 'quote', bg: 'surface' }, gallery: { variant: 'masonry' }, rsvp: { bg: 'wash' } }),
      copy: { tagline: 'Kom og fejr kærligheden med os', storyIntro: '', rsvpCta: 'Svar på invitationen', footerLine: 'Vi glæder os til at se jer' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'botanical', dividers: true },
    },
  },
  {
    id: 'minimalistisk',
    label: 'Minimalistisk',
    tagline: 'Hvidt galleri, stor typografi og absolut ro.',
    design: {
      version: 1,
      concept: { name: 'Galleri', rationale: 'Næsten ingenting. Kun jeres navne i stor skala, luft og billederne. Roen er designet.' },
      palette: { bg: '#fafaf8', surface: '#f1f1ee', text: '#1c1c1a', muted: '#8a8a84', accent: '#1c1c1a', onAccent: '#fafaf8', heroOverlay: 0.25 },
      typography: { displayFont: 'jost', bodyFont: 'inter', displayWeight: 400, displayItalic: false, uppercaseEyebrows: true, scale: 'dramatic', tracking: 'wide' },
      shape: { radius: 'none', density: 'airy', borders: 'none', maxWidth: 'narrow' },
      hero: { variant: 'minimal', showCountdown: false },
      sections: allSections({ program: { variant: 'minimal' }, gallery: { variant: 'grid' }, faq: { variant: 'two-col' }, rsvp: { bg: 'inverse' } }),
      copy: { tagline: 'To bliver til ét', storyIntro: '', rsvpCta: 'RSVP', footerLine: '' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'none', dividers: false },
    },
  },
  {
    id: 'boheme',
    label: 'Boheme',
    tagline: 'Varmt sand, botaniske streger og magasinopslag.',
    design: {
      version: 1,
      concept: { name: 'Vildblomst', rationale: 'Jordnær og fribåren, med sandfarver, botaniske streger og billeder der falder som et moodboard.' },
      palette: { bg: '#f4ead9', surface: '#fbf4e8', text: '#4a3a28', muted: '#8f7a5e', accent: '#9c6b3a', onAccent: '#fbf4e8', heroOverlay: 0.32 },
      typography: { displayFont: 'fraunces', bodyFont: 'hanken', displayWeight: 500, displayItalic: true, uppercaseEyebrows: false, scale: 'large', tracking: 'normal' },
      shape: { radius: 'round', density: 'comfortable', borders: 'none', maxWidth: 'wide' },
      hero: { variant: 'editorial', showCountdown: true },
      sections: allSections({ story: { variant: 'side-image' }, gallery: { variant: 'masonry' }, program: { variant: 'columns', bg: 'surface' }, rsvp: { bg: 'wash' } }),
      copy: { tagline: 'Under åben himmel, med dem vi elsker', storyIntro: '', rsvpCta: 'Kommer I?', footerLine: 'Barfodet er også dresscode' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'botanical', dividers: true },
    },
  },
  {
    id: 'klassisk',
    label: 'Klassisk',
    tagline: 'Elfenben, garamond og en diskret gylden linje.',
    design: {
      version: 1,
      concept: { name: 'Monogram', rationale: 'Tidløst og formelt, med elfenben, klassisk serif og en enkelt gylden accent, som et smukt trykt program.' },
      palette: { bg: '#f8f5ee', surface: '#ffffff', text: '#26303e', muted: '#6e7683', accent: '#8c7347', onAccent: '#f8f5ee', heroOverlay: 0.4 },
      typography: { displayFont: 'eb-garamond', bodyFont: 'inter', displayWeight: 500, displayItalic: false, uppercaseEyebrows: true, scale: 'normal', tracking: 'wide' },
      shape: { radius: 'none', density: 'comfortable', borders: 'hairline', maxWidth: 'normal' },
      hero: { variant: 'framed', showCountdown: true },
      sections: allSections({ story: { bg: 'surface' }, hotel: { variant: 'list' }, rsvp: { bg: 'inverse' } }),
      copy: { tagline: 'Vi har den glæde at invitere jer', storyIntro: '', rsvpCta: 'Svar udbedes', footerLine: '' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'lines', dividers: true },
    },
  },
  {
    id: 'moderne',
    label: 'Moderne',
    tagline: 'Splitforside, grotesk typografi og skarpe kontraster.',
    design: {
      version: 1,
      concept: { name: 'Kontrast', rationale: 'Grafisk og nutidigt, med splitforside, tæt grotesk og dyb grøn som eneste farve.' },
      palette: { bg: '#ffffff', surface: '#f4f4f2', text: '#101014', muted: '#70706a', accent: '#1f3d33', onAccent: '#f2f5f3', heroOverlay: 0.35 },
      typography: { displayFont: 'space-grotesk', bodyFont: 'inter', displayWeight: 700, displayItalic: false, uppercaseEyebrows: true, scale: 'large', tracking: 'tight' },
      shape: { radius: 'soft', density: 'compact', borders: 'bold', maxWidth: 'wide' },
      hero: { variant: 'split', showCountdown: true },
      sections: allSections({ program: { variant: 'columns' }, faq: { variant: 'two-col' }, gallery: { variant: 'filmstrip' }, rsvp: { bg: 'inverse' } }),
      copy: { tagline: 'Vi gifter os. Kom og vær med.', storyIntro: '', rsvpCta: 'Svar her', footerLine: '' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'none', dividers: false },
    },
  },
  {
    id: 'dramatisk',
    label: 'Dramatisk',
    tagline: 'Midnatsmørkt med guld og stjernedrys.',
    design: {
      version: 1,
      concept: { name: 'Midnat', rationale: 'Mørkt, luksuriøst og festligt. Sort aften, guldaccenter og stjerner mellem afsnittene.' },
      palette: { bg: '#171a1e', surface: '#22262c', text: '#ece7dd', muted: '#a5a89f', accent: '#c2a15c', onAccent: '#171a1e', heroOverlay: 0.55 },
      typography: { displayFont: 'bodoni', bodyFont: 'karla', displayWeight: 500, displayItalic: false, uppercaseEyebrows: true, scale: 'dramatic', tracking: 'wide' },
      shape: { radius: 'soft', density: 'comfortable', borders: 'hairline', maxWidth: 'normal' },
      hero: { variant: 'full-bleed', showCountdown: true },
      sections: allSections({ story: { variant: 'quote' }, gallery: { variant: 'filmstrip', bg: 'surface' }, rsvp: { bg: 'surface' } }),
      copy: { tagline: 'En aften vi aldrig glemmer', storyIntro: '', rsvpCta: 'Jeg kommer', footerLine: 'Sort slips valgfrit, dansesko obligatorisk' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'stars', dividers: true },
    },
  },
  {
    id: 'farverigt',
    label: 'Farverigt',
    tagline: 'Varm koral, legende typer og konfettiprikker.',
    design: {
      version: 1,
      concept: { name: 'Konfetti', rationale: 'Glad og legende, med varm koral mod fløde, runde former og prikker som konfetti.' },
      palette: { bg: '#fff8ef', surface: '#ffffff', text: '#3a2d4f', muted: '#7f7490', accent: '#d1502f', onAccent: '#fff6ee', heroOverlay: 0.3 },
      typography: { displayFont: 'dm-serif', bodyFont: 'jost', displayWeight: 400, displayItalic: false, uppercaseEyebrows: false, scale: 'large', tracking: 'normal' },
      shape: { radius: 'round', density: 'comfortable', borders: 'none', maxWidth: 'normal' },
      hero: { variant: 'arch', showCountdown: true },
      sections: allSections({ gallery: { variant: 'filmstrip' }, program: { bg: 'wash' }, rsvp: { bg: 'inverse' } }),
      copy: { tagline: 'Det bliver en fest!', storyIntro: '', rsvpCta: 'Jeg er med!', footerLine: 'Tak fordi I fejrer os' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'dots', dividers: true },
    },
  },
  {
    id: 'nordisk',
    label: 'Nordisk',
    tagline: 'Kølige fjordtoner, luft og stille elegance.',
    design: {
      version: 1,
      concept: { name: 'Fjord', rationale: 'Skandinavisk ro, med kølige grå-grønne toner, luftige afsnit og en enkel elegance.' },
      palette: { bg: '#f2f4f2', surface: '#fbfcfb', text: '#24312c', muted: '#6d7a74', accent: '#40655a', onAccent: '#f3f6f4', heroOverlay: 0.35 },
      typography: { displayFont: 'cormorant', bodyFont: 'hanken', displayWeight: 500, displayItalic: false, uppercaseEyebrows: true, scale: 'normal', tracking: 'normal' },
      shape: { radius: 'soft', density: 'airy', borders: 'hairline', maxWidth: 'normal' },
      hero: { variant: 'split', showCountdown: true },
      sections: allSections({ story: { bg: 'surface' }, program: { variant: 'minimal' }, hotel: { variant: 'list' }, rsvp: { bg: 'inverse' } }),
      copy: { tagline: 'Stille glæde, stor dag', storyIntro: '', rsvpCta: 'Svar på invitation', footerLine: '' },
      images: { heroPhotoId: '', galleryPhotoIds: [] },
      decor: { style: 'lines', dividers: false },
    },
  },
];

export const findPreset = (id: string): SitePreset | null =>
  SITE_PRESETS.find((p) => p.id === id) ?? null;
