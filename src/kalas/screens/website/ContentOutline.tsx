"use client";

/* The pieces of the Indhold tab that make it an outline rather than a pile
   of cards: the row of steps with how far each has come, the way on to the
   next one, and the notice that the built site still shows old words. The
   section editors themselves stay in Website.tsx, next to their state. */

import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { ContentStep, SectionStatus, StepSummary } from '../../site/outline';

/* ── The row of steps ─────────────────────────────────────────────────── */
export function ContentStepRow({ steps, summaries, current, onStep }: {
  steps: ContentStep[];
  summaries: StepSummary[];
  current: number;
  onStep: (index: number) => void;
}) {
  const { t } = useLang();
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2">
      {steps.map((s, i) => {
        const active = i === current;
        const sum = summaries[i];
        // Done: something of it is on the site, and none of that misses anything.
        const done = sum.on > 0 && sum.todo === 0;
        return (
          // The open step keeps its whole name; the others give way to it.
          <li key={s.id} className={cn('flex items-center gap-1.5 sm:gap-2', active ? 'min-w-fit' : 'min-w-0', i < steps.length - 1 && 'flex-1')}>
            <button type="button" onClick={() => onStep(i)}
              aria-current={active ? 'step' : undefined}
              title={sum.todo > 0 ? t('{n} mangler noget', { n: sum.todo }) : undefined}
              className={cn('group relative flex items-center gap-2 cursor-pointer', active ? 'shrink-0' : 'min-w-0')}>
              <span className={cn(
                'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-semibold transition-colors',
                active ? 'bg-ink text-canvas' : done ? 'bg-sage-tint text-ink' : 'rule text-muted group-hover:text-ink',
              )}>
                {done && !active ? <Check size={12} /> : i + 1}
                {sum.todo > 0 && (
                  <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-terracotta)] ring-2 ring-canvas" />
                )}
              </span>
              {/* On a phone only the open step keeps its name. */}
              <span className={cn(
                'truncate text-[0.78rem] transition-colors',
                active ? 'font-semibold text-ink' : 'hidden text-muted group-hover:text-ink md:inline',
              )}>
                {t(s.label)}
              </span>
            </button>
            {i < steps.length - 1 && <span aria-hidden className="h-px min-w-2 flex-1 bg-[var(--color-line)]" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ── A section's state, under its name ────────────────────────────────── */
export function SectionStatusLine({ status, desc }: { status: SectionStatus; desc: string }) {
  const { t, tn } = useLang();
  if (status.state === 'off') return <p className="mt-0.5 text-[0.7rem] text-muted">{t(desc)}</p>;
  if (status.state === 'ready') {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-muted">
        <Check size={11} className="shrink-0 text-ink" /> {t('Klar')}
        <span className="truncate">· {t(desc)}</span>
      </p>
    );
  }
  const note = status.n != null && status.one
    ? tn(status.n, status.one, status.note ?? '', { n: status.n })
    : t(status.note ?? '');
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-[var(--color-terracotta)]">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-terracotta)]" /> {note}
    </p>
  );
}

/* ── Back and on, under each step ─────────────────────────────────────── */
export function ContentStepNav({ onBack, onNext, nextLabel }: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel: string;
}) {
  const { t } = useLang();
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-[0.75rem] text-muted transition-colors hover:text-ink cursor-pointer">
          <ArrowLeft size={12} /> {t('Tilbage')}
        </button>
      )}
      {onNext && (
        <button type="button" onClick={onNext}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-ink/80 cursor-pointer">
          {nextLabel} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

/* ── The built site lacks something only Ava can add ───────────────────── */
export function StaleContentNotice({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rule rounded-2xl bg-card px-5 py-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[0.88rem] font-medium text-ink">{t('Gæsterne ser ikke det nye endnu')}</p>
        <p className="mt-0.5 text-[0.76rem] leading-relaxed text-muted">
          {t('Ava skal sætte det ind, I har ændret siden sidst. Designet bliver, som det er.')}
        </p>
      </div>
      <button type="button" onClick={onSync} disabled={syncing}
        className="flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-ink/80 disabled:opacity-60 cursor-pointer">
        {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {syncing ? t('Opdaterer…') : t('Opdatér siden')}
      </button>
    </div>
  );
}
