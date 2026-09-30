"use client";

/* The controls that live inside a filter pill's menu.
 *
 * Lifted out of the old single drawer so every pill draws the same chip. The
 * tri-state vocabulary (off → ønsket → krav) is explained in filterState.ts —
 * these are only its buttons. */

import { Lock } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueFilters } from '@/lib/venue/filter';
import { cycleTri, triOf, type ChipRule, type TriState } from './filterState';

/** Off → ønsket → krav. The lock is what tells the last two apart at a glance. */
export function TriChip({ filters, onChange, rule, icon, label }: {
  filters: VenueFilters;
  onChange: (f: VenueFilters) => void;
  rule: ChipRule;
  icon: React.ReactNode;
  label: string;
}) {
  const { t } = useLang();
  const state = triOf(filters, rule);
  return (
    <button
      type="button"
      onClick={() => onChange(cycleTri(filters, rule))}
      title={state === 'off' ? t('Tryk: ønsket') : state === 'wanted' ? t('Tryk igen: krav') : t('Tryk igen: fra')}
      className={cn(
        'mb-1.5 mr-1.5 inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[0.78rem] font-semibold transition-colors cursor-pointer',
        state === 'off' && 'border-line bg-card text-muted hover:border-ink hover:text-ink',
        state === 'wanted' && 'border-ink bg-sage-wash text-ink',
        state === 'required' && 'border-ink bg-ink text-paper',
      )}
    >
      {state === 'required' ? <Lock size={12} className="shrink-0" aria-hidden /> : icon}
      {label}
      <span className="sr-only">
        {state === 'off' ? t('fra') : state === 'wanted' ? t('ønsket') : t('krav')}
      </span>
    </button>
  );
}

/** Two-state chip: a plain choice with nothing to promote to a requirement. */
export function Chip({ label, state, onClick }: {
  label: string; state: TriState; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state !== 'off'}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3.5 text-[0.78rem] font-semibold transition-colors cursor-pointer',
        state === 'off'
          ? 'border-line bg-card text-muted hover:border-ink hover:text-ink'
          : 'border-ink bg-sage-wash text-ink',
      )}
    >
      {label}
    </button>
  );
}

/** For rules whose "on" is a slider or a list, where a third chip state has
 *  nothing to attach to. Sits directly under its own control. */
export function RequireSwitch({ label, hint, active, disabled, onClick }: {
  label: string; hint?: string; active: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'mt-3 flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        disabled ? 'cursor-not-allowed border-line opacity-50' : 'cursor-pointer',
        active && !disabled ? 'border-ink bg-sage-wash' : 'border-line bg-paper',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        active ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white',
      )}>
        {active && <Lock size={9} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.78rem] font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.7rem] text-sage">{hint}</span>}
      </span>
    </button>
  );
}

/** The one-line explanation some panels need above their chips. */
export function PanelHint({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[0.74rem] text-sage">{children}</p>;
}
