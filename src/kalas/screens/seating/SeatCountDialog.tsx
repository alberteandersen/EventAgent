"use client";

/* How many chairs, asked when the table is put down. A new table used to
   arrive with a fixed eight or twelve, and the couple then had to find the
   stepper to fix it, when they usually know the number before they click.
   The default is still offered, and the count can change afterwards. */

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLang } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { MAX_SEATS, MIN_SEATS, SHAPES, type TableShape } from './model';

export default function SeatCountDialog({ shape, onConfirm, onCancel }: {
  shape: TableShape;
  onConfirm: (seats: number) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const spec = SHAPES.find((s) => s.id === shape)!;
  const [seats, setSeats] = useState(spec.seats);
  const clamp = (n: number) => Math.max(MIN_SEATS, Math.min(MAX_SEATS, n));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A focused button answers Enter itself; confirming too would cancel and add at once.
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onConfirm(seats);
      if (e.key === 'ArrowUp' || e.key === '+') setSeats((n) => clamp(n + 1));
      if (e.key === 'ArrowDown' || e.key === '-') setSeats((n) => clamp(n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, seats]);

  const stepBtn =
    'flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-ink shadow-[0_2px_8px_rgba(36,65,58,0.06)] transition-colors hover:border-ink disabled:opacity-30 cursor-pointer';

  return (
    <Dialog
      open
      onClose={onCancel}
      size="sm"
      title={t(spec.label)}
      description={t('Hvor mange pladser skal bordet have?')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{t('Annuller')}</Button>
          <Button onClick={() => onConfirm(seats)}>{t('Læg bordet ud')}</Button>
        </>
      }
    >
      <div className="flex items-center justify-center gap-6 rounded-2xl bg-shell px-4 py-5 text-center">
        <button type="button" onClick={() => setSeats((n) => clamp(n - 1))} disabled={seats <= MIN_SEATS}
          aria-label={t('Færre pladser')} className={stepBtn}>
          <Minus size={18} />
        </button>
        <div className="w-20">
          <p className="font-serif text-[3rem] leading-none text-ink tabular-nums" aria-live="polite">{seats}</p>
          <p className="mt-1 text-xs text-muted">{t('pladser')}</p>
        </div>
        <button type="button" onClick={() => setSeats((n) => clamp(n + 1))} disabled={seats >= MAX_SEATS}
          aria-label={t('Flere pladser')} className={stepBtn}>
          <Plus size={18} />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">{t(spec.hint)}</p>
    </Dialog>
  );
}
