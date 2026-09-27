'use client';

/* The card builder's panel: pick a vibe (the card changes at once, with the
   vibe's own painting), write what it says, pick the paper, tell Ava how it
   should feel, and she paints and sets a card of their own. After that the
   panel is the finished card: change it by asking, step through versions,
   start over, and take it to Canva.

   The open step and the words to Ava belong to the parent screen, so moving
   around the panel costs the couple nothing. */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, Download, History, Loader2, Palette, RotateCcw, Image as ImageIcon, Upload,
} from 'lucide-react';
import { Eyebrow, SelectPill, cn } from '../ui';
import { useLang } from '../i18n';
import { hasIdea, toggleIdea } from '../site/brief';
import { websitePriceDkk } from '@/lib/website/pricing';
import { CardView } from './card/CardView';
import { CARD_FORMATS, type CardFormatId } from './card/formats';
import { CARD_VIBES, VIBE_GROUPS, sampleArt, starterSpec } from './card/vibes';
import { IMAGES } from '../images';
import { parseCardSpec, type CardSpec } from './card/spec';
import type { InvitationDesignRow } from '@/lib/db/types';
import type { InviteContent } from './content';

export type CardStep = 'vibe' | 'content' | 'format' | 'brief';

const STEPS: { id: CardStep; label: string }[] = [
  { id: 'vibe', label: 'Stemning' },
  { id: 'content', label: 'Indhold' },
  { id: 'format', label: 'Format' },
  { id: 'brief', label: 'Jeres ord' },
];

/** Danish source strings, shown through t(). No separators (see brief.ts). */
const IDEAS = [
  'Flere blomster',
  'Mere luft og ro',
  'Klassisk og formelt',
  'Lidt mere festligt',
  'Varme farver',
  'Kølige grønne toner',
  'Et strejf af guld',
  'Ikke for højtideligt',
] as const;

const primaryBtn =
  'flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-ink/80 disabled:cursor-default disabled:opacity-40 cursor-pointer';

export interface CardStepsProps {
  step: CardStep | null;
  onStep: (step: CardStep | null) => void;
  brief: string;
  onBrief: (brief: string) => void;
  content: InviteContent;
  onContent: (patch: Partial<InviteContent>) => void;
  spec: CardSpec | null;
  designs: InvitationDesignRow[];
  activeId: string | null;
  working: null | 'generate' | 'refine';
  applying: string | null;
  restarting: boolean;
  exporting: null | 'pptx' | 'png';
  genError: string | null;
  needsPayment: boolean;
  websitePaid: boolean;
  onVibe: (vibe: string, format: CardFormatId) => void;
  /** Ava paints and sets the card, in `format` when given. */
  onBuild: (brief: string, format?: CardFormatId) => Promise<boolean>;
  onRefine: (instruction: string) => void;
  onActivate: (designId: string) => void;
  onRestart: () => void;
  onCheckout: () => void;
  onExport: (kind: 'pptx' | 'png') => void;
  /** The couple's own photos (shared with the website), for a card with one. */
  photos: { id: string; url: string }[];
  /** The chosen photo's URL, or null. */
  photoUrl: string | null;
  uploading: boolean;
  onUpload: (files: FileList | File[]) => Promise<void>;
}

export default function CardSteps(props: CardStepsProps) {
  const {
    step, onStep, brief, onBrief, content, onContent, spec, designs, activeId, working, applying,
    restarting, genError, needsPayment, websitePaid, onVibe, onBuild, onRefine, onActivate, onRestart, onCheckout,
    photoUrl,
  } = props;
  const { t } = useLang();
  const [instruction, setInstruction] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  const painted = Boolean(spec?.art.path);
  // Nothing opened yet: a card Ava made shows as finished, a picked vibe
  // resumes at the words, and a blank slate starts at the vibes.
  const current: CardStep | null = step ?? (painted ? null : spec ? 'content' : 'vibe');
  const reached = current ? STEPS.findIndex((s) => s.id === current) : STEPS.length;
  const format = spec?.format ?? '5x7';

  const submitRefine = () => {
    const text = instruction.trim();
    if (!text || working) return;
    setInstruction('');
    onRefine(text);
  };
  const build = async (f?: CardFormatId) => {
    if (await onBuild(brief, f)) onStep(null);
  };

  if (restarting) return <Waiting title={t('Starter forfra…')} />;
  if (working) return <BuildProgress refine={working === 'refine'} />;

  return (
    <div className="space-y-7">
      {genError && (
        <p className="rule rounded-xl bg-terracotta-tint px-4 py-3 text-[0.82rem] text-[var(--color-terracotta)]">{t(genError)}</p>
      )}

      {needsPayment && !websitePaid && (
        <div className="rule rounded-2xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink">
            <Palette size={18} className="text-canvas" />
          </div>
          <p className="font-serif text-[1.25rem] text-ink leading-tight">{t('Lås Ava-designeren op')}</p>
          <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
            {t('Stemningerne og deres kort er jeres. Når Ava maler et kort kun til jer og ændrer det, er det samme køb som jeres hjemmeside: ét køb låser op for begge.')}
          </p>
          <button type="button" onClick={onCheckout}
            className="mt-5 rounded-full bg-ink px-6 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
            {t('Lås op · {price} kr', { price: websitePriceDkk() })}
          </button>
        </div>
      )}

      <StepRow current={current} reached={reached} open={Boolean(spec)} onStep={onStep} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current ?? 'card'}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {current === 'vibe' && (
            <>
              <StepHead title={t('Vælg en stemning')}
                intro={t('Hver stemning har sit eget maleri og sin egen typografi. Kortet til venstre skifter med det samme.')} />
              {painted && (
                <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                  {t('Kortet Ava malede til jer ligger under Versioner, hvis I skifter.')}
                </p>
              )}
              {VIBE_GROUPS.map((g) => (
              <div key={g.id} className="mt-6">
              <p className="mb-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">{t(g.label)}</p>
              <div className="grid grid-cols-2 gap-3">
                {CARD_VIBES.filter((v) => v.group === g.id).map((v) => {
                  const active = spec?.vibe === v.id && !painted;
                  const busy = applying === v.id;
                  return (
                    <button key={v.id} type="button" aria-pressed={active} disabled={busy}
                      onClick={() => { onStep('vibe'); if (!active) onVibe(v.id, format); }}
                      className={cn('group relative overflow-hidden rounded-xl bg-card text-left transition-all cursor-pointer',
                        active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule hover:-translate-y-0.5')}>
                      {/* A photo vibe shows their photo if they have picked one, else an example. */}
                      <CardView spec={starterSpec(v, CARD_FORMATS.find((f) => f.id === format)!, content.language)}
                        content={content} artUrl={sampleArt(v.id, format)} photoUrl={photoUrl ?? IMAGES.portrait} title={t(v.label)} />
                      <div className="px-3 py-2.5">
                        <p className="text-[0.82rem] font-semibold text-ink">{t(v.label)}</p>
                        <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{t(v.tagline)}</p>
                      </div>
                      {(active || busy) && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink">
                          {busy ? <Loader2 size={12} className="animate-spin text-canvas" /> : <Check size={12} className="text-canvas" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>
              ))}
              <StepNav>
                <button type="button" onClick={() => onStep('content')} disabled={!spec} className={primaryBtn}>
                  {t('Næste')} <ArrowRight size={12} />
                </button>
              </StepNav>
            </>
          )}

          {current === 'content' && (
            <>
              <StepHead title={t('Det, kortet skal sige')}
                intro={t('Hentet fra jeres bryllup. Ret det, der skal stå anderledes. Tom linje: kortet bruger stemningens egne ord.')} />
              {spec?.blocks.some((b) => b.role === 'photo') && <PhotoPicker {...props} />}
              <ContentForm content={content} onContent={onContent} spec={spec} />
              <StepNav onBack={() => onStep('vibe')}>
                <button type="button" onClick={() => onStep('format')} className={primaryBtn}>
                  {t('Næste')} <ArrowRight size={12} />
                </button>
              </StepNav>
            </>
          )}

          {current === 'format' && spec && (
            <>
              <StepHead title={t('Vælg format')}
                intro={t('5×7 tommer er det klassiske invitationskort. Kortet kan hentes i begge retninger.')} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {CARD_FORMATS.map((f) => {
                  const active = f.id === spec.format;
                  return (
                    <button key={f.id} type="button" aria-pressed={active}
                      onClick={() => { if (!active && !painted) onVibe(spec.vibe, f.id); }}
                      disabled={painted && !active}
                      className={cn('flex flex-col items-center justify-end gap-3 rounded-xl bg-card p-4 transition-all cursor-pointer disabled:cursor-default',
                        active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule hover:bg-shell disabled:opacity-50')}>
                      <span className="rule block bg-shell" style={{ width: f.widthIn * 14, height: f.heightIn * 14 }} />
                      <span className="text-[0.8rem] font-semibold text-ink">{t(f.label)}</span>
                    </button>
                  );
                })}
              </div>
              {painted && (
                <div className="mt-4 rounded-xl bg-shell px-4 py-3">
                  <p className="text-[0.8rem] leading-relaxed text-ink">
                    {t('Ava malede kortet til dette format. I et andet format maler hun det om.')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CARD_FORMATS.filter((f) => f.id !== spec.format).map((f) => (
                      <button key={f.id} type="button" onClick={() => void build(f.id)}
                        className="text-[0.75rem] font-semibold text-ink underline underline-offset-2 cursor-pointer">
                        {t('Mal om som {format}', { format: t(f.label) })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <StepNav onBack={() => onStep('content')}>
                <button type="button" onClick={() => onStep('brief')} className={primaryBtn}>
                  {t('Næste')} <ArrowRight size={12} />
                </button>
              </StepNav>
            </>
          )}

          {current === 'brief' && (
            <>
              <StepHead title={t('Fortæl Ava, hvordan kortet skal føles')}
                intro={t('Hun maler et kort kun til jer i stemningens stil og sætter jeres ord på det. Tryk på en idé, eller skriv selv.')} />
              <div className="mt-5 flex flex-wrap gap-1.5">
                {IDEAS.map((idea) => {
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
                aria-label={t('Fortæl Ava, hvordan kortet skal føles')}
                placeholder={t('f.eks. Hvide blomster og eukalyptus, lyst og luftigt, navnene i en smuk håndskrift…')}
                className="mt-3 w-full resize-none rule rounded-xl bg-shell px-4 py-3 text-[0.85rem] leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20"
              />
              <StepNav onBack={() => onStep('format')}>
                <button type="button" onClick={() => void build()} className={primaryBtn}>
                  <Palette size={12} /> {painted ? t('Mal kortet igen') : t('Lav kortet med Ava')}
                </button>
              </StepNav>
            </>
          )}

          {current === null && spec && (
            <section className="rule rounded-2xl bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow className="mb-2">{t('Jeres kort')}</Eyebrow>
                  <p className="font-serif text-[1.5rem] leading-tight text-ink">{spec.conceptName}</p>
                </div>
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-tint">
                  <Palette size={15} className="text-ink" />
                </span>
              </div>

              <div className="mt-5 rule-t pt-5">
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{t('Fortæl Ava hvad der skal ændres')}</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
                    placeholder={t('f.eks. flere blomster, mindre navne, mørkere tekst…')}
                    className="min-w-0 flex-1 rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none"
                  />
                  <button type="button" onClick={submitRefine} disabled={!instruction.trim()}
                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 disabled:opacity-40 transition-colors cursor-pointer">
                    {t('Justér')}
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                  {designs.length > 1 && (
                    <button type="button" onClick={() => setShowVersions((v) => !v)}
                      className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-ink transition-colors cursor-pointer">
                      <History size={12} /> {t('Versioner ({n})', { n: designs.length })}
                    </button>
                  )}
                  <button type="button" onClick={onRestart}
                    className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-[var(--color-terracotta)] transition-colors cursor-pointer">
                    <RotateCcw size={12} /> {t('Start forfra')}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showVersions && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 space-y-2">
                      {designs.map((d) => {
                        const ds = parseCardSpec(d.design, spec);
                        const isActive = d.id === activeId;
                        return (
                          <button key={d.id} type="button" onClick={() => { if (!isActive) onActivate(d.id); }}
                            className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer',
                              isActive ? 'bg-sage-tint' : 'bg-shell hover:bg-card')}>
                            <span className="flex gap-1">
                              {[ds.palette.paper, ds.palette.accent, ds.palette.ink].map((c, i) => (
                                <span key={i} className="h-3.5 w-3.5 rounded-full rule" style={{ background: c }} />
                              ))}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">
                              {ds.conceptName}
                              {!ds.art.path && <span className="text-muted"> · {t('stemning')}</span>}
                            </span>
                            <span className="shrink-0 text-[0.65rem] text-muted">
                              {new Date(d.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                            </span>
                            {isActive && <Check size={13} className="shrink-0 text-ink" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {spec && <ExportCard {...props} />}
    </div>
  );
}

/* ── What the card says ──────────────────────────────────────────────── */
function ContentForm({ content, onContent, spec }: {
  content: InviteContent;
  onContent: (p: Partial<InviteContent>) => void;
  spec: CardSpec | null;
}) {
  const { t } = useLang();
  const designText = (role: 'eyebrow' | 'invite' | 'closing') =>
    (spec?.blocks.find((b) => b.role === role)?.text ?? '').replace(/\n/g, ' ');
  const setWording = (role: 'eyebrow' | 'invite' | 'closing', v: string) =>
    onContent({ wording: { ...content.wording, [role]: v } });

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Partner A')} value={content.partnerA} onChange={(v) => onContent({ partnerA: v })} />
        <Field label={t('Partner B')} value={content.partnerB} onChange={(v) => onContent({ partnerB: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Dato')} type="date" value={content.date} onChange={(v) => onContent({ date: v })} />
        <Field label={t('Tidspunkt')} value={content.time} onChange={(v) => onContent({ time: v })} placeholder="14:00" />
      </div>
      <Field label={t('Sted')} value={content.venue} onChange={(v) => onContent({ venue: v })} />
      <Field label={t('Adresse eller by')} value={content.venueDetail} onChange={(v) => onContent({ venueDetail: v })} placeholder={t('f.eks. Kirke Såby')} />
      <Field label={t('Svarfrist')} type="date" value={content.rsvpBy} onChange={(v) => onContent({ rsvpBy: v })} />
      <div>
        <Label>{t('Til gæsterne (valgfri)')}</Label>
        <textarea value={content.note} onChange={(e) => onContent({ note: e.target.value })} rows={2}
          placeholder={t('f.eks. Dresscode: festligt.')}
          className="w-full resize-none rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none" />
      </div>

      <div className="rule-t pt-4">
        <Label>{t('Kortets egne ord')}</Label>
        <div className="space-y-3">
          <Field label={t('Overlinje')} value={content.wording?.eyebrow ?? ''} placeholder={designText('eyebrow')} onChange={(v) => setWording('eyebrow', v)} />
          <Field label={t('Invitation')} value={content.wording?.invite ?? ''} placeholder={designText('invite')} onChange={(v) => setWording('invite', v)} />
          <Field label={t('Afslutning')} value={content.wording?.closing ?? ''} placeholder={designText('closing')} onChange={(v) => setWording('closing', v)} />
        </div>
      </div>

      <div>
        <Label>{t('Sprog på kortet')}</Label>
        <div className="flex gap-2">
          {(['da', 'en'] as const).map((l) => (
            <button key={l} type="button" onClick={() => onContent({ language: l })}
              className={cn('flex-1 rounded-xl border px-3 py-2 text-[0.8rem] transition-colors cursor-pointer',
                content.language === l ? 'border-ink bg-ink text-canvas' : 'rule text-ink-soft hover:text-ink')}>
              {l === 'da' ? 'Dansk' : 'English'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">{children}</p>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'date';
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none" />
    </label>
  );
}

/* ── The photo on a photo card ──────────────────────────────────────── */
function PhotoPicker({ photos, content, onContent, uploading, onUpload }: CardStepsProps) {
  const { t } = useLang();
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div className="mt-5">
      <Label>{t('Jeres billede')}</Label>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => {
          const on = content.photoId === p.id;
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => onContent({ photoId: p.id })}
              className={cn('relative aspect-square overflow-hidden rounded-lg bg-shell cursor-pointer',
                on ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink"><Check size={11} className="text-canvas" /></span>}
            </button>
          );
        })}
        <button type="button" onClick={() => input.current?.click()} disabled={uploading}
          className={cn('flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-line-strong)] text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50 cursor-pointer',
            photos.length === 0 ? 'col-span-4 h-28' : 'aspect-square')}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.1em]">{t('Upload')}</span>
        </button>
      </div>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-muted">
        {t('Billedet sættes ind som det er: Ava ændrer aldrig jeres billeder. Billederne deles med jeres hjemmeside.')}
      </p>
      <input ref={input} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { if (e.target.files) void onUpload(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/* ── Taking the card out: Canva, or a print-ready picture ────────────── */
function ExportCard({ exporting, onExport }: CardStepsProps) {
  const { t } = useLang();
  return (
    <section className="rule rounded-2xl bg-card p-6">
      <Eyebrow className="mb-2">{t('Hent kortet')}</Eyebrow>
      <p className="text-[0.82rem] leading-relaxed text-muted">
        {t('Til Canva: hent filen, og vælg Upload i Canva. Kortet åbner i det rigtige format, og alle tekster kan rettes.')}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onExport('pptx')} disabled={Boolean(exporting)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 disabled:opacity-60 transition-colors cursor-pointer">
          {exporting === 'pptx' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {t('Til Canva')}
        </button>
        <button type="button" onClick={() => onExport('png')} disabled={Boolean(exporting)}
          className="flex items-center justify-center gap-2 rounded-2xl rule py-3 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink hover:bg-shell disabled:opacity-60 transition-colors cursor-pointer">
          {exporting === 'png' ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} {t('Billede (PNG)')}
        </button>
      </div>
    </section>
  );
}

/* ── Steps row ────────────────────────────────────────────────────────── */
function StepRow({ current, reached, open, onStep }: {
  current: CardStep | null;
  reached: number;
  /** Everything after the vibe needs a vibe to build on. */
  open: boolean;
  onStep: (step: CardStep) => void;
}) {
  const { t } = useLang();
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = s.id === current;
        const done = i < reached;
        return (
          <li key={s.id} className={cn('flex min-w-0 items-center gap-2', i < STEPS.length - 1 && 'flex-1')}>
            {/* Four labels do not fit the panel, so only the open step says
                its name; the others carry it for screen readers and on hover. */}
            <button type="button" onClick={() => onStep(s.id)} disabled={i > 0 && !open}
              aria-current={active ? 'step' : undefined} aria-label={t(s.label)} title={t(s.label)}
              className="group flex min-w-0 items-center gap-2 cursor-pointer disabled:cursor-default disabled:opacity-50">
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-semibold transition-colors',
                active ? 'bg-ink text-canvas' : done ? 'bg-sage-tint text-ink' : 'rule text-muted',
              )}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              {active && <span className="whitespace-nowrap text-[0.78rem] font-semibold text-ink">{t(s.label)}</span>}
            </button>
            {i < STEPS.length - 1 && <span aria-hidden className="h-px min-w-3 flex-1 bg-[var(--color-line)]" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div>
      <p className="font-serif text-[1.4rem] leading-tight text-ink">{title}</p>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{intro}</p>
    </div>
  );
}

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

function Waiting({ title }: { title: string }) {
  return (
    <div className="rule rounded-2xl bg-card p-8 text-center">
      <Loader2 size={26} className="mx-auto animate-spin text-ink" />
      <p className="mt-4 font-serif text-[1.25rem] text-ink">{title}</p>
    </div>
  );
}

const BUILD_STEPS = [
  'Ava vælger typografi og farver…',
  'Ava maler kortet…',
  'Ava sætter jeres ord…',
] as const;

function BuildProgress({ refine }: { refine: boolean }) {
  const { t } = useLang();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, BUILD_STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rule rounded-2xl bg-card p-8 text-center">
      <Loader2 size={26} className="mx-auto animate-spin text-ink" />
      <p className="mt-4 font-serif text-[1.25rem] text-ink">
        {refine ? t('Ava retter kortet…') : t(BUILD_STEPS[i])}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
        {t('Det tager typisk under et minut.')}
      </p>
    </div>
  );
}
