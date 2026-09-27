"use client";

/* One filter, one pill, one little menu under it.
 *
 * Replaces a single "Filtre" drawer holding six collapsed sections. The drawer
 * hid what could be adjusted until you opened it; a row of named pills says it
 * out loud, and each pill carries its own answer ("Stemning · 2") so the
 * separate row of active-filter chips underneath is no longer needed.
 *
 * Two things about the popover are load-bearing, both learned the hard way by
 * the drawer this replaces:
 *
 *  - It is positioned ABSOLUTELY inside a relative wrapper, never fixed.
 *    `position: fixed` resolves against the transformed ancestor this sits
 *    inside rather than the viewport, so a "full screen" sheet was never
 *    reliably that.
 *  - It is mounted straight off `open` with no AnimatePresence. With one, the
 *    exit animation ran to completion — opacity 0 — but the node was never
 *    removed, and an invisible panel went on swallowing clicks meant for the
 *    venue cards underneath. Entry animates; closing is immediate, which is
 *    what most filter menus do anyway.
 *
 * The row itself wraps rather than scrolls sideways, because an absolutely
 * positioned menu inside an `overflow-x-auto` track would be clipped by it. */

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';

export default function FilterPill({
  label,
  summary,
  count,
  open,
  onOpenChange,
  align = 'left',
  width = '18rem',
  onReset,
  shown,
  children,
}: {
  label: string;
  /** Replaces the label when the filter is set — "175 gæster", "Fyn +2". */
  summary?: string | null;
  /** Shown as a badge when several things are chosen inside. */
  count?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pills near the right edge hang their menu the other way. */
  align?: 'left' | 'right';
  width?: string;
  /** Clears just this pill's filters; hidden when nothing here is set. */
  onReset?: () => void;
  /** Live result count for the footer button — the point of the pattern. */
  shown?: number;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    // Clicking away closes. The pill's own trigger is excluded so its click is
    // not read as "outside", which would close and reopen in one go.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (wrapRef.current?.querySelector('[data-pill-trigger]')?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onOpenChange]);

  const set = Boolean(summary) || (count ?? 0) > 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        data-pill-trigger
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'inline-flex h-9 max-w-[15rem] items-center gap-1.5 rounded-full border px-3.5 text-[0.78rem] transition-colors cursor-pointer',
          set || open
            ? 'border-ink bg-sage-wash font-semibold text-ink'
            : 'border-line bg-card text-muted hover:border-ink hover:text-ink',
        )}
      >
        <span className="truncate">{summary || label}</span>
        {(count ?? 0) > 1 && (
          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-ink px-1 text-[0.62rem] font-bold text-paper">
            {count}
          </span>
        )}
        <ChevronDown
          size={13}
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: `min(${width}, calc(100vw - 2rem))` }}
          className={cn(
            'absolute top-full z-50 mt-2 flex max-h-[min(70vh,30rem)] flex-col rounded-2xl',
            'border border-line bg-card shadow-[0_18px_50px_rgba(18,51,43,0.16)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>

          {(onReset || shown != null) && (
            <div className="flex shrink-0 items-center gap-3 rounded-b-2xl border-t border-line bg-card px-4 py-3">
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-[0.78rem] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline cursor-pointer"
                >
                  {t('Nulstil')}
                </button>
              )}
              {shown != null && (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="ml-auto inline-flex h-9 items-center justify-center rounded-full bg-ink px-5 text-[0.8rem] font-bold text-paper transition-opacity hover:opacity-90 cursor-pointer"
                >
                  {t('Vis {n} steder', { n: shown })}
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
