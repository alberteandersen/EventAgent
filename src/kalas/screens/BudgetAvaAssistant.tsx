"use client";

/* Ava's budget assistant — a real, per-couple recommendation instead of a
   locked-behind-premium percentage table. Same categories the budget
   screen already uses, redistributed by Gemini against the couple's own
   total, guest count, region and style, with one rule the server enforces
   no matter what the model says: a category they have already spent money
   in never gets recommended a lower share than that. */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Lightbulb, Loader2 } from 'lucide-react';
import { resolveBudgetIcon } from '../lib/budget-style';
import { useLang } from '../i18n';
import { Button, Dialog } from '../ui';

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the panel asks Ava as it opens
  useEffect(ask, [eventId]);

  const apply = () => {
    if (!advice) return;
    onApply(advice.lines.map((l) => ({ category: l.category, amount: l.amount })));
    setApplied(true);
    window.setTimeout(onClose, 1100);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      eyebrow={t('Avas budgetforslag')}
      title={state === 'ready' && advice?.headline ? advice.headline : t('Sådan ville jeg fordele jeres budget')}
      footer={state === 'ready' && advice ? (
        <>
          <Button variant="ghost" onClick={onClose}>{t('Luk')}</Button>
          <Button icon={applied ? Check : undefined} onClick={apply} disabled={applied}>
            {applied ? t('Brugt') : t('Brug forslaget')}
          </Button>
        </>
      ) : undefined}
    >
        <div>
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
              <AlertTriangle size={20} className="text-terracotta" />
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

              {/* The benchmark lines, matched by colour to the real budget screen */}
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
    </Dialog>
  );
}
