import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  Check, ArrowLeft, ArrowRight, MapPin, Heart, Lock, Star, X, Search, Expand,
} from 'lucide-react';
import { GUEST_BANDS, type OnboardingDate } from '@/lib/onboarding';
import { isPlausibleEmail } from '@/lib/invites/email';
import { Wordmark, type ScreenId } from '../Shell';
import { cn } from '../ui';
import WeddingRings from '../icons/WeddingRings';
import { useLang } from '../i18n';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import { Lightbox } from '../onboarding/Lightbox';

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

/* Structured onboarding state — chips + bands instead of loose text, so the
   journey logic and Ava's briefs get clean, bounded inputs. */
export type FormState = {
  nameA: string; nameB: string;
  location: string;
  lovedDestinations: string[]; // "City, Country" hearts from the globe step
  dateChoice: string;   // '' | season key | 'exact' | 'undecided'
  exactDate: string;    // ISO, when dateChoice === 'exact'
  guestBand: string;    // '' | GUEST_BANDS key
  budgetAmount: number;
  budgetPrivate: boolean;
  partnerEmail: string;
};

export const EMPTY_FORM: FormState = {
  nameA: '', nameB: '',
  location: '', lovedDestinations: [],
  dateChoice: '', exactDate: '',
  guestBand: '', budgetAmount: 200_000, budgetPrivate: false,
  partnerEmail: '',
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

type DateChip = { key: string; season: string; year: number };
type TFn = (s: string, params?: Record<string, string | number>) => string;
/** The next `count` season-year chips starting from the upcoming season. */
function seasonChipsDa(count = 6, from = new Date()): DateChip[] {
  const chips: DateChip[] = [];
  let year = from.getFullYear();
  let idx = SEASON_START_MONTH.findIndex((m) => m > from.getMonth());
  if (idx === -1) { idx = 0; year += 1; }
  while (chips.length < count) {
    chips.push({ key: `${SEASONS_DA[idx].toLowerCase()}_${year}`, season: SEASONS_DA[idx], year });
    idx += 1;
    if (idx === SEASONS_DA.length) { idx = 0; year += 1; }
  }
  return chips;
}
const DATE_CHIPS = seasonChipsDa(6);
const chipLabel = (c: DateChip, t: TFn) => `${t(c.season)} ${c.year}`;

/* ── Payload builders (all band/date logic lives here) ─────────────────── */
function buildDate(form: FormState): OnboardingDate {
  if (form.dateChoice === 'exact' && form.exactDate) return { precision: 'exact', iso: form.exactDate };
  const chip = DATE_CHIPS.find((c) => c.key === form.dateChoice);
  if (chip) return { precision: 'season', hint: `${chip.season} ${chip.year}` };
  return { precision: 'undecided' };
}
function buildBudget(form: FormState): string | null {
  if (form.budgetPrivate) return null;
  return String(form.budgetAmount);
}
export function toOnboardingPayload(form: FormState) {
  return {
    name: form.nameA.trim(),
    partner_name: form.nameB.trim() || null,
    city: form.location.trim(),
    date: buildDate(form),
    loved_destinations: form.lovedDestinations,
    guest_band: form.guestBand || null,
    budget: buildBudget(form),
    partner_email: form.partnerEmail.trim() || null,
  };
}

/* ── Display helpers ─────────────────────────────────────────────────── */

const inputCls = 'w-full rounded-2xl border border-[var(--color-line-strong)] bg-canvas px-4 py-3.5 text-[1rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none transition-colors';

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT, centered, traditional step flow (no chat pane)
══════════════════════════════════════════════════════════════════════ */
const TOTAL_STEPS = 5;

const STEP_LABELS = ['Jeres historie', 'Destination', 'Datoen', 'Omfang', 'Partner'] as const;

const wonderInputCls =
  'h-[62px] w-full rounded-[14px] border bg-card px-[18px] text-base text-ink placeholder:text-muted transition-shadow focus:outline-none';

export default function Onboarding({ onEnter, initialStep = 0 }: {
  onEnter: (form: FormState, s?: ScreenId) => void;
  /* A seam for /dev/onboarding: every step has to fit the viewport, and the
     only way to check the later ones is to open on them — reaching step 3 for
     real needs a country picked off the auth-gated globe. Unused in the app. */
  initialStep?: number;
}) {
  const { t, lang, setLang } = useLang();
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const go = (next: number) => {
    if (next >= TOTAL_STEPS) {
      onEnter(form, 'home');
      return;
    }
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, next));
  };

  const canAdvance =
    (step === 0 && Boolean(form.nameA.trim() && form.nameB.trim())) ||
    (step === 1 && Boolean(form.location.trim())) ||
    (step === 2 && (form.dateChoice === 'exact' ? Boolean(form.exactDate) : Boolean(form.dateChoice))) ||
    (step === 3 && Boolean(form.guestBand)) ||
    step === 4;

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
        step === 1 ? 'py-3 lg:py-4' : 'gap-8 py-6 lg:flex-row lg:gap-[52px] lg:py-8',
      )}>
        {step !== 1 && <ContextPanel step={step} t={t} />}
        <div className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto py-2',
          step === 1 ? 'justify-start' : 'justify-center',
        )}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={cn('mx-auto w-full', step === 1 ? 'max-w-none' : 'max-w-[680px]')}
            >
              {step === 0 && <NamesStep form={form} set={set} onNext={() => canAdvance && go(1)} />}
              {step === 1 && <DestinationStep form={form} setField={setField} />}
              {step === 2 && <DateStep form={form} setField={setField} />}
              {step === 3 && <ScopeStep form={form} setField={setField} />}
              {step === 4 && <PartnerStep form={form} set={set} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <OnboardingFooter
        onBack={step > 0 ? () => go(step - 1) : undefined}
        onNext={() => canAdvance && go(step + 1)}
        nextLabel={step === TOTAL_STEPS - 1 ? t('Gå ind i Kalas') : t('Fortsæt')}
        nextDisabled={!canAdvance}
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
            className="h-full rounded-full bg-terracotta"
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

const CONTEXT_PANEL_COPY: Record<number, { eyebrow: string; title: string; sub: string }> = {
  0: {
    eyebrow: 'En omtænksom start',
    title: 'Lad os gøre det til jeres.',
    sub: 'Fem korte trin hjælper Ava med at skræddersy venues, opgaver og anbefalinger til jeres bryllup.',
  },
  2: {
    eyebrow: 'Datoen',
    title: 'Hvornår siger I ja?',
    sub: 'En sæson, en dato eller “vi ved det ikke endnu”, Ava tilpasser sig.',
  },
  3: {
    eyebrow: 'Omfang',
    title: 'Hvor mange gæster?',
    sub: 'Et pejlemærke er nok, Ava bruger det til venues, budget og tidslinje.',
  },
  4: {
    eyebrow: 'Sammen om det',
    title: 'Giv partneren adgang',
    sub: 'I deler samme plan, ingen duplikerede lister eller beskedkopiering. Valgfrit.',
  },
};

/** Wonder onboarding context panel — hidden on globe step (1). */
function ContextPanel({ step, t }: { step: number; t: (s: string) => string }) {
  const panel = CONTEXT_PANEL_COPY[step] ?? CONTEXT_PANEL_COPY[0];
  const benefits = [t('Anbefalinger formet omkring jer'), t('Ændr ethvert svar senere')];

  return (
    <aside className="hidden w-full max-w-[430px] shrink-0 flex-col justify-between rounded-3xl bg-ink p-[38px] shadow-[0px_18px_50px_rgba(36,65,58,0.16)] lg:flex lg:h-full lg:overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-terracotta">
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
            className="flex h-[50px] items-center gap-2 rounded-xl px-[18px] text-sm font-semibold text-muted transition-colors hover:text-ink cursor-pointer"
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
              'flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-[14px] px-6 text-[15px] font-bold transition-opacity cursor-pointer sm:flex-initial sm:min-w-[200px]',
              nextDisabled
                ? 'cursor-not-allowed bg-line text-faint'
                : 'bg-terracotta text-card shadow-[0px_8px_22px_rgba(179,78,55,0.24)] hover:opacity-95',
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
          : 'border-[var(--color-line-strong)] text-ink-soft hover:bg-shell')}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 1, NAMES
══════════════════════════════════════════════════════════════════════ */
function NamesStep({ form, set, onNext }: { form: FormState; set: any; onNext: () => void }) {
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
          {t('Fortæl os hvad vi skal kalde jer begge. Ava bruger fornavne, så planlægningen føles personlig fra første skridt.')}
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
   STEP 2, DESTINATION (interactive globe + country panel)
══════════════════════════════════════════════════════════════════════ */
/* Sized against what is left after the header and the footer, not against the
   whole viewport: at 72vh the globe alone pushed the "Fortsæt" button off a
   laptop screen. */
const GLOBE_H = 'h-[min(calc(100dvh-260px),560px)] min-h-[300px]';
/** Matches OnboardingHeader h-[92px]; mobile adds lang row below header. */
const DRAWER_TOP = 'top-[92px] max-sm:top-[136px]';
const DRAWER_BOTTOM = 'bottom-[96px]';

function DestinationStep({ form, setField }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const { t, lang } = useLang();
  const [custom, setCustom] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [cards, setCards] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Countries already fetched this session — reopening one is instant.
  const seen = useRef<Record<string, DestinationSuggestion[]>>({});

  const load = async (c: string) => {
    setFailed(false);
    const hit = seen.current[c];
    if (hit) { setCards(hit); return; }
    setLoading(true);
    setCards([]);
    try {
      const res = await fetch(
        `/api/onboarding/destinations?country=${encodeURIComponent(c)}&lang=${lang}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { suggestions?: DestinationSuggestion[] };
      const list = data.suggestions ?? [];
      if (list.length === 0) { setFailed(true); return; }
      seen.current[c] = list;
      setCards(list);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const pickCountry = (c: string) => {
    setCustom(false);
    setCountry(c);
    setField('location', c);
    void load(c);
  };

  const valueOf = (s: DestinationSuggestion) => `${s.name}, ${country}`;
  const loved = (s: DestinationSuggestion) => form.lovedDestinations.includes(valueOf(s));
  const toggleLove = (s: DestinationSuggestion) => {
    const v = valueOf(s);
    setField(
      'lovedDestinations',
      form.lovedDestinations.includes(v)
        ? form.lovedDestinations.filter((x) => x !== v)
        : [...form.lovedDestinations, v]
    );
  };

  return (
    <>
      <div>
        <div className={cn('relative w-full overflow-hidden rounded-3xl', GLOBE_H)}>
          <DestinationGlobe selectedCountry={country} onCountryPick={pickCountry} />

          <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-canvas/96 via-canvas/78 to-transparent px-5 pb-16 pt-4 sm:px-7 sm:pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="pointer-events-none min-w-0 flex-1">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
                  {t('Destination')}
                </p>
                <h2 className="mt-2 font-serif text-[clamp(1.75rem,4.5vw,2.5rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                  {t('Hvor i')} <span className="italic">{t('verden?')}</span>
                </h2>
                <p className="mt-2 max-w-lg text-[0.9rem] leading-relaxed text-muted sm:text-[0.95rem]">
                  {t('Drej og zoom på kloden, og tryk på et land, så henter vi de største byer og smukkeste bryllupsdestinationer.')}
                </p>
              </div>
              <div className="pointer-events-auto shrink-0 pt-1">
                {custom ? (
                  <button
                    type="button"
                    onClick={() => setCustom(false)}
                    className="text-[0.78rem] font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline cursor-pointer"
                  >
                    {t('Tilbage til kloden')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustom(true)}
                    className="rounded-full border border-line-strong bg-card/90 px-4 py-2 text-[0.78rem] font-semibold text-ink-soft shadow-sm transition-colors hover:border-ink hover:text-ink cursor-pointer"
                  >
                    {t('Skriv selv')}
                  </button>
                )}
              </div>
            </div>
            <AnimatePresence>
              {custom && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="pointer-events-auto mt-4 max-w-md sm:ml-auto"
                >
                  <input
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder={t('f.eks. Odense · Sydfyn · jeres sommerhusby')}
                    className={cn(wonderInputCls, 'border border-line-strong shadow-[0px_0px_0px_4px_rgba(122,144,104,0.12)] focus:border-2 focus:border-ink')}
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {(form.location && !custom) || form.lovedDestinations.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {form.location && !custom && (
              <motion.div key={form.location} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full bg-sage-tint px-4 py-2">
                <MapPin size={14} className="text-ink" />
                <span className="text-[0.9rem] font-medium text-ink">{form.location}</span>
              </motion.div>
            )}
            {form.lovedDestinations.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[0.78rem] text-ink-soft">
                <Heart size={12} className="fill-clay text-clay" />
                {t('{n} gemt til senere', { n: form.lovedDestinations.length })}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Page-level right drawer, below header, above footer, no backdrop */}
      <AnimatePresence>
        {country && (
          <motion.aside
            key={country}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'fixed right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-[var(--color-line-strong)] bg-card shadow-[-16px_0_48px_rgba(36,65,58,0.2)]',
              DRAWER_TOP,
              DRAWER_BOTTOM,
            )}
          >
            <CountryPanel
              country={country}
              cards={cards}
              loading={loading}
              failed={failed}
              onRetry={() => void load(country)}
              onClose={() => setCountry(null)}
              selectedValue={form.location}
              valueOf={valueOf}
              onChoose={(s) => { setCustom(false); setField('location', valueOf(s)); }}
              loved={loved}
              onToggleLove={toggleLove}
              drawer
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function CountryPanel({
  country, cards, loading, failed, onRetry, onClose, selectedValue, valueOf, onChoose, loved, onToggleLove, drawer,
}: {
  country: string;
  cards: DestinationSuggestion[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onClose: () => void;
  selectedValue: string;
  valueOf: (s: DestinationSuggestion) => string;
  onChoose: (s: DestinationSuggestion) => void;
  loved: (s: DestinationSuggestion) => boolean;
  onToggleLove: (s: DestinationSuggestion) => void;
  drawer?: boolean;
}) {
  const { t } = useLang();
  const cities = cards.filter((s) => s.kind === 'city');
  const weddings = cards.filter((s) => s.kind === 'wedding');
  const [tab, setTab] = useState<'city' | 'wedding'>('city');
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (cities.length > 0) setTab('city');
    else if (weddings.length > 0) setTab('wedding');
  }, [country, cities.length, weddings.length]);

  // Close the viewer when the tab or country changes so the index stays valid.
  useEffect(() => { setLightbox(null); }, [tab, country]);

  const activeCards = tab === 'city' ? cities : weddings;
  const galleryPhotos = activeCards.map((s) => s.photo).filter((p): p is string => Boolean(p));
  const tabs = [
    { id: 'city' as const, label: t('Største byer'), count: cities.length },
    { id: 'wedding' as const, label: t('Bryllupsdestinationer'), count: weddings.length },
  ];

  return (
    <div className={cn(
      'flex min-h-0 flex-1 flex-col bg-card',
      drawer ? 'h-full' : 'max-h-[640px] rounded-3xl border border-[var(--color-line-strong)] lg:h-[min(72vh,640px)] lg:max-h-none',
    )}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">{t('Destination')}</p>
          <h3 className="truncate font-serif text-[1.3rem] leading-tight text-ink">{country}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label={t('Luk')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {!loading && !failed && (cities.length > 0 || weddings.length > 0) && (
        <div className="flex shrink-0 gap-0.5 border-b border-[var(--color-line)] px-3">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              disabled={count === 0}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 border-b-2 px-2 py-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer',
                tab === id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                count === 0 && 'cursor-not-allowed opacity-40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[var(--color-line)]">
                <div className="h-32 bg-shell" />
                <div className="space-y-2 p-3">
                  <div className="h-3.5 w-1/2 rounded bg-shell" />
                  <div className="h-3 w-5/6 rounded bg-shell" />
                </div>
              </div>
            ))}
            <p className="text-center text-[0.78rem] italic text-muted">{t('Finder de smukkeste steder…')}</p>
          </div>
        )}

        {failed && !loading && (
          <div className="rounded-2xl bg-shell p-4 text-center">
            <p className="text-[0.85rem] text-ink-soft">{t('Vi kunne ikke hente forslag lige nu.')}</p>
            <button type="button" onClick={onRetry}
              className="mt-3 rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-canvas transition-opacity hover:opacity-90 cursor-pointer">
              {t('Prøv igen')}
            </button>
          </div>
        )}

        {!loading && !failed && activeCards.length > 0 && (
          <div className="space-y-3">
            {activeCards.map((s) => (
              <DestinationCard key={valueOf(s)} s={s} country={country} selected={selectedValue === valueOf(s)}
                loved={loved(s)} onChoose={() => onChoose(s)} onToggleLove={() => onToggleLove(s)}
                onExpand={s.photo ? () => setLightbox(galleryPhotos.indexOf(s.photo!)) : undefined} />
            ))}
          </div>
        )}

        {!loading && !failed && activeCards.length === 0 && cities.length === 0 && weddings.length === 0 && (
          <p className="px-1 text-center text-[0.85rem] text-ink-soft">{t('Ingen forslag for dette land endnu.')}</p>
        )}
      </div>

      <p className="shrink-0 border-t border-[var(--color-line)] px-5 py-3 text-[0.72rem] leading-snug text-muted">
        {t('Hjerter gemmes, så Ava kan finde leverandører dér senere.')}
      </p>

      {lightbox !== null && galleryPhotos.length > 0 && (
        <Lightbox
          photos={galleryPhotos}
          index={Math.min(Math.max(lightbox, 0), galleryPhotos.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          alt={country}
        />
      )}
    </div>
  );
}

function googleSearchUrl(s: DestinationSuggestion, country: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${s.name}, ${country}`)}`;
}

function DestinationCard({ s, country, selected, loved, onChoose, onToggleLove, onExpand }: {
  s: DestinationSuggestion; country: string; selected: boolean; loved: boolean;
  onChoose: () => void; onToggleLove: () => void; onExpand?: () => void;
}) {
  const { t } = useLang();
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl border transition-colors',
      selected ? 'border-ink shadow-[0px_6px_18px_rgba(36,65,58,0.12)]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]',
    )}>
      <button type="button" onClick={onChoose} className="block w-full text-left cursor-pointer">
        {s.photo ? (
          <div className="relative h-32 w-full overflow-hidden">
            {/* Places photo URLs are remote googleusercontent links; next/image
                would need a domain allowlist, so a plain img is the right tool. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photo}
              alt={s.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-sage-tint">
            <MapPin size={20} className="text-ink opacity-40" />
          </div>
        )}
        <div className="p-3 pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-serif text-[1rem] text-ink">{s.name}</p>
            {s.rating != null && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] text-ink-soft">
                <Star size={11} className="fill-[#d9a441] text-[#d9a441]" />{s.rating.toFixed(1)}
              </span>
            )}
          </div>
          {s.region && <p className="text-[0.72rem] text-muted">{s.region}</p>}
          {s.blurb && <p className="mt-1.5 text-[0.78rem] leading-snug text-ink-soft">{s.blurb}</p>}
          {selected && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink">
              <Check size={12} /> {t('Valgt som jeres sted')}
            </p>
          )}
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {onExpand && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            aria-label={t('Forstør billede')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-ink-soft shadow-sm transition-colors hover:text-ink cursor-pointer"
          >
            <Expand size={15} />
          </button>
        )}
        {s.kind === 'city' && (
          <a
            href={googleSearchUrl(s, country)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('Søg på Google')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-ink-soft shadow-sm transition-colors hover:text-ink"
          >
            <Search size={15} />
          </a>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLove(); }}
          aria-label={loved ? t('Fjern fra gemte') : t('Gem til senere')}
          aria-pressed={loved}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all cursor-pointer',
            loved ? 'bg-clay text-white scale-105' : 'bg-card/90 text-ink-soft hover:text-clay',
          )}
        >
          <Heart size={15} className={loved ? 'fill-current' : undefined} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 3, DATE
══════════════════════════════════════════════════════════════════════ */
function DateStep({ form, setField }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const { t, lang } = useLang();
  return (
    <div>
      <StepHead eyebrow="Hvornår" title={<>{t('Hvornår siger I')} <span className="italic">{t('ja?')}</span></>}
        sub="En sæson er fint, I behøver ikke en præcis dato endnu." />
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={form.dateChoice === 'exact'}
          onClick={() => setField('dateChoice', 'exact')}
        >
          {t('Vi ved den allerede')}
        </Chip>
        {DATE_CHIPS.map((c) => (
          <Chip key={c.key} selected={form.dateChoice === c.key}
            onClick={() => setField('dateChoice', c.key)}>{chipLabel(c, t)}</Chip>
        ))}
        <Chip selected={form.dateChoice === 'undecided'} onClick={() => setField('dateChoice', 'undecided')}>{t('Ved ikke endnu')}</Chip>
      </div>
      <AnimatePresence>
        {form.dateChoice === 'exact' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">{t('Vælg jeres dato')}</p>
            <WeddingDatePicker
              value={form.exactDate}
              onChange={(iso) => setField('exactDate', iso)}
              lang={lang}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
        sub="Bare et pejlemærke, Ava bruger det til at forme venues, budget og tidslinje." />
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
        <Field label="Budget" hint="Valgfrit, hjælper Ava med at fordele pengene fornuftigt.">
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
            <div className="flex max-w-sm items-center gap-2 rounded-xl border border-[var(--color-line-strong)] bg-shell px-4 py-2.5">
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
              className="h-4 w-4 rounded border-[var(--color-line-strong)] text-ink focus:ring-sage-strong"
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
function PartnerStep({ form, set }: { form: FormState; set: any }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const nameB = form.nameB || t('din partner');
  const valid = isPlausibleEmail(form.partnerEmail);

  /* Ava really sends this one — from her own mailbox, before the event row
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
        sub="Ava sender invitationen, så din partner kan oprette sin egen konto. Fælles adgang til planen er på vej. Valgfrit." />
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
              {t('Ava har sendt invitationen til {email}. {name} kan oprette sin egen konto, fælles adgang til planen er på vej.', { email: form.partnerEmail, name: nameB })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
