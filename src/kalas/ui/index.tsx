import * as React from 'react';
import { Check } from 'lucide-react';
import { useLang } from '../i18n';

import { cn } from './base';

export { cn, pagePad } from './base';
export { Page, PageHeader, SectionTitle } from './Page';
export { Tabs, type TabItem } from './Tabs';
export { Button, IconButton, buttonClass } from './Button';
export { Dialog, ConfirmProvider, useConfirm, type ConfirmOptions } from './Dialog';
export { EmptyState, ErrorState, Loader, PageLoader, Skeleton } from './States';
export { Field, inputClass, textareaClass } from './Field';
export { Card, Stat } from './Card';
export { Wordmark } from './Wordmark';

/* ── Eyebrow / tracked label ─────────────────────────────────────────── */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

/* ── Status chip (tiny) ──────────────────────────────────────────────── */
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'sage' | 'clay' | 'success';
}) {
  const tones = {
    neutral: 'text-muted rule',
    sage: 'text-ink bg-sage-tint',
    clay: 'text-clay-ink bg-clay-tint',
    success: 'text-success bg-success-tint',
  }[tone];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em]', tones)}>
      {children}
    </span>
  );
}

/* ── Selectable pill ─────────────────────────────────────────────────────
   A chip you can turn on and off — dietary needs, an owner, a duration.
   Distinct from `Button`, which does something, and from `Chip`, which is
   a read-only status badge. */
export function SelectPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[0.72rem] transition-colors cursor-pointer',
        active
          ? 'border-ink bg-ink text-canvas'
          : 'border-line bg-shell text-ink-soft hover:border-ink hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────────
   Lifted out of Website.tsx, which had it local while two more one-off
   copies sat in Home.tsx and further down Website itself. */
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} role="switch" aria-checked={value} type="button"
      className={cn('relative h-5 w-9 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
        value ? 'bg-ink' : 'bg-shell')}>
      <span className={cn('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-canvas shadow-sm transition-all duration-200',
        value ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/* ── Task check dot ──────────────────────────────────────────────────────
   The circle used by every completable row (Tidslinje, Tjekliste, Home).
   Non-interactive on purpose: Home wraps whole rows in a <button>, so it can
   only reuse the visual, nesting a button inside a button is invalid. */
export function CheckDot({ done, icon, className }: { done: boolean; icon?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full',
        done ? 'bg-ink text-paper' : 'border-2 border-line-strong bg-transparent',
        className,
      )}
    >
      {icon ?? (done && <Check size={14} strokeWidth={2.5} />)}
    </span>
  );
}

/* ── Toggleable task checkbox ────────────────────────────────────────────── */
export function TaskCheckbox({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={done}
      aria-label={done ? t("Markér '{title}' som ikke færdig", { title: label }) : t("Markér '{title}' som færdig", { title: label })}
      className="shrink-0 cursor-pointer transition-transform hover:scale-105"
    >
      <CheckDot done={done} />
    </button>
  );
}

/** Row background + border for a task's status. */
export function taskRowTone(status: 'done' | 'overdue' | 'default') {
  return status === 'done'
    ? 'border-sage-tint bg-sage-wash'
    : status === 'overdue'
      ? 'border-terracotta/20 bg-terracotta-wash'
      : 'border-line-soft bg-paper';
}

/** Label styling for a completed task. */
export const doneLabelClass = 'text-ink-soft line-through decoration-ink-soft/40';
