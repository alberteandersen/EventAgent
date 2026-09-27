"use client";

/* What Ava did to produce a reply. While a turn runs, every tool shows up as
   it starts and ticks off when it lands. Once the reply is in, the steps fold
   into one line above it, "3 handlinger", which opens to the list, and each
   step opens to the arguments it got and what it returned. */

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ChatToolCall } from '@/lib/db/types';
import type { LiveToolCall } from '@/lib/hooks/useAgentChat';
import { cn } from '../ui';
import { useLang } from '../i18n';
import { toolLabel } from './toolLabels';

type Step = ChatToolCall & { running?: boolean };

export default function ToolSteps({ calls, live = false }: { calls: (ChatToolCall | LiveToolCall)[]; live?: boolean }) {
  const { t, tn } = useLang();
  const [open, setOpen] = useState(false);
  if (calls.length === 0) return null;

  if (live) {
    return (
      <ol className="space-y-0.5" aria-live="polite">
        {calls.map((c) => <StepRow key={c.id} step={c} />)}
      </ol>
    );
  }

  const failed = calls.filter((c) => !c.ok).length;
  const icons = [...new Map(calls.map((c) => {
    const l = toolLabel(c.name, c.args);
    return [l.icon, l.icon] as const;
  })).values()].slice(0, 3);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group -ml-1.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[0.74rem] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink cursor-pointer"
      >
        <span className="flex -space-x-1">
          {icons.map((Icon, i) => (
            <span key={i} className="flex size-5 items-center justify-center rounded-full border border-[#e2e6e2] bg-card">
              <Icon size={11} strokeWidth={1.8} />
            </span>
          ))}
        </span>
        {calls.length === 1
          ? t(toolLabel(calls[0].name, calls[0].args).label)
          : tn(calls.length, '{n} handling', '{n} handlinger')}
        {failed > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[#a4513f]">
            <CircleAlert size={12} /> {failed}
          </span>
        )}
        <ChevronRight size={13} className={cn('transition-transform duration-200', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="mt-1 space-y-0.5 overflow-hidden border-l border-[#e2e6e2] pl-2.5"
          >
            {calls.map((c) => <StepRow key={c.id} step={c} expandable />)}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepRow({ step, expandable = false }: { step: Step; expandable?: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const { label, icon: Icon, detail } = toolLabel(step.name, step.args);
  const hasBody = expandable && !step.running;

  const status = step.running ? (
    <LoaderCircle size={13} className="shrink-0 animate-spin text-muted" aria-label={t('I gang')} />
  ) : step.ok ? (
    <Check size={13} className="shrink-0 text-[#4f7a63]" aria-label={t('Færdig')} />
  ) : (
    <CircleAlert size={13} className="shrink-0 text-[#a4513f]" aria-label={t('Fejlede')} />
  );

  const row = (
    <>
      <Icon size={13} strokeWidth={1.7} className="shrink-0 text-muted" />
      <span className={cn('min-w-0 truncate', step.running ? 'text-ink' : 'text-ink-soft')}>
        {t(label)}
        {detail && <span className="text-muted"> · {detail}</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center pl-2">{status}</span>
    </>
  );

  return (
    <li>
      {hasBody ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[0.76rem] transition-colors hover:bg-ink/[0.04] cursor-pointer"
        >
          {row}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-1.5 py-1 text-[0.76rem]">{row}</div>
      )}
      {hasBody && open && (
        <div className="mb-1.5 ml-6 mr-1 space-y-1.5 rounded-lg bg-shell px-2.5 py-2 font-mono text-[0.68rem] leading-relaxed text-ink-soft">
          {Object.keys(step.args).length > 0 && <Detail label={t('Input')} value={step.args} />}
          {step.error
            ? <Detail label={t('Fejl')} value={step.error} tone="error" />
            : step.result && <Detail label={t('Resultat')} value={step.result} />}
        </div>
      )}
    </li>
  );
}

function Detail({ label, value, tone }: { label: string; value: unknown; tone?: 'error' }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1);
  return (
    <div>
      <div className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
      <pre className={cn('max-h-40 overflow-auto whitespace-pre-wrap break-words', tone === 'error' && 'text-[#a4513f]')}>
        {text}
      </pre>
    </div>
  );
}
