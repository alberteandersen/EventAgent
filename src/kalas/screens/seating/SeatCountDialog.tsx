"use client";

/* How many chairs, asked when the table is put down. A new table used to
   arrive with a fixed eight or twelve, and the couple then had to find the
   stepper to fix it, when they usually know the number before they click.
   The default is still offered, and the count can change afterwards. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '../../i18n';
import { MAX_SEATS, MIN_SEATS, SHAPES, type TableShape } from './model';

export default function SeatCountDialog({ shape, icon: Icon, onConfirm, onCancel }: {
  shape: TableShape;
  icon: LucideIcon;
  onConfirm: (seats: number) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const spec = SHAPES.find((s) => s.id === shape)!;
  const [seats, setSeats] = useState(spec.seats);
  const clamp = (n: number) => Math.max(MIN_SEATS, Math.min(MAX_SEATS, n));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      // A focused button answers Enter itself; confirming too would cancel and add at once.
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onConfirm(seats);
      if (e.key === 'ArrowUp' || e.key === '+') setSeats((n) => clamp(n + 1));
      if (e.key === 'ArrowDown' || e.key === '-') setSeats((n) => clamp(n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, seats]);

  const stepBtn =
    'flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-ink shadow-[0_2px_8px_rgba(36,65,58,0.06)] transition-colors hover:border-ink disabled:opacity-30 cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-8 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t(spec.label)}
        className="w-full max-w-sm rounded-3xl border border-line bg-card px-6 pb-6 pt-7 text-center shadow-[0_32px_80px_-16px_rgba(24,32,24,0.28)]"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-wash">
          <Icon size={22} className="text-ink" aria-hidden />
        </span>
        <h2 className="mt-4 font-serif text-[1.6rem] leading-tight text-ink">{t(spec.label)}</h2>
        <p className="mt-1 text-[0.85rem] text-muted">{t('Hvor mange pladser skal bordet have?')}</p>

        <div className="mt-6 flex items-center justify-center gap-6 rounded-2xl bg-shell px-4 py-5">
          <button type="button" onClick={() => setSeats((n) => clamp(n - 1))} disabled={seats <= MIN_SEATS}
            aria-label={t('Færre pladser')} className={stepBtn}>
            <Minus size={18} />
          </button>
          <div className="w-20">
            <p className="font-serif text-[3rem] leading-none text-ink tabular-nums" aria-live="polite">{seats}</p>
            <p className="mt-1 text-[0.78rem] text-muted">{t('pladser')}</p>
          </div>
          <button type="button" onClick={() => setSeats((n) => clamp(n + 1))} disabled={seats >= MAX_SEATS}
            aria-label={t('Flere pladser')} className={stepBtn}>
            <Plus size={18} />
          </button>
        </div>
        <p className="mt-2 text-[0.72rem] text-muted">{t(spec.hint)}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-full border border-line px-4 py-2.5 text-[0.85rem] font-medium text-ink transition-colors hover:border-ink cursor-pointer">
            {t('Annuller')}
          </button>
          <button type="button" onClick={() => onConfirm(seats)}
            className="rounded-full bg-ink px-4 py-2.5 text-[0.85rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer">
            {t('Læg bordet ud')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
