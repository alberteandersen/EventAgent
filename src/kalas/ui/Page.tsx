import * as React from 'react';
import type { ScreenId } from '../Shell';
import { GuideLink } from '../screens/guides/GuideLink';
import { cn, pagePad } from './base';

/* Every screen's frame: the gutters, the rhythm between sections, and the
   header on top. The page background is the shell's, so screens never paint
   their own. */

export function Page({
  children,
  narrow = false,
  className,
  ref,
}: {
  children: React.ReactNode;
  /** Reading-width pages (Guides) cap the line length; the rest use the width. */
  narrow?: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className={cn('flex min-h-full flex-col gap-6', pagePad, narrow && 'mx-auto w-full max-w-5xl', className)}>
      {children}
    </div>
  );
}

/** The page's name, one line on what it is for, its guide, and its actions.
 *  Tabs go in as children, under the title. */
export function PageHeader({
  title,
  subtitle,
  guide,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shows "Guide: …" for this screen, when it has one. */
  guide?: ScreenId;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-page tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-meta text-muted">{subtitle}</p>}
          {guide && <GuideLink screen={guide} />}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** A heading inside a page: serif, with an optional line and action. */
export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-title text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-meta text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
