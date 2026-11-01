import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  Check, ArrowLeft, ArrowRight, MapPin, Lock, Star, X, Search, ImagePlus, Plus, Loader2,
} from 'lucide-react';
import { GUEST_BANDS, type OnboardingDate } from '@/lib/onboarding';
import { isPlausibleEmail } from '@/lib/invites/email';
import type { ScreenId } from '../Shell';
import { Wordmark, cn } from '../ui';
import WeddingRings from '../icons/WeddingRings';
import { useLang } from '../i18n';
import { countryFocus, countryLabel, globeCountry, searchCountries } from '../onboarding/countries';
import { normalizeImage } from '../site/normalizeImage';

const WeddingDatePicker = dynamic(() => import('../onboarding/WeddingDatePicker'), { ssr: false });

const DestinationGlobe = dynamic(() => import('../onboarding/DestinationGlobe'), {
  ssr: false,
  loading: () => <GlobeLoading />,
});

function GlobeLoading() {
  const { t } = useLang();
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-serif text-[0.95rem] italic text-muted">{t('Indlæser kloden…')}</span>
    </div>
  );
}

/** A picked photo, held locally until the wedding exists to file it under. */
export type PhotoDraft = { id: string; file: File; url: string };

/* Structured onboarding state — chips + bands instead of loose text, so the
   journey logic and Juno's briefs get clean, bounded inputs. */
export type FormState = {
  nameA: string; nameB: string;
  locations: string[];  // the globe's country names, or places they typed, in the order picked
  city: string;         // a town or area they already have in mind, optional
  whereUndecided: boolean;
  dateChoice: string;   // '' | season key | 'exact' | 'undecided'
  exactDate: string;    // ISO, when dateChoice === 'exact'
  guestBand: string;    // '' | GUEST_BANDS key
  budgetAmount: number;
  budgetPrivate: boolean;
  partnerEmail: string;
  photos: PhotoDraft[]; // first one becomes the hero
};

export const EMPTY_FORM: FormState = {
  nameA: '', nameB: '',
  locations: [], city: '', whereUndecided: false,
  dateChoice: '', exactDate: '',
  guestBand: '', budgetAmount: 200_000, budgetPrivate: false,
  partnerEmail: '', photos: [],
};

/* ── Danish chip vocabularies (reuse the shared band keys for the backend) ─ */
const GUEST_LABELS_DA: Record<string, string> = {
  just_us: 'Kun os to',
  under_50: 'Under 50',
  '50_100': '50–100',
  '100_150': '100–150',
  '150_plus': '150+',
  not_sure: 'Ved ikke endnu',
};

const BUDGET_MIN = 50_000;
const BUDGET_MAX = 750_000;
const BUDGET_STEP = 25_000;

const SEASONS_DA = ['Forår', 'Sommer', 'Efterår', 'Vinter'] as const;
const SEASON_START_MONTH = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec

/** A rough answer to "when": a season of a year, or just the year. */
type DateChip = { key: string; season: string | null; year: number };
type TFn = (s: string, params?: Record<string, string | number>) => string;
const DATE_YEARS_AHEAD = 3;
/** Every season still to come this year and in the years after it, by year,
 *  each year ending on a chip for "some time that year". */
function dateChipsByYear(from = new Date()): { year: number; chips: DateChip[] }[] {
  const thisYear = from.getFullYear();
  const years: { year: number; chips: DateChip[] }[] = [];
  for (let year = thisYear; year <= thisYear + DATE_YEARS_AHEAD; year++) {
    const chips: DateChip[] = SEASONS_DA
      .filter((_, i) => year > thisYear || SEASON_START_MONTH[i] > from.getMonth())
      .map((season) => ({ key: `${season.toLowerCase()}_${year}`, season, year }));
    // "Some time in 2026" says nothing once there is a single season of it left.
    if (chips.length > 1) chips.push({ key: `year_${year}`, season: null, year });
    if (chips.length > 0) years.push({ year, chips });
  }
  return years;
}
const DATE_YEARS = dateChipsByYear();
const DATE_CHIPS = DATE_YEARS.flatMap((y) => y.chips);
/** The year is picked above the chips, so a chip only has to say which part of it. */
const chipLabel = (c: DateChip, t: TFn) => (c.season ? t(c.season) : t('Engang i {year}', { year: c.year }));

/* ── Payload builders (all band/date logic lives here) ─────────────────── */
function buildDate(form: FormState): OnboardingDate {
  if (form.dateChoice === 'exact' && form.exactDate) return { precision: 'exact', iso: form.exactDate };
  const chip = DATE_CHIPS.find((c) => c.key === form.dateChoice);
  if (chip) return { precision: 'season', hint: chip.season ? `${chip.season} ${chip.year}` : String(chip.year) };
  return { precision: 'undecided' };
}
function buildBudget(form: FormState): string | null {
  if (form.budgetPrivate) return null;
  return String(form.budgetAmount);
}
/* events.location holds one place, "France" or "Provence, France", and Venues
   reads the country off the end of it. So a town only goes in front when
   there is a single country for it to belong to. With several picked, the
   first is the one Venues opens on, and the whole list rides along for Juno. */
function buildWhere(form: FormState): { city: string; loved_destinations: string[] } {
  if (form.whereUndecided) return { city: '', loved_destinations: [] };
  const town = form.city.trim();
  const [first = '', ...rest] = form.locations;
  if (rest.length === 0) return { city: [town, first].filter(Boolean).join(', '), loved_destinations: [] };
  return { city: first, loved_destinations: [town, ...form.locations].filter(Boolean) };
}
export function toOnboardingPayload(form: FormState) {
  return {
    name: form.nameA.trim(),
    partner_name: form.nameB.trim() || null,
    ...buildWhere(form),
    date: buildDate(form),
    guest_band: form.guestBand || null,
    budget: buildBudget(form),
    partner_email: form.partnerEmail.trim() || null,
  };
}

/* ── Display helpers ─────────────────────────────────────────────────── */
/** A picked place as the couple reads it: the country in their language, or what they typed. */
function placeLabel(place: string, lang: string): string {
  const country = globeCountry(place);
  return country ? countryLabel(country, lang) : place;
}
type SetText = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

const inputCls = 'w-full rounded-2xl border border-line-strong bg-canvas px-4 py-3.5 text-[1rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none transition-colors';

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT, centered, traditional step flow (no chat pane)
══════════════════════════════════════════════════════════════════════ */
const STEPS = ['names', 'where', 'date', 'scope', 'photos', 'partner'] as const;
const TOTAL_STEPS = STEPS.length;

const STEP_LABELS = ['Jeres historie', 'Destination', 'Datoen', 'Omfang', 'Billeder', 'Partner'] as const;

const wonderInputCls =
  'h-[62px] w-full rounded-[14px] border bg-card px-[18px] text-base text-ink placeholder:text-muted transition-shadow focus:outline-none';

export default function Onboarding({ onEnter, initialStep = 0 }: {
  onEnter: (form: FormState, s?: ScreenId) => void | Promise<void>;
  /* A seam for /dev/onboarding: every step has to fit the viewport, and the
     only way to check the later ones is to open on them — reaching step 3 for
     real needs a country picked off the auth-gated globe. Unused in the app. */
  initialStep?: number;
}) {
  const { t, lang, setLang } = useLang();
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [entering, setEntering] = useState(false);
  const id = STEPS[step];

  /* The globe is three.js, by far the heaviest thing in onboarding. Fetch it
     while they type their names, so step two opens on the globe and not on
     "Indlæser kloden…". Same module as the dynamic() above, so one download. */
  useEffect(() => {
    const timer = window.setTimeout(() => { void import('../onboarding/DestinationGlobe'); }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const go = (next: number) => {
    if (next >= TOTAL_STEPS) {
      if (entering) return;
      setEntering(true);
      // Stays busy on success: onEnter navigates away. Only a throw hands the
      // button back.
      void Promise.resolve(onEnter(form, 'home')).catch(() => setEntering(false));
      return;
    }
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, next));
  };

  const canAdvance =
    (id === 'names' && Boolean(form.nameA.trim() && form.nameB.trim())) ||
    (id === 'where' && (form.locations.length > 0 || form.whereUndecided)) ||
    (id === 'date' && (form.dateChoice === 'exact' ? Boolean(form.exactDate) : Boolean(form.dateChoice))) ||
    (id === 'scope' && Boolean(form.guestBand)) ||
    id === 'photos' || id === 'partner';

  const nextLabel =
    entering ? t('Gør jeres rum klar…')
    : step === TOTAL_STEPS - 1 ? t('Gå ind i Kalas')
    : id === 'photos' && form.photos.length === 0 ? t('Spring over')
    : t('Fortsæt');

  return (
    /* Locked to the viewport instead of growing past it: five short questions
       should never make the page scroll, and when the footer scrolled away
       with it the "Fortsæt" button went with it. h-dvh, not h-screen, so the
       mobile address bar does not push it out of view. Only the step itself
       scrolls, and only when a step genuinely needs the room. */
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <OnboardingHeader
        step={step}
        stepLabel={t(STEP_LABELS[step])}
        lang={lang}
        onLang={setLang}
        t={t}
      />
      <div className="flex justify-end border-b border-line px-6 pb-3 sm:hidden">
        <div className="flex h-10 items-center rounded-full border border-line-strong bg-shell p-1">
          <LangPill lang={lang} onLang={setLang} />
        </div>
      </div>

      <div className={cn(
        'flex min-h-0 flex-1 flex-col px-6 lg:px-14',
        id === 'where' ? 'py-5 lg:py-6' : 'gap-8 py-6 lg:flex-row lg:gap-[52px] lg:py-8',
      )}>
        {id !== 'where' && <ContextPanel step={id} form={form} />}
        {/* my-auto, not justify-center: a step taller than the screen then
            scrolls from its top instead of having it cut off. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto py-2">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={cn('m-auto w-full', id === 'where' ? 'max-w-[1240px]' : 'max-w-[680px]')}
            >
              {id === 'names' && <NamesStep form={form} set={set} onNext={() => canAdvance && go(step + 1)} />}
              {id === 'where' && (
                <WhereStep
                  form={form}
                  setField={setField}
                  onSkip={() => {
                    setForm((f) => ({ ...f, locations: [], city: '', whereUndecided: true }));
                    go(step + 1);
                  }}
                />
              )}
              {id === 'date' && <DateStep form={form} setField={setField} />}
              {id === 'scope' && <ScopeStep form={form} setField={setField} />}
              {id === 'photos' && <PhotosStep form={form} setField={setField} />}
              {id === 'partner' && <PartnerStep form={form} set={set} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <OnboardingFooter
        onBack={step > 0 && !entering ? () => go(step - 1) : undefined}
        onNext={() => canAdvance && go(step + 1)}
        nextLabel={nextLabel}
        nextDisabled={!canAdvance || entering}
        t={t}
      />
    </div>
  );
}

function OnboardingHeader({
  step, stepLabel, lang, onLang, t,
}: {
  step: number; stepLabel: string; lang: 'da' | 'en'; onLang: (l: 'da' | 'en') => void; t: (s: string, p?: Record<string, string | number>) => string;
}) {
  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <header className="flex h-[92px] shrink-0 items-center gap-6 border-b border-line px-6 lg:gap-8 lg:px-14">
      <span className="w-[120px] shrink-0 lg:w-[220px]">
        <Wordmark />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-ink">
            {stepLabel}
          </span>
          <span className="shrink-0 text-[13px] font-medium text-muted">
            {t('Trin {a} af {b}', { a: step + 1, b: TOTAL_STEPS })}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full bg-ink"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <div className="hidden h-11 shrink-0 items-center rounded-full border border-line-strong bg-shell p-1 sm:flex">
        <LangPill lang={lang} onLang={onLang} />
      </div>
    </header>
  );
}

function LangPill({ lang, onLang }: { lang: 'da' | 'en'; onLang: (l: 'da' | 'en') => void }) {
  return (
    <div className="flex items-center">
      {(['da', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onLang(l)}
          className={cn(
            'min-w-[72px] rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
            lang === l ? 'bg-ink font-semibold text-card shadow-[0px_3px_10px_rgba(36,65,58,0.16)]' : 'text-muted',
          )}
        >
          {l === 'da' ? 'Dansk' : 'English'}
        </button>
      ))}
    </div>
  );
}

type StepId = (typeof STEPS)[number];

const CONTEXT_PANEL_COPY: Partial<Record<StepId, { eyebrow: string; title: string; sub: string }>> = {
  names: {
    eyebrow: 'En omtænksom start',
    title: 'Lad os gøre det til jeres.',
    sub: 'Et par korte trin hjælper Juno med at skræddersy opgaver og anbefalinger til jeres bryllup.',
  },
  date: {
    eyebrow: 'Datoen',
    title: 'Hvornår siger I ja?',
    sub: 'En sæson, en dato eller “vi ved det ikke endnu”, Juno tilpasser sig.',
  },
  scope: {
    eyebrow: 'Omfang',
    title: 'Hvor mange gæster?',
    sub: 'Et pejlemærke er nok, Juno bruger det til venues, budget og tidslinje.',
  },
  photos: {
    eyebrow: 'Jeres rum',
    title: 'Det skal ligne jer.',
    sub: 'Et billede på forsiden gør planlægningen til jeres egen. I kan skifte det når som helst.',
  },
  partner: {
    eyebrow: 'Sammen om det',
    title: 'Giv partneren adgang',
    sub: 'I deler samme plan, ingen duplikerede lister eller beskedkopiering. Valgfrit.',
  },
};

/** Wonder onboarding context panel — hidden on the globe step. Once they
 *  have picked a photo it previews their front page instead. */
function ContextPanel({ step, form }: { step: StepId; form: FormState }) {
  const { t } = useLang();
  const panel = CONTEXT_PANEL_COPY[step] ?? CONTEXT_PANEL_COPY.names!;
  const benefits = [t('Anbefalinger formet omkring jer'), t('Ændr ethvert svar senere')];
  const cover = form.photos[0];

  if (step === 'photos' && cover) return <CoverPreview url={cover.url} form={form} />;

  return (
    <aside className="hidden w-full max-w-[430px] shrink-0 flex-col justify-between rounded-3xl bg-ink p-[38px] shadow-[0px_18px_50px_rgba(36,65,58,0.16)] lg:flex lg:h-full lg:overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sage-strong">
          <WeddingRings size={22} className="text-card" />
        </div>
        <div className="flex flex-col gap-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage-tint">{t(panel.eyebrow)}</p>
          <h2 className="max-w-[330px] font-serif text-[clamp(2rem,4vw,2.875rem)] leading-[1.05] tracking-[-0.03em] text-card">
            {t(panel.title)}
          </h2>
          <p className="max-w-[320px] text-base leading-[1.65] text-sage-tint">{t(panel.sub)}</p>
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-3.5">
        {benefits.map((line) => (
          <div key={line} className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Check size={14} className="text-terracotta-tint" />
            </div>
            <span className="text-sm text-sage-tint">{line}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CoverPreview({ url, form }: { url: string; form: FormState }) {
  const { t, lang } = useLang();
  const names = [form.nameA.trim(), form.nameB.trim()].filter(Boolean).join(' & ');
  const place = form.whereUndecided
    ? ''
    : [form.city.trim(), ...form.locations.map((p) => placeLabel(p, lang))].filter(Boolean).slice(0, 3).join(', ');
  return (
    <aside className="relative hidden w-full max-w-[430px] shrink-0 overflow-hidden rounded-3xl bg-ink shadow-[0px_18px_50px_rgba(36,65,58,0.16)] lg:flex lg:h-full">
      <motion.div
        key={url}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${url}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/85 via-ink-deep/10 to-transparent" />
      <div className="relative mt-auto flex flex-col gap-2 p-[38px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage-tint">{t('Jeres forside')}</p>
        <h2 className="font-serif text-[clamp(2rem,3.4vw,2.6rem)] leading-[1.05] tracking-[-0.03em] text-card">
          {names || t('Jeres bryllup')}
        </h2>
        {place && (
          <p className="inline-flex items-center gap-1.5 text-sm text-sage-tint">
            <MapPin size={13} /> {place}
          </p>
        )}
      </div>
    </aside>
  );
}

function OnboardingFooter({
  onBack, onNext, nextLabel, nextDisabled, t,
}: {
  onBack?: () => void; onNext?: () => void; nextLabel: string; nextDisabled?: boolean; t: (s: string) => string;
}) {
  return (
    <footer className="flex shrink-0 flex-col gap-4 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:gap-6 lg:px-14 lg:py-[22px]">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-soft">{t('Ca. 3 minutter at gennemføre')}</p>
        <p className="text-xs text-muted">{t('Jeres svar gemmes undervejs.')}</p>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-[390px]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 items-center gap-2 rounded-full px-[18px] text-sm font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <ArrowLeft size={16} /> {t('Tilbage')}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={cn(
              'flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors cursor-pointer sm:flex-initial sm:min-w-[200px]',
              nextDisabled
                ? 'cursor-not-allowed bg-line text-muted'
                : 'bg-ink text-paper hover:bg-ink/90',
            )}
          >
            {nextLabel} {!nextDisabled && <ArrowRight size={17} />}
          </button>
        )}
      </div>
    </footer>
  );
}

/* ── Step scaffolding ────────────────────────────────────────────────── */
function StepHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  const { t } = useLang();
  return (
    <div className="mb-8">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">{t(eyebrow)}</p>
      <h2 className="display mt-3 text-[clamp(1.9rem,4.5vw,2.8rem)] leading-tight text-ink">{title}</h2>
      {sub && <p className="mt-3 max-w-md text-[0.9rem] leading-relaxed text-ink-soft">{t(sub)}</p>}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const { t } = useLang();
  return (
    <label className="block">
      <span className="mb-2 block text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-muted">{t(label)}</span>
      {children}
      {hint && <p className="mt-1.5 text-[0.75rem] text-muted">{t(hint)}</p>}
    </label>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-full border px-4 py-2 text-[0.85rem] transition-colors cursor-pointer',
        selected
          ? 'border-ink bg-sage-tint text-ink font-medium'
          : 'border-line-strong text-ink-soft hover:bg-shell')}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 1, NAMES
══════════════════════════════════════════════════════════════════════ */
function NamesStep({ form, set, onNext }: { form: FormState; set: SetText; onNext: () => void }) {
  const { t } = useLang();
  const [focus, setFocus] = useState<'a' | 'b' | null>('a');

  const fieldCls = (active: boolean) =>
    cn(
      wonderInputCls,
      active
        ? 'border-2 border-ink shadow-[0px_0px_0px_4px_rgba(122,144,104,0.18)]'
        : 'border border-line-strong',
    );

  return (
    <div className="flex flex-col gap-[34px]">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          {t('Velkommen til Kalas')}
        </p>
        <h1 className="flex flex-wrap items-baseline gap-x-3.5 font-serif text-[clamp(2.5rem,6vw,3.625rem)] leading-[1.04] tracking-[-0.03em] text-ink">
          <span>{t('Hvem skal')}</span>
          <span className="italic">{t('giftes?')}</span>
        </h1>
        <p className="max-w-[560px] text-[17px] leading-[1.6] text-muted">
          {t('Fortæl os hvad vi skal kalde jer begge. Juno bruger fornavne, så planlægningen føles personlig fra første skridt.')}
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-[9px]">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">{t('Dit fornavn')}</span>
          <input
            value={form.nameA}
            onChange={set('nameA')}
            placeholder={t('f.eks. Maya')}
            className={fieldCls(focus === 'a')}
            autoFocus
            onFocus={() => setFocus('a')}
            onBlur={() => setFocus((f) => (f === 'a' ? null : f))}
            onKeyDown={(e) => { if (e.key === 'Enter') onNext(); }}
          />
        </label>
        <label className="flex flex-1 flex-col gap-[9px]">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">{t('Partners fornavn')}</span>
          <input
            value={form.nameB}
            onChange={set('nameB')}
            placeholder={t('f.eks. Elias')}
            className={fieldCls(focus === 'b')}
            onFocus={() => setFocus('b')}
            onBlur={() => setFocus((f) => (f === 'b' ? null : f))}
            onKeyDown={(e) => { if (e.key === 'Enter') onNext(); }}
          />
        </label>
      </div>

      <div className="flex items-center gap-[9px]">
        <Lock size={15} className="shrink-0 text-muted" />
        <p className="text-[13px] text-muted">{t('Bruges kun til at personliggøre jeres planlægningsrum.')}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 2, WHERE (country search + globe)
══════════════════════════════════════════════════════════════════════ */
/* One question, answered at the level couples actually know it this early:
   the country, or the two or three they are still choosing between, and the
   town if they already have one. It used to open a drawer of cities and venues per country,
   which was a venue finder wearing an onboarding step's clothes, and Venues
   does that job properly once they are inside. The globe is here to make the
   answer feel like a place, so it follows the search instead of being the
   only way in. */
const GLOBE_H = 'h-[150px] sm:h-[260px] lg:h-[min(calc(100dvh-240px),600px)]';

/* countryFocus frames a country to fill the view, which for Italy or Denmark
   zooms in until the globe is a flat map with square corners. Here the point
   is the place on the planet, so the camera stays far enough out to keep it
   round. */
function globeFocus(country: string | null) {
  const f = countryFocus(country);
  return f ? { ...f, altitude: Math.max(f.altitude, 1.6) } : null;
}

function WhereStep({ form, setField, onSkip }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onSkip: () => void;
}) {
  const { t, lang } = useLang();
  const picks = form.locations;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const countries = picks.filter((p) => globeCountry(p) === p);
  // The camera goes to whichever country they added last.
  const latest = countries[countries.length - 1] ?? null;

  const hits = searchCountries(query).filter((c) => !picks.includes(c));
  const typed = query.trim();
  const known = (label: string) => label.toLowerCase() === typed.toLowerCase();
  // Somewhere the globe does not know ("Bornholm", "Sydfyn") is still an answer.
  const options: { value: string; label: string; free?: boolean }[] = [
    ...hits.map((c) => ({ value: c, label: countryLabel(c, lang) })),
    ...(typed.length >= 2
      && !hits.some((c) => known(countryLabel(c, lang)))
      && !picks.some((p) => known(placeLabel(p, lang)))
      ? [{ value: typed, label: t('Brug “{q}”', { q: typed }), free: true }]
      : []),
  ];

  const remove = (place: string) => setField('locations', picks.filter((p) => p !== place));
  const add = (value: string) => {
    const place = globeCountry(value) ?? value.trim();
    if (place && !picks.includes(place)) setField('locations', [...picks, place]);
    setField('whereUndecided', false);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace in an empty box takes back the last pick, as in any tag field.
    if (e.key === 'Backspace' && !query && picks.length > 0) { remove(picks[picks.length - 1]); return; }
    if (!open || options.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Enter') { e.preventDefault(); add(options[Math.min(active, options.length - 1)].value); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const fieldCls = 'w-full rounded-[14px] border border-line-strong bg-card pl-12 text-base text-ink placeholder:text-muted transition-shadow focus:border-2 focus:border-ink focus:shadow-[0px_0px_0px_4px_rgba(122,144,104,0.18)] focus:outline-none';

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-12">
      <div className="flex w-full flex-col gap-5 lg:max-w-[440px] lg:shrink-0">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">{t('Destination')}</p>
          <h1 className="font-serif text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.04] tracking-[-0.03em] text-ink">
            {t('Hvor i verden vil I')} <span className="italic">{t('giftes?')}</span>
          </h1>
          <p className="max-w-[420px] text-base leading-[1.6] text-muted">
            {t('Hjemme eller langt væk. Vælg ét land eller flere, og en by, hvis I har en i tankerne.')}
          </p>
        </div>

        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKey}
            placeholder={picks.length > 0 ? t('Tilføj et land mere') : t('Søg efter et land, f.eks. Italien')}
            className={cn(fieldCls, 'h-[62px] pr-[18px]')}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls="where-options"
            aria-autocomplete="list"
            autoFocus
          />

          <AnimatePresence>
            {open && options.length > 0 && (
              <motion.ul
                id="where-options"
                role="listbox"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[14px] border border-line-strong bg-card py-1.5 shadow-[0px_14px_36px_rgba(36,65,58,0.14)]"
              >
                {options.map((o, i) => (
                  <li key={o.value + (o.free ? ':free' : '')} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      // mousedown, not click: the input's blur closes the list first.
                      onMouseDown={(e) => { e.preventDefault(); add(o.value); }}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors cursor-pointer',
                        i === active ? 'bg-shell text-ink' : 'text-ink-soft',
                        o.free && 'italic',
                      )}
                    >
                      <MapPin size={15} className="shrink-0 text-muted" />
                      {o.label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {picks.length > 0 && (
          <>
            <ul className="flex flex-wrap gap-2" aria-label={t('Valgte steder')}>
              {picks.map((p) => (
                <li key={p} className="flex items-center gap-1 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 text-[0.88rem] font-medium text-card">
                  {placeLabel(p, lang)}
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    aria-label={t('Fjern {name}', { name: placeLabel(p, lang) })}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-sage-tint transition-colors hover:bg-white/15 hover:text-card cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>

            {/* Only once there is a country: a town with nowhere to be in is
                not an answer Venues can open on. */}
            <div className="relative">
              <MapPin size={18} className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                maxLength={60}
                placeholder={t('By eller område, hvis I har et i tankerne')}
                aria-label={t('By eller område (valgfrit)')}
                className={cn(fieldCls, 'h-[52px] pr-[18px]')}
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {picks.length === 0 && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-line-strong px-4 py-2 text-[0.88rem] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
            >
              {t('Vi er ikke sikre endnu')}
            </button>
          )}
          <span className="text-[13px] text-muted">
            {picks.length > 0 ? t('I kan vælge flere lande, og ændre det senere.') : t('Eller tryk på et land på kloden.')}
          </span>
        </div>
      </div>

      <div className={cn('relative -order-1 min-w-0 overflow-hidden rounded-3xl lg:order-none lg:flex-1', GLOBE_H)}>
        <DestinationGlobe
          selectedCountries={countries}
          // A second tap on a country takes it back off the list.
          onCountryPick={(c) => (picks.includes(c) ? remove(c) : add(c))}
          focus={globeFocus(latest)}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 5, PHOTOS
══════════════════════════════════════════════════════════════════════ */
/* Held in the browser until the wedding exists: the photo API files every
   picture under an event, and the event is only created when they finish.
   The first one becomes the hero, which is what the home screen and the
   website both show. */
const MAX_ONBOARDING_PHOTOS = 6;

function PhotosStep({ form, setField }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Latest list, so a batch that finishes decoding appends to what is there now.
  const photosRef = useRef(form.photos);
  useEffect(() => { photosRef.current = form.photos; }, [form.photos]);

  const room = MAX_ONBOARDING_PHOTOS - form.photos.length;

  const add = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name));
    if (list.length === 0) return;
    setError(null);
    const take = list.slice(0, Math.max(0, MAX_ONBOARDING_PHOTOS - photosRef.current.length));
    if (take.length < list.length) setError(t('Højst {n} billeder her, I kan tilføje flere senere.', { n: MAX_ONBOARDING_PHOTOS }));
    setReading((n) => n + take.length);
    const ready = await Promise.all(take.map((f) => normalizeImage(f).catch(() => null)));
    setReading((n) => n - take.length);
    const drafts = ready.flatMap((file) =>
      file ? [{ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }] : [],
    );
    if (drafts.length < take.length) setError(t('Et billede kunne ikke læses, prøv et andet.'));
    const next = [...photosRef.current, ...drafts].slice(0, MAX_ONBOARDING_PHOTOS);
    photosRef.current = next;
    setField('photos', next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string) => {
    const gone = form.photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setField('photos', form.photos.filter((p) => p.id !== id));
  };

  const makeCover = (id: string) => {
    const p = form.photos.find((x) => x.id === id);
    if (!p) return;
    setField('photos', [p, ...form.photos.filter((x) => x.id !== id)]);
  };

  const [cover, ...rest] = form.photos;

  return (
    <div>
      <StepHead
        eyebrow="Jeres billeder"
        title={<>{t('Et par billeder')} <span className="italic">{t('af jer')}</span></>}
        sub="De pynter jeres forside, og Juno kan bruge dem på hjemmesiden og invitationerne. Det første bliver forsidebillede."
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => void add(e.target.files)}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void add(e.dataTransfer.files); }}
        className={cn('rounded-3xl transition-shadow', dragging && 'shadow-[0px_0px_0px_4px_rgba(122,144,104,0.3)]')}
      >
        {!cover ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-[min(38dvh,300px)] min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-shell/60 text-center transition-colors hover:border-ink cursor-pointer"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
              {reading > 0 ? <Loader2 size={22} className="animate-spin text-ink" /> : <ImagePlus size={22} className="text-ink" />}
            </span>
            <span className="font-serif text-[1.3rem] text-ink">{t('Vælg billeder')}</span>
            <span className="max-w-[300px] text-[13px] text-muted">
              {t('Eller træk dem herind. Op til {n}, JPEG, PNG eller HEIC.', { n: MAX_ONBOARDING_PHOTOS })}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <PhotoTile photo={cover} cover onRemove={() => remove(cover.id)}
              className="col-span-3 row-span-2 h-[200px] sm:col-span-2 sm:h-auto sm:min-h-[260px]" />
            {rest.map((p) => (
              <PhotoTile key={p.id} photo={p} onRemove={() => remove(p.id)} onCover={() => makeCover(p.id)}
                className="aspect-square" />
            ))}
            {reading > 0 && Array.from({ length: Math.min(reading, room) }).map((_, i) => (
              <div key={`r${i}`} className="flex aspect-square items-center justify-center rounded-2xl bg-shell">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            ))}
            {room > reading && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label={t('Tilføj billede')}
                className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-line-strong text-muted transition-colors hover:border-ink hover:text-ink cursor-pointer"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[0.82rem] text-terracotta">{error}</p>}

      <div className="mt-5 flex items-center gap-[9px]">
        <Lock size={15} className="shrink-0 text-muted" />
        <p className="text-[13px] text-muted">
          {t('Billederne er private, indtil I selv lægger dem på hjemmesiden. Valgfrit.')}
        </p>
      </div>
    </div>
  );
}

function PhotoTile({ photo, cover, onRemove, onCover, className }: {
  photo: PhotoDraft; cover?: boolean; onRemove: () => void; onCover?: () => void; className?: string;
}) {
  const { t } = useLang();
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl bg-shell', className)}>
      {/* A local object URL — nothing for next/image to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {cover && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink shadow-sm">
          <Star size={11} className="fill-terracotta text-terracotta" /> {t('Forsidebillede')}
        </span>
      )}
      <div className="absolute right-2 top-2 flex gap-1.5">
        {onCover && (
          <button
            type="button"
            onClick={onCover}
            aria-label={t('Gør til forsidebillede')}
            title={t('Gør til forsidebillede')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-ink-soft opacity-100 shadow-sm transition-opacity hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 cursor-pointer"
          >
            <Star size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('Fjern billede')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-ink-soft opacity-100 shadow-sm transition-opacity hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 3, DATE
══════════════════════════════════════════════════════════════════════ */
/* The calendar is always out. It used to hide behind a "Vi ved den allerede"
   chip, which read as one more season among the chips, and couples with a
   date never found where to put it. Picking a day answers the question; the
   seasons beside it are the way out for everyone else. */
function DateStep({ form, setField }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const { t, lang } = useLang();
  const pickDay = (iso: string) => {
    setField('exactDate', iso);
    setField('dateChoice', 'exact');
  };
  const pickRough = (choice: string) => {
    setField('dateChoice', choice);
    setField('exactDate', '');
  };
  /* Opens on the year of their answer if they are coming back to this step,
     otherwise on the first year with more than a last season left in it. */
  const [roughYear, setRoughYear] = useState(
    () => (DATE_CHIPS.find((c) => c.key === form.dateChoice) ?? DATE_YEARS.find((y) => y.chips.length > 1) ?? DATE_YEARS[0]).year,
  );
  return (
    <div>
      <StepHead eyebrow="Hvornår" title={<>{t('Hvornår siger I')} <span className="italic">{t('ja?')}</span></>}
        sub="Vælg dagen, hvis I har den. Ellers er en sæson eller et år fint." />
      <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-8">
        <div className="w-full sm:max-w-[360px] sm:shrink-0">
          <WeddingDatePicker value={form.exactDate} onChange={pickDay} lang={lang} className="mt-0" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:pt-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">{t('Ingen dato endnu?')}</p>
          {/* A year first, then what part of it. Every season of four years
              at once was a wall of sixteen chips taller than the calendar. */}
          <div className="flex w-fit max-w-full flex-wrap rounded-full border border-line-strong bg-shell p-1" role="group" aria-label={t('Vælg år')}>
            {DATE_YEARS.map(({ year }) => (
              <button
                key={year}
                type="button"
                aria-pressed={year === roughYear}
                onClick={() => setRoughYear(year)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[0.85rem] transition-colors cursor-pointer',
                  year === roughYear ? 'bg-ink font-medium text-card' : 'text-ink-soft hover:text-ink',
                )}
              >
                {year}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(DATE_YEARS.find((y) => y.year === roughYear)?.chips ?? []).map((c) => (
              <Chip key={c.key} selected={form.dateChoice === c.key}
                onClick={() => pickRough(c.key)}>{chipLabel(c, t)}</Chip>
            ))}
            <Chip selected={form.dateChoice === 'undecided'} onClick={() => pickRough('undecided')}>{t('Ved ikke endnu')}</Chip>
          </div>
          <p className="text-[13px] text-muted">{t('I kan altid ændre det senere.')}</p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 4, SCOPE (guest band · budget band)
══════════════════════════════════════════════════════════════════════ */
function ScopeStep({ form, setField }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-US' : 'da-DK';
  const formatKr = (n: number) => new Intl.NumberFormat(locale).format(Math.round(n));

  const setBudgetAmount = (n: number) => {
    const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(n / BUDGET_STEP) * BUDGET_STEP));
    setField('budgetAmount', clamped);
    if (clamped > 0) setField('budgetPrivate', false);
  };

  return (
    <div>
      <StepHead eyebrow="Rammen" title={<>{t('Hvor stort')} <span className="italic">{t('tænker I?')}</span></>}
        sub="Bare et pejlemærke, Juno bruger det til at forme venues, budget og tidslinje." />
      <div className="space-y-7">
        <Field label="Antal gæster">
          <div className="flex flex-wrap gap-2">
            {GUEST_BANDS.map((b) => (
              <Chip key={b.key} selected={form.guestBand === b.key} onClick={() => setField('guestBand', b.key)}>
                {t(GUEST_LABELS_DA[b.key] ?? b.label)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Budget" hint="Valgfrit, hjælper Juno med at fordele pengene fornuftigt.">
          <div className={cn('space-y-5 transition-opacity', form.budgetPrivate && 'opacity-45')}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="min-w-[140px] font-serif text-[clamp(1.75rem,4vw,2.25rem)] tabular-nums text-ink">
                {formatKr(form.budgetAmount)} <span className="text-[0.85rem] text-muted">kr</span>
              </span>
              <input
                type="range"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={BUDGET_STEP}
                value={form.budgetAmount}
                disabled={form.budgetPrivate}
                onChange={(e) => setBudgetAmount(Number(e.target.value))}
                className="kalas-range flex-1"
                aria-label={t('Samlet budget')}
              />
            </div>
            <div className="flex max-w-sm items-center gap-2 rounded-xl border border-line-strong bg-shell px-4 py-2.5">
              <input
                type="number"
                value={form.budgetAmount}
                step={BUDGET_STEP}
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                disabled={form.budgetPrivate}
                onChange={(e) => setBudgetAmount(Number(e.target.value))}
                className="w-0 min-w-0 flex-1 bg-transparent font-serif text-[1.3rem] text-ink tabular-nums focus:outline-none disabled:cursor-not-allowed"
              />
              <span className="shrink-0 text-[0.8rem] text-muted">kr</span>
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[0.85rem] text-ink-soft">
            <input
              type="checkbox"
              checked={form.budgetPrivate}
              onChange={(e) => setField('budgetPrivate', e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-ink focus:ring-sage-strong"
            />
            {t('Vil helst ikke sige')}
          </label>
        </Field>
      </div>
      <style>{`
        .kalas-range { -webkit-appearance: none; appearance: none; height: 2px; background: var(--color-line-strong); border-radius: 999px; cursor: pointer; }
        .kalas-range:disabled { cursor: not-allowed; opacity: 0.4; }
        .kalas-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 999px; background: var(--color-sage); border: 2px solid var(--color-canvas); box-shadow: 0 1px 4px rgba(46,51,37,0.2); cursor: pointer; }
        .kalas-range:disabled::-webkit-slider-thumb { cursor: not-allowed; }
        .kalas-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 999px; background: var(--color-sage); border: 2px solid var(--color-canvas); cursor: pointer; }
        .kalas-range:disabled::-moz-range-thumb { cursor: not-allowed; }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 5, PARTNER
══════════════════════════════════════════════════════════════════════ */
function PartnerStep({ form, set }: { form: FormState; set: SetText }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const nameB = form.nameB || t('din partner');
  const valid = isPlausibleEmail(form.partnerEmail);

  /* Juno really sends this one — from her own mailbox, before the event row
     exists, so the invite is minted against the user and adopted later. */
  async function send() {
    if (!valid || state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/partner/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.partnerEmail.trim(),
          inviter_name: form.nameA.trim(),
          partner_name: form.nameB.trim(),
          language: lang,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState('idle');
        setError(
          data.error === 'invalid_email' ? t('Tjek e-mailadressen.')
          : data.error === 'own_address' ? t('Det er din egen adresse.')
          : t('Invitationen kunne ikke sendes. Prøv igen.'),
        );
        return;
      }
      setState('sent');
    } catch {
      setState('idle');
      setError(t('Invitationen kunne ikke sendes. Prøv igen.'));
    }
  }

  const sent = state === 'sent';

  return (
    <div>
      <StepHead eyebrow="Sammen om det" title={t('Giv {name} besked', { name: nameB })}
        sub="Juno sender invitationen, så din partner kan oprette sin egen konto. Fælles adgang til planen er på vej. Valgfrit." />
      <Field label={t('{name}s e-mail', { name: nameB })}>
        <div className="flex gap-2">
          <input type="email" value={form.partnerEmail} onChange={set('partnerEmail')}
            placeholder="partner@email.dk" className={cn(inputCls, 'flex-1')} disabled={sent || state === 'sending'} />
          <button onClick={send} disabled={sent || state === 'sending' || !valid}
            className={cn('rounded-2xl px-5 py-3.5 text-[0.88rem] font-medium shrink-0 transition-colors cursor-pointer',
              sent ? 'bg-sage-tint text-ink cursor-default'
                   : state === 'sending' ? 'bg-shell text-muted cursor-wait'
                   : valid ? 'bg-ink text-canvas hover:bg-ink/90'
                   : 'bg-shell text-muted cursor-not-allowed')}>
            {sent ? <><Check size={14} className="inline mr-1" />{t('Sendt')}</>
                  : state === 'sending' ? t('Sender…') : t('Send')}
          </button>
        </div>
      </Field>
      {error && (
        <p className="mt-3 text-[0.82rem] text-terracotta">{error}</p>
      )}
      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-sage-tint p-4">
            <p className="text-[0.88rem] text-ink leading-relaxed">
              {t('Juno har sendt invitationen til {email}. {name} kan oprette sin egen konto, fælles adgang til planen er på vej.', { email: form.partnerEmail, name: nameB })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
