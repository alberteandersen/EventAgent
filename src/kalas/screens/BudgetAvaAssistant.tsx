"use client";

/* Ava's budget assistant — a real, per-couple recommendation instead of a
   locked-behind-premium percentage table. Same seven categories the budget
   screen already uses, redistributed by Gemini against the couple's own
   total, guest count, region and style, with one rule the server enforces
   no matter what the model says: a category they have already spent money
   in never gets recommended a lower share than that. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, Lightbulb, Loader2, X } from 'lucide-react';
import { resolveBudgetIcon } from '../lib/budget-style';
import { useLang } from '../i18n';
import { cn } from '../ui';

const kr = (n: number) => new Intl.NumberFormat('da-DK').format(Math.round(n));

interface AdviceLine {
  category: string;
  label: string;
  pct: number;
  amount: number;
  rationale: string;
}

interface Advice {
  headline: string;
  total: number;
  lines: AdviceLine[];
  tips: string[];
}

export default function BudgetAvaAssistant({
  eventId,
  guests,
  region,
  onClose,
  onApply,
}: {
  eventId: string;
  /** Shown in the summary strip while Ava works; purely descriptive. */
  guests: number;
  region: string;
  onClose: () => void;
  onApply: (lines: { category: string; amount: number }[]) => void;
}) {
  const { t } = useLang();
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [applied, setApplied] = useState(false);

  const ask = () => {
    setState('loading');
    setErrorMsg('');
    fetch('/api/budget/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        setAdvice(data as Advice);
        setState('ready');
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error && err.message !== 'failed' ? err.message : '');
        setState('error');
      });
  };

  useEffect(ask, [eventId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    if (!advice) return;
    onApply(advice.lines.map((l) => ({ category: l.category, amount: l.amount })));
    setApplied(true);
    window.setTimeout(onClose, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_32px_80px_-16px_rgba(24,32,24,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12332b]">
              <span className="font-serif text-[1.2rem] leading-none text-white">K</span>
            </span>
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
                {t('Avas budgetforslag')}
              </p>
              <h2 className="mt-0.5 truncate font-serif text-[1.3rem] leading-tight text-ink">
                {state === 'ready' && advice?.headline
                  ? advice.headline
                  : t('Sådan ville jeg fordele jeres budget')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Luk')}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 size={22} className="animate-spin text-sage-strong" />
              <p className="text-[0.88rem] text-ink-soft">
                {t('Ava kigger på jeres tal og regner en fordeling ud…')}
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-shell px-6 py-10 text-center">
              <AlertTriangle size={20} className="text-[var(--color-terracotta)]" />
              <p className="text-[0.88rem] text-ink-soft">
                {errorMsg || t('Ava kunne ikke regne på budgettet lige nu.')}
              </p>
              <button
                type="button"
                onClick={ask}
                className="rounded-full bg-ink px-4 py-2 text-[0.8rem] font-semibold text-canvas hover:opacity-90 cursor-pointer"
              >
                {t('Prøv igen')}
              </button>
            </div>
          )}

          {state === 'ready' && advice && (
            <>
              {/* Summary strip — their own numbers, not a locked template */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl bg-shell px-4 py-3 text-[0.82rem] text-ink-soft">
                <span>{t('Budget')} <b className="text-ink tabular-nums">{kr(advice.total)} kr</b></span>
                {guests > 0 && <span>{t('Gæster')} <b className="text-ink tabular-nums">{guests}</b></span>}
                {region && <span>{t('Sted')} <b className="text-ink">{region}</b></span>}
              </div>

              {/* The seven lines, matched by colour to the real budget screen */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {advice.lines.map((l) => {
                  const Icon = resolveBudgetIcon(l.category);
                  return (
                    <div key={l.category} className="rounded-2xl rule bg-card px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon size={14} className="shrink-0 text-ink-soft" strokeWidth={2.25} />
                          <span className="truncate text-[0.88rem] font-medium text-ink">{t(l.label)}</span>
                        </span>
                        <span className="shrink-0 text-[0.72rem] font-semibold text-sage-strong tabular-nums">
                          {l.pct}%
                        </span>
                      </div>
                      <p className="mt-1.5 font-serif text-[1.15rem] leading-none text-ink tabular-nums">
                        {kr(l.amount)} kr
                      </p>
                      {l.rationale && (
                        <p className="mt-1.5 text-[0.76rem] leading-snug text-muted">{l.rationale}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[0.74rem] text-muted">
                {t('Beløb, I allerede har brugt eller betalt, bliver aldrig sat ned.')}
              </p>

              {/* Tips */}
              {advice.tips.length > 0 && (
                <div className="mt-6 rounded-2xl bg-sage-tint px-4 py-4">
                  <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sage-strong">
                    <Lightbulb size={13} /> {t('Smarte tips')}
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {advice.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.82rem] leading-relaxed text-ink">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage-strong" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {state === 'ready' && advice && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink cursor-pointer"
            >
              {t('Luk')}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applied}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-5 py-2 text-[0.82rem] font-semibold transition-opacity cursor-pointer',
                applied ? 'bg-success text-canvas' : 'bg-ink text-canvas hover:opacity-90',
              )}
            >
              {applied ? (<><Check size={14} /> {t('Brugt')}</>) : t('Brug forslaget')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
