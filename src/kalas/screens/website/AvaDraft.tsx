"use client";

/* "Skriv med Ava" under a section's text: she drafts, the couple decides.
   A draft is a suggestion beside their text, never a replacement of it:
   they take it, ask again or close it. The story needs their own answers
   first, since it is the one text only they can know. The FAQ draft only
   fills blank answers and adds questions they do not ask yet. */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { DraftFaqItem, DraftField, StoryAnswers } from '@/lib/website/draft';

type Result = { text?: string; faq?: DraftFaqItem[] };

async function requestDraft(eventId: string, field: DraftField, extra: { story?: StoryAnswers; faq?: DraftFaqItem[] }): Promise<Result> {
  const res = await fetch('/api/website/draft', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, field, ...extra }),
  });
  const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Ava kunne ikke skrive lige nu. Prøv igen.');
  return data;
}

export function AvaWriteButton({ onClick, busy, label }: { onClick: () => void; busy?: boolean; label?: string }) {
  const { t } = useLang();
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="mb-1.5 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] text-muted transition-colors hover:bg-shell hover:text-ink disabled:opacity-50 cursor-pointer">
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {label ?? t('Skriv med Ava')}
    </button>
  );
}

/* ── One text: welcome line, story, dresscode ─────────────────────────── */
export function useAvaText({ eventId, field, beforeCall }: {
  eventId: string | null;
  field: Exclude<DraftField, 'faq'>;
  /** Save first, so Ava reads the content as it stands. */
  beforeCall: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<StoryAnswers>({});

  const run = async () => {
    if (!eventId || busy) return;
    setOpen(true); setBusy(true); setError(null);
    try {
      await beforeCall();
      const r = await requestDraft(eventId, field, field === 'story' ? { story: answers } : {});
      setDraft(r.text ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The story asks before it writes; the rest write straight away.
  const start = () => (field === 'story' && !draft ? setOpen(true) : void run());
  const close = () => { setOpen(false); setDraft(null); setError(null); };
  return { field, open, busy, draft, error, answers, setAnswers, run, start, close };
}

export function AvaTextPanel({ state, onUse, hasText }: {
  state: ReturnType<typeof useAvaText>;
  onUse: (text: string) => void;
  /** Whether taking the draft would replace something they wrote. */
  hasText: boolean;
}) {
  const { t } = useLang();
  const { open, busy, draft, error, answers, setAnswers, run, close } = state;
  // Only the story stops to ask before Ava writes.
  const asking = state.field === 'story' && open && !draft && !busy;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
          <div className="mt-3 rounded-xl bg-sage-tint/60 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
                <Sparkles size={11} /> {t('Avas forslag')}
              </p>
              <button type="button" onClick={close} aria-label={t('Luk')}
                className="text-muted hover:text-ink transition-colors cursor-pointer"><X size={13} /></button>
            </div>

            {asking && (
              <div className="space-y-2.5">
                <p className="text-[0.78rem] leading-relaxed text-muted">
                  {t('Ava skriver kun det, I fortæller hende. Et par ord er nok, spring over hvad I vil.')}
                </p>
                {([
                  ['met', 'Hvordan mødtes I?'],
                  ['knew', 'Hvornår vidste I det?'],
                  ['ahead', 'Hvad glæder I jer mest til?'],
                ] as const).map(([key, q]) => (
                  <label key={key} className="block">
                    <span className="text-[0.74rem] text-ink">{t(q)}</span>
                    <input value={answers[key] ?? ''} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg rule bg-card px-3 py-1.5 text-[0.82rem] text-ink focus:outline-none focus:ring-1 focus:ring-ink/20" />
                  </label>
                ))}
                <button type="button" onClick={() => void run()}
                  disabled={!Object.values(answers).some((v) => v?.trim())}
                  className="mt-1 flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-canvas hover:bg-ink/80 disabled:opacity-40 transition-colors cursor-pointer">
                  <Sparkles size={11} /> {t('Skriv historien')}
                </button>
              </div>
            )}

            {busy && (
              <p className="flex items-center gap-2 text-[0.8rem] text-muted"><Loader2 size={13} className="animate-spin" /> {t('Ava skriver…')}</p>
            )}
            {error && !busy && <p className="text-[0.78rem] text-[var(--color-terracotta)]">{t(error)}</p>}

            {draft && !busy && (
              <>
                <p className="whitespace-pre-line text-[0.85rem] leading-relaxed text-ink">{draft}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => { onUse(draft); close(); }}
                    className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                    <Check size={11} /> {hasText ? t('Erstat min tekst') : t('Brug teksten')}
                  </button>
                  <button type="button" onClick={() => void run()}
                    className="flex items-center gap-1.5 text-[0.74rem] text-muted hover:text-ink transition-colors cursor-pointer">
                    <RotateCcw size={11} /> {t('Prøv igen')}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── The FAQ: answers where theirs are blank, and a few new questions ──── */
export function AvaFaqPanel({ eventId, beforeCall, faq, onUse }: {
  eventId: string | null;
  beforeCall: () => Promise<unknown>;
  faq: DraftFaqItem[];
  onUse: (draft: DraftFaqItem[]) => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftFaqItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!eventId || busy) return;
    setOpen(true); setBusy(true); setError(null);
    try {
      await beforeCall();
      const r = await requestDraft(eventId, 'faq', { faq });
      setDraft(r.faq ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => { setOpen(false); setDraft(null); setError(null); };
  const questionOf = (d: DraftFaqItem) => (d.id ? faq.find((f) => f.id === d.id)?.q : null) ?? d.q;

  return (
    <>
      <AvaWriteButton onClick={() => void run()} busy={busy} label={t('Svar med Ava')} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="order-last basis-full overflow-hidden">
            <div className="mb-3 rounded-xl bg-sage-tint/60 px-4 py-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
                  <Sparkles size={11} /> {t('Avas forslag')}
                </p>
                <button type="button" onClick={close} aria-label={t('Luk')}
                  className="text-muted hover:text-ink transition-colors cursor-pointer"><X size={13} /></button>
              </div>
              {busy && <p className="flex items-center gap-2 text-[0.8rem] text-muted"><Loader2 size={13} className="animate-spin" /> {t('Ava skriver…')}</p>}
              {error && !busy && <p className="text-[0.78rem] text-[var(--color-terracotta)]">{t(error)}</p>}
              {draft && !busy && (
                <>
                  <p className="mb-2 text-[0.74rem] leading-relaxed text-muted">
                    {t('Kun svar, Ava kan give ud fra det, I har fortalt Kalas. Jeres egne svar bliver stående.')}
                  </p>
                  <ul className="space-y-2">
                    {draft.map((d, i) => (
                      <li key={d.id ?? `n${i}`} className="text-[0.8rem] leading-relaxed">
                        <span className="font-medium text-ink">{questionOf(d)}</span>
                        {!d.id && <span className={cn('ml-1.5 text-[0.62rem] uppercase tracking-[0.1em] text-muted')}>{t('Nyt')}</span>}
                        <br /><span className="text-muted">{d.a}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => { onUse(draft); close(); }}
                      className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                      <Check size={11} /> {t('Brug svarene')}
                    </button>
                    <button type="button" onClick={() => void run()}
                      className="flex items-center gap-1.5 text-[0.74rem] text-muted hover:text-ink transition-colors cursor-pointer">
                      <RotateCcw size={11} /> {t('Prøv igen')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
