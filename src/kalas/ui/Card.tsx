import * as React from 'react';
import { cn } from './base';

/* The surfaces. One radius for a card, one hairline, white on the canvas;
   no shadow at rest. */

export function Card({
  children,
  padded = true,
  className,
}: {
  children: React.ReactNode;
  /** Off for cards whose content runs edge to edge (lists, images). */
  padded?: boolean;
  className?: string;
}) {
  return <div className={cn('rounded-[22px] border border-line bg-card', padded && 'p-5 sm:p-6', className)}>{children}</div>;
}

/** One number and what it counts. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-micro font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1.5 font-serif text-[1.9rem] leading-none text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
