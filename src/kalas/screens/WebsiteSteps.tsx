"use client";

/* The Design tab's panel, one step at a time: pick a vibe, add photos, then
   tell Ava in a few words how the site should be, with ideas above the box so
   nobody starts from a blank field. Nothing is built until the button at the
   end of step 3. After that the panel is the finished site, where Ava takes
   change requests, and the row at the top reopens any step.

   The open step and the text belong to the parent: this panel unmounts on
   every tab switch, and a trip to Indhold should cost the couple neither.
   Ava builds from what is written under Indhold, so the last step says how
   far that has come, and the finished site says when its words are old. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, Image as ImageIcon, Loader2, Palette, RotateCcw, Star, Trash2, Upload,
} from 'lucide-react';
import { Eyebrow, SelectPill, cn } from '../ui';
import { useLang } from '../i18n';
import type { SiteDesign } from '../site/design';
import { googleFontsHref, fontStack } from '../site/fonts';
import { SITE_PRESETS } from '../site/presets';
import { BRIEF_IDEAS, hasIdea, toggleIdea } from '../site/brief';
import type { StepSummary } from '../site/outline';
import { StaleContentNotice } from './website/ContentOutline';
import { websitePriceDkk } from '@/lib/website/pricing';
import type { SitePhotoRow, WebsiteDesignRow } from '@/lib/db/types';

export type DesignStep = 'vibe' | 'photos' | 'brief';

/** Changes couples often want, as a place to start. Danish source text. */
const REFINE_IDEAS = [
  'Mørkere og mere stemningsfuld',
  'Større billeder',
  'Mere luft mellem afsnittene',
  'Mere romantisk',
  'Enklere og mere rolig',
  'Andre skrifttyper',
] as const;

const STEPS: { id: DesignStep; label: string }[] = [
  { id: 'vibe', label: 'Stemning' },
  { id: 'photos', label: 'Billeder' },
  { id: 'brief', label: 'Jeres ord' },
];

/** The upload route's limit. */
const MAX_PHOTOS = 24;

const primaryBtn =
  'flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-meta font-semibold text-canvas transition-colors hover:bg-ink/80 disabled:cursor-default disabled:opacity-40 cursor-pointer';

export interface WebsiteStepsProps {
  /** The step the couple opened; null lets the panel pick from the data. */
  step: DesignStep | null;
  onStep: (step: DesignStep | null) => void;
  /** Their words to Ava, sent with the build. */
  brief: string;
  onBrief: (brief: string) => void;
  hasDesign: boolean;
  hasHtml: boolean;
  design: SiteDesign;
  designs: WebsiteDesignRow[];
  /** The version the couple is looking at, when it is not the live one:
      a change they ask for applies to that one. */
  refineTarget?: number | null;
  activePresetId: string | null;
  /** The couple's own photos, without the generated section illustrations. */
  photos: SitePhotoRow[];
  photoUrls: Record<string, string>;
  working: null | 'generate' | 'refine' | 'sync';
  applyingPreset: string | null;
  restarting: boolean;
  genError: string | null;
  needsPayment: boolean;
  websitePaid: boolean;
  onApplyPreset: (presetId: string) => void;
  /** Resolves true once the site is built, false when it was not. */
  onBuild: (brief: string) => Promise<boolean>;
  onRefine: (instruction: string) => void;
  onRestart: () => void;
  onCheckout: () => void;
  onUpload: (files: FileList | File[]) => Promise<void> | void;
  onDeletePhoto: (id: string) => void;
  onSetHero: (id: string) => void;
  /** The sections on the site, and how many still miss something. */
  content: StepSummary;
  onOpenContent: () => void;
  /** The built site's texts are older than the content. */
  contentStale: boolean;
  onSyncContent: () => void;
}

export default function WebsiteSteps({
  step, onStep, brief, onBrief, hasDesign, hasHtml, design, designs, refineTarget, activePresetId,
  photos, photoUrls, working, applyingPreset, restarting, genError, needsPayment, websitePaid,
  onApplyPreset, onBuild, onRefine, onRestart, onCheckout, onUpload, onDeletePhoto, onSetHero,
  content, onOpenContent, contentStale, onSyncContent,
}: WebsiteStepsProps) {
  const { t, tn } = useLang();
  const [instruction, setInstruction] = useState('');

  // No step opened yet: a built site shows as finished, otherwise resume
  // where the data puts them (a design means a vibe was already picked).
  const current: DesignStep | null = step ?? (hasHtml ? null : hasDesign ? 'photos' : 'vibe');
  const reached = current ? STEPS.findIndex((s) => s.id === current) : STEPS.length;
  const hasBuilt = designs.some((d) => Boolean(d.html));

  // The button that moves them sits at the bottom of the step they leave, so
  // bring the row of steps back into view if it has scrolled away. 'nearest'
  // leaves the page alone while the row is on screen, and scroll-mt keeps it
  // clear of the sticky tabs when it does have to move.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const shownStep = useRef(current);
  useEffect(() => {
    if (shownStep.current === current) return;
    shownStep.current = current;
    rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  const submitRefine = () => {
    const text = instruction.trim();
    if (!text || working) return;
    setInstruction('');
    onRefine(text);
  };

  // A build that lands hands over to the finished site. One that fails stays
  // on step 3, with their words still in the box, under the error.
  const build = async () => {
    if (await onBuild(brief)) onStep(null);
  };

  /* Working / restart takes over the panel. */
  if (restarting) {
    return (
      <div className="rule rounded-2xl bg-card p-8 text-center">
        <Loader2 size={26} className="mx-auto animate-spin text-ink" />
        <p className="mt-4 font-serif text-[1.25rem] text-ink">{t('Starter forfra…')}</p>
      </div>
    );
  }
  if (working) return <BuildProgress mode={working} />;

  return (
    <div className="space-y-7">
      {genError && (
        <p className="rule rounded-xl bg-terracotta-tint px-4 py-3 text-[0.82rem] text-[var(--color-terracotta)]">{t(genError)}</p>
      )}

      {/* Paywall notice, templates stay usable; Ava's edits unlock on purchase. */}
      {needsPayment && !websitePaid && (
        <div className="rule rounded-2xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink">
            <Palette size={18} className="text-canvas" />
          </div>
          <p className="font-serif text-[1.25rem] text-ink leading-tight">{t('Lås Ava-designeren op')}</p>
          <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
            {t('Skabelonerne er jeres, men Avas personalisering og ændringer via chat er en betalt funktion. Inkl. fjernelse af Kalas-branding.')}
          </p>
          <button type="button" onClick={onCheckout}
            className="mt-5 rounded-full bg-ink px-6 py-2.5 text-meta font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
            {t('Lås op · {price} kr', { price: websitePriceDkk() })}
          </button>
        </div>
      )}

      <div ref={rowRef} className="scroll-mt-20">
        <StepRow current={current} reached={reached} open={hasDesign} onStep={onStep} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current ?? 'site'}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {current === 'vibe' && (
            <>
              <StepHead title={t('Vælg en stemning')}
                intro={t('Siden skifter med det samme i forhåndsvisningen, så prøv jer frem.')} />
              {hasBuilt && (
                <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                  {t('Jeres nuværende side ligger under Versioner, hvis I skifter.')}
                </p>
              )}
              <div className="mt-5">
                {/* Picking pins the panel to this step. Left to the data, the
                    first vibe would move it straight on to photos, before they
                    have had a chance to try a second one. */}
                <TemplateGallery activePresetId={activePresetId} applyingPreset={applyingPreset}
                  onPick={(id) => { onStep('vibe'); onApplyPreset(id); }} />
              </div>
              <StepNav>
                <button type="button" onClick={() => onStep('photos')} disabled={!hasDesign} className={primaryBtn}>
                  {t('Næste')} <ArrowRight size={12} />
                </button>
              </StepNav>
            </>
          )}

          {current === 'photos' && (
            <>
              <StepHead title={t('Upload jeres billeder')}
                intro={t('Træk billeder herind eller tryk upload: forlovelsesbilleder, stedet, jer to. Ava designer ud fra dem. Markér ét som forsidebillede.')} />
              <div className="mt-5">
                <PhotoManager photos={photos} photoUrls={photoUrls}
                  onUpload={onUpload} onDelete={onDeletePhoto} onSetHero={onSetHero} />
              </div>
              <StepNav onBack={() => onStep('vibe')}>
                {/* Photos are optional, and the button says so. */}
                <button type="button" onClick={() => onStep('brief')} className={primaryBtn}>
                  {photos.length > 0 ? t('Næste') : t('Spring over')} <ArrowRight size={12} />
                </button>
              </StepNav>
            </>
          )}

          {current === 'brief' && (
            <>
              <StepHead title={t('Fortæl Ava med få ord, hvordan den skal være')}
                intro={t('Tryk på en idé for at tilføje den, eller skriv selv.')} />
              <div className="mt-5 flex flex-wrap gap-1.5">
                {BRIEF_IDEAS.map((idea) => {
                  const words = t(idea);
                  return (
                    <SelectPill key={idea} active={hasIdea(brief, words)} onClick={() => onBrief(toggleIdea(brief, words))}>
                      {words}
                    </SelectPill>
                  );
                })}
              </div>
              <textarea
                value={brief}
                onChange={(e) => onBrief(e.target.value)}
                rows={4}
                aria-label={t('Fortæl Ava med få ord, hvordan den skal være')}
                placeholder={t('f.eks. Vi drømmer om noget let og botanisk med varme toner, ikke for stift…')}
                className="mt-3 w-full resize-none rule rounded-xl bg-shell px-4 py-3 text-[0.85rem] leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20"
              />
              {/* What Ava will build from, and a way back to it. */}
              <div className="mt-4 flex items-center justify-between gap-3 rule rounded-xl bg-shell px-4 py-3">
                <p className="min-w-0 text-[0.78rem] leading-relaxed text-muted">
                  {content.todo === 0
                    ? t('Ava bygger med jeres {n} sektioner.', { n: content.on })
                    : tn(content.todo,
                        'Ava bygger med jeres {on} sektioner. Én mangler stadig noget.',
                        'Ava bygger med jeres {on} sektioner. {n} mangler stadig noget.',
                        { on: content.on, n: content.todo })}
                </p>
                <button type="button" onClick={onOpenContent}
                  className="shrink-0 text-[0.72rem] font-medium text-ink underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer">
                  {t('Se indholdet')}
                </button>
              </div>
              <StepNav onBack={() => onStep('photos')}>
                <button type="button" onClick={() => void build()} className={primaryBtn}>
                  <Palette size={12} /> {hasHtml ? t('Byg siden igen') : t('Byg jeres side med Ava')}
                </button>
              </StepNav>
              {!hasHtml && (
                <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">
                  {t('Ava genererer billeder til sektionerne, henter jeres venue-fotos og bygger hele siden ud fra skabelonen.')}
                </p>
              )}
            </>
          )}

          {current === null && contentStale && (
            <div className="mb-4">
              <StaleContentNotice syncing={false} onSync={onSyncContent} />
            </div>
          )}

          {current === null && (
            <section className="rule rounded-2xl bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow className="mb-2">{t('Jeres design')}</Eyebrow>
                  <p className="font-serif text-[1.5rem] leading-tight text-ink">{design.concept.name}</p>
                </div>
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-tint">
                  <Palette size={15} className="text-ink" />
                </span>
              </div>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{design.concept.rationale}</p>
              <div className="mt-4 flex items-center gap-1.5">
                {[design.palette.bg, design.palette.surface, design.palette.accent, design.palette.text].map((c, i) => (
                  <span key={i} className="h-5 w-5 rounded-full rule" style={{ background: c }} />
                ))}
                <span className="ml-2 text-[0.7rem] text-muted">{design.typography.displayFont} · {design.typography.bodyFont}</span>
              </div>

              {/* Change it by asking */}
              <div className="mt-5 rule-t pt-5">
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  {refineTarget != null
                    ? t('Fortæl Ava hvad der skal ændres i version {n}', { n: refineTarget })
                    : t('Fortæl Ava hvad der skal ændres')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REFINE_IDEAS.map((idea) => (
                    <SelectPill key={idea} active={instruction === t(idea)} onClick={() => setInstruction(t(idea))}>
                      {t(idea)}
                    </SelectPill>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
                    placeholder={t('f.eks. mere romantisk, mørkere, større billeder…')}
                    className="min-w-0 flex-1 rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none"
                  />
                  <button type="button" onClick={submitRefine} disabled={!instruction.trim()}
                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-canvas hover:bg-ink/80 disabled:opacity-40 transition-colors cursor-pointer">
                    {t('Justér')}
                  </button>
                </div>
                <p className="mt-2.5 text-[0.72rem] leading-relaxed text-muted">
                  {t('Hver ændring gemmes som en ny version under forhåndsvisningen. I kan også spørge Ava i chatten, fx “skriv programmet om” eller “gå tilbage til version 2”.')}
                </p>

                {/* A whole new design from the steps as they stand. */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => void build()}
                    className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-ink transition-colors cursor-pointer">
                    <Palette size={12} /> {t('Nyt design fra bunden')}
                  </button>
                  <button type="button" onClick={onRestart}
                    className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-[var(--color-terracotta)] transition-colors cursor-pointer">
                    <RotateCcw size={12} /> {t('Start forfra')}
                  </button>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── The row of steps: where they are, and a way back to any of them ──── */
function StepRow({ current, reached, open, onStep }: {
  current: DesignStep | null;
  /** Index of the open step; STEPS.length once the site is built. */
  reached: number;
  /** Photos and words need a vibe to build on. */
  open: boolean;
  onStep: (step: DesignStep) => void;
}) {
  const { t } = useLang();
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = s.id === current;
        const done = i < reached;
        return (
          <li key={s.id} className={cn('flex min-w-0 items-center gap-2', i < STEPS.length - 1 && 'flex-1')}>
            <button type="button" onClick={() => onStep(s.id)} disabled={i > 0 && !open}
              aria-current={active ? 'step' : undefined}
              className="group flex min-w-0 items-center gap-2 cursor-pointer disabled:cursor-default disabled:opacity-50">
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-semibold transition-colors',
                active ? 'bg-ink text-canvas' : done ? 'bg-sage-tint text-ink' : 'rule text-muted',
              )}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span className={cn(
                'truncate text-[0.78rem] transition-colors',
                active ? 'font-semibold text-ink' : 'text-muted group-hover:text-ink group-disabled:text-muted',
              )}>
                {t(s.label)}
              </span>
            </button>
            {i < STEPS.length - 1 && <span aria-hidden className="h-px min-w-3 flex-1 bg-[var(--color-line)]" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ── A step's heading ─────────────────────────────────────────────────── */
function StepHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div>
      <p className="font-serif text-[1.4rem] leading-tight text-ink">{title}</p>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{intro}</p>
    </div>
  );
}

/* ── Back and forward, under every step ───────────────────────────────── */
function StepNav({ onBack, children }: { onBack?: () => void; children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-[0.75rem] text-muted transition-colors hover:text-ink cursor-pointer">
          <ArrowLeft size={12} /> {t('Tilbage')}
        </button>
      )}
      <div className="ml-auto">{children}</div>
    </div>
  );
}

/* ── Build progress — the visible step sequence ───────────────────────── */
const BUILD_STEPS = [
  'Genererer billeder til sektionerne…',
  'Henter billeder fra jeres venue…',
  'Ava komponerer layout og typografi…',
  'Bygger jeres side…',
] as const;

function BuildProgress({ mode }: { mode: 'generate' | 'refine' | 'sync' }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const build = mode === 'generate';
  useEffect(() => {
    if (!build) return;
    const t = setInterval(() => setStep((v) => Math.min(v + 1, BUILD_STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [build]);

  return (
    <div className="rule rounded-2xl bg-card p-8 text-center">
      <Loader2 size={26} className="mx-auto animate-spin text-ink" />
      <p className="mt-4 font-serif text-[1.25rem] text-ink">
        {mode === 'sync' ? t('Ava sætter jeres nye ord ind…') : mode === 'refine' ? t('Ava bygger siden om…') : t(BUILD_STEPS[step])}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
        {mode === 'sync'
          ? t('Designet bliver, som det er. Det tager typisk under et minut.')
          : mode === 'refine'
          ? t('Hun anvender jeres ændring på hele siden. Det tager typisk under et minut.')
          : t('Venue-fotos, jeres billeder og skabelonen bliver til én samlet side. Det tager et par minutter første gang.')}
      </p>
      {build && (
        <div className="mx-auto mt-5 flex max-w-[200px] gap-1.5">
          {BUILD_STEPS.map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-ink' : 'bg-shell')} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Template gallery — live-typography cards for the 8 presets ───────── */
export function TemplateGallery({ activePresetId, applyingPreset, onPick }: {
  activePresetId: string | null;
  applyingPreset: string | null;
  onPick: (presetId: string) => void;
}) {
  const { t } = useLang();
  const fontIds = useMemo(
    () => SITE_PRESETS.flatMap((p) => [p.design.typography.displayFont, p.design.typography.bodyFont]),
    []
  );
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <link rel="stylesheet" href={googleFontsHref(fontIds)} />
      {SITE_PRESETS.map((p) => {
        const d = p.design;
        const active = p.id === activePresetId;
        const busy = applyingPreset === p.id;
        return (
          <button
            key={p.id}
            type="button"
            // Picking the vibe they already have would swap a built site back
            // to the bare template, so a second tap does nothing.
            onClick={() => { if (!active) onPick(p.id); }}
            disabled={busy}
            aria-pressed={active}
            className={cn(
              'relative overflow-hidden rounded-xl text-left transition-all cursor-pointer',
              active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule hover:scale-[1.015]'
            )}
            style={{ background: d.palette.bg }}
          >
            {/* Palette strip */}
            <div className="flex h-1.5">
              {[d.palette.accent, d.palette.text, d.palette.surface, d.palette.muted].map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="px-3 py-3.5">
              <p
                className="text-[1.3rem] leading-tight"
                style={{
                  fontFamily: fontStack(d.typography.displayFont),
                  fontWeight: d.typography.displayWeight,
                  fontStyle: d.typography.displayItalic ? 'italic' : 'normal',
                  color: d.palette.text,
                }}
              >
                {t('Anna & Emil')}
              </p>
              <p className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: d.palette.accent }}>
                {t(p.label)}
              </p>
              <p className="mt-1 text-[0.68rem] leading-snug" style={{ color: d.palette.muted }}>
                {t(p.tagline)}
              </p>
            </div>
            {(active || busy) && (
              <span className="absolute right-2 top-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: d.palette.text }}>
                {busy
                  ? <Loader2 size={11} className="animate-spin" style={{ color: d.palette.bg }} />
                  : <Check size={11} style={{ color: d.palette.bg }} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Photo manager — drag & drop + iPhone-friendly picker ─────────────── */
export function PhotoManager({ photos, photoUrls, onUpload, onDelete, onSetHero }: {
  photos: SitePhotoRow[];
  photoUrls: Record<string, string>;
  onUpload: (files: FileList | File[]) => Promise<void> | void;
  onDelete: (id: string) => void;
  onSetHero: (id: string) => void;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const empty = photos.length === 0;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try { await onUpload(files); } finally { setBusy(false); }
  };

  return (
    <section
      className={cn('rule rounded-2xl bg-card p-4 transition-colors', dragging && 'bg-sage-tint')}
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
        void handleFiles(files);
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const url = photoUrls[p.id];
          return (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-shell">
              {url
                ? <img src={url} alt="" className="h-full w-full object-cover" />
                : <span className="flex h-full items-center justify-center"><ImageIcon size={16} className="text-muted" /></span>}
              {p.role === 'hero' && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-canvas">
                  <Star size={8} /> {t('Forsidebillede')}
                </span>
              )}
              {p.kind === 'generated' && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas/85">
                  <Palette size={10} className="text-ink" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {p.role !== 'hero' ? (
                  <button type="button" onClick={() => onSetHero(p.id)} title={t('Brug som forsidebillede')}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas/90 text-ink hover:bg-canvas cursor-pointer">
                    <Star size={11} />
                  </button>
                ) : <span />}
                <button type="button" onClick={() => onDelete(p.id)} title={t('Slet billede')}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas/90 text-ink hover:bg-canvas cursor-pointer">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}

        {/* With nothing uploaded the picker is the whole step; after the
            first photo it becomes one more tile in the grid. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40 cursor-pointer',
            empty ? 'col-span-3 h-40' : 'aspect-square',
            dragging ? 'border-ink text-ink' : 'border-[var(--color-line-strong)]'
          )}
        >
          {busy ? <Loader2 size={empty ? 20 : 16} className="animate-spin" /> : <Upload size={empty ? 20 : 16} />}
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em]">{empty ? t('Vælg billeder') : t('Upload')}</span>
        </button>
      </div>

      {/* accept="image/*" opens the photo library directly on iPhone; HEIC and
          large originals are re-encoded client-side before upload. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
      />
      <div className="mt-3 flex items-center justify-between gap-3 text-[0.68rem] text-muted">
        <span>{t('Alle almindelige billedformater, også direkte fra iPhone')}</span>
        <span className="shrink-0">{photos.length} / {MAX_PHOTOS}</span>
      </div>
    </section>
  );
}
