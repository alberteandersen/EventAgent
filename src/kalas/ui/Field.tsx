import * as React from 'react';
import { cn } from './base';

/* Form fields. The label is a real <label> around its input, so clicking the
   words focuses the field and a screen reader reads them with it. */

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none disabled:opacity-60';

export const textareaClass =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="text-xs text-terracotta">{error}</span>}
    </label>
  );
}
