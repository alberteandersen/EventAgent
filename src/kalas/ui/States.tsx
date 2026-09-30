import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { useLang } from '../i18n';
import { Button } from './Button';
import { cn } from './base';

/* What a screen shows while it has nothing, while it is fetching, and when
   the fetch failed. One look for each, everywhere. */

/** Nothing here yet: what goes here, and the way to add it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-[22px] border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-sage-wash text-sage-strong">
          <Icon size={20} strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <p className="font-serif text-title text-ink">{title}</p>
      {children && <div className="mt-2 max-w-md text-meta text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Three soft dots while something loads. */
export function Loader({ label, className }: { label?: string; className?: string }) {
  const { t } = useLang();
  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-sage"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
      <span className="sr-only">{label ?? t('Indlæser…')}</span>
    </span>
  );
}

/** A whole page's worth of waiting, before the wedding's data has arrived. */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader />
    </div>
  );
}

/** A grey block standing in for content that is on its way. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-shell', className)} />;
}

/** The fetch failed: say so, and offer to try again. Never an empty list. */
export function ErrorState({
  title,
  children,
  onRetry,
  className,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useLang();
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-[22px] border border-terracotta/25 bg-terracotta-tint/40 px-6 py-10 text-center', className)}>
      <AlertCircle size={22} strokeWidth={1.8} className="mb-3 text-terracotta" aria-hidden />
      <p className="font-serif text-title text-ink">{title ?? t('Det kunne vi ikke hente')}</p>
      <div className="mt-2 max-w-md text-meta text-muted">{children ?? t('Tjek forbindelsen, og prøv igen.')}</div>
      {onRetry && <Button variant="secondary" className="mt-5" onClick={onRetry}>{t('Prøv igen')}</Button>}
    </div>
  );
}
