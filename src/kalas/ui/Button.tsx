import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './base';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-default disabled:opacity-40';

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-meta',
};

const VARIANTS: Record<Variant, string> = {
  /** One per view: the thing this page is for. */
  primary: 'bg-ink text-paper hover:bg-ink/90',
  secondary: 'border border-line bg-card text-ink hover:bg-shell',
  ghost: 'text-muted hover:bg-ink/5 hover:text-ink',
  danger: 'border border-terracotta/30 bg-card text-terracotta hover:bg-terracotta-tint',
};

export function buttonClass({ variant = 'primary', size = 'md', className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}

type Common = { variant?: Variant; size?: Size; icon?: LucideIcon; className?: string; children?: React.ReactNode };

/** The app's button. Sentence case, a pill, forest for the primary action.
 *  Pass `href` for a link that looks like one. */
export function Button(
  props: Common & (
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  ),
) {
  const { variant, size = 'md', icon: Icon, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, className });
  const content = (
    <>
      {Icon && <Icon size={size === 'sm' ? 14 : 15} strokeWidth={2} aria-hidden />}
      {children}
    </>
  );
  if (typeof rest.href === 'string') {
    return <a {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)} className={cls}>{content}</a>;
  }
  const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type="button" {...buttonProps} className={cls}>{content}</button>;
}

/** A round icon-only button. The label is required: it is all a screen
 *  reader gets. */
export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: { icon: LucideIcon; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-40',
        className,
      )}
    >
      <Icon size={17} strokeWidth={1.8} aria-hidden />
    </button>
  );
}
