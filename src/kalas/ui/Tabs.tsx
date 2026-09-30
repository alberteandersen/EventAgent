import * as React from 'react';
import { useId, useRef } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './base';

export type TabItem<T extends string> = {
  id: T;
  /** Already translated. */
  label: string;
  icon?: LucideIcon;
  /** A count worth their attention, shown as a small badge. */
  badge?: number;
  /** Something is wrong in this tab: a dot, and this text for screen readers. */
  alert?: string;
};

/** The one tab bar: icon (from sm up), label, badge, and an underline that
 *  slides to the active tab. Arrow keys move between tabs, as a tablist
 *  should. Scrolls sideways on a narrow phone rather than wrapping. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Names the tab bar for screen readers. */
  label: string;
  className?: string;
}) {
  const underline = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('-mx-6 flex gap-1 overflow-x-auto border-b border-line px-6 hide-scrollbar sm:mx-0 sm:px-0', className)}
    >
      {items.map(({ id, label: text, icon: Icon, badge, alert }, i) => {
        const active = id === value;
        return (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
              if (e.key === 'Home') { e.preventDefault(); move(0, 0); }
              if (e.key === 'End') { e.preventDefault(); move(items.length - 1, 0); }
            }}
            className={cn(
              'relative flex shrink-0 cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {Icon && <Icon size={15} strokeWidth={2} className="hidden sm:block" aria-hidden />}
            {text}
            {badge ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sage-wash px-1 text-[0.6rem] font-bold text-ink">
                {badge}
              </span>
            ) : null}
            {alert && (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-terracotta" />
                <span className="sr-only">{alert}</span>
              </>
            )}
            {active && (
              <motion.span layoutId={underline} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink" />
            )}
          </button>
        );
      })}
    </div>
  );
}
