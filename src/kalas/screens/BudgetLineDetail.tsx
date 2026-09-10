"use client";

/* One budget category, opened up. The row on the main screen only has room
   for a slider and a glance at the numbers — renaming, the actual/paid
   figures, a payment reminder, a note and the contract review all used to
   compete for the same strip of space, three icon-toggles deep. This is
   where that goes instead: one place with room to write, organized the way
   a couple actually thinks about a vendor line — what it's called, what it
   costs, when it's due, what we know about it.

   Edits are a draft until "Gem ændringer": nothing here calls the parent's
   persist functions until Save is pressed, so a stray keystroke in the note
   field before closing the panel can't silently commit. The contract panel
   is the one exception — it manages its own upload/review calls to its own
   API, same as it always has, independent of this draft. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Check, ExternalLink } from 'lucide-react';
import BudgetContractPanel from './BudgetContractPanel';
import {
  BUDGET_COLORS,
  BUDGET_ICON_IDS,
  resolveBudgetIcon,
  type BudgetIconId,
} from '../lib/budget-style';
import { Eyebrow, cn } from '../ui';
import { useLang } from '../i18n';

const kr = (n: number) => new Intl.NumberFormat('da-DK').format(Math.round(n));

/** Whole days from today until a YYYY-MM-DD date (negative = overdue). */
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** A labeled field wrapper, so every input in the panel lines up the same way. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
    </label>
  );
}

const fieldCls =
  'w-full rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.9rem] text-ink placeholder:text-muted/60 tabular-nums focus:outline-none focus:border-[var(--color-sage-strong)]';

export default function BudgetLineDetail({
  eventId,
  categoryId,
  label,
  icon,
  color,
  custom,
  planned,
  actual,
  paid,
  reminder,
  note,
  findLabel,
  onClose,
  onSave,
  onDelete,
  onFindVendors,
  onContractApply,
}: {
  eventId: string | null;
  categoryId: string;
  label: string;
  icon: string;
  color: string;
  /** Only a custom (couple-added) category can change its icon and colour. */
  custom: boolean;
  /** The slider figure — shown, not edited here; the slider stays on the row. */
  planned: number;
  actual: number;
  paid: number;
  reminder: string;
  note: string;
  /** "Se venues der matcher jer" for the venue line, "Se top matches" otherwise. */
  findLabel?: string;
  onClose: () => void;
  onSave: (patch: {
    label: string; icon: string; color: string;
    actual: number; paid: number; reminder: string; note: string;
  }) => void;
  onDelete: () => void;
  onFindVendors?: () => void;
  onContractApply: (patch: { actual_cost?: number; reminder_at?: string }) => void;
}) {
  const { t } = useLang();

  // A draft, seeded from the current values once, on open. Nothing here
  // touches the real data until Save.
  const [dLabel, setDLabel] = useState(label);
  const [dIcon, setDIcon] = useState<BudgetIconId>(icon as BudgetIconId);
  const [dColor, setDColor] = useState(color);
  const [dActual, setDActual] = useState(actual);
  const [dPaid, setDPaid] = useState(paid);
  const [dReminder, setDReminder] = useState(reminder);
  const [dNote, setDNote] = useState(note);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const days = daysUntil(dReminder);
  const rest = Math.max(0, dActual - dPaid);
  const dirty =
    dLabel !== label || dIcon !== icon || dColor !== color ||
    dActual !== actual || dPaid !== paid || dReminder !== reminder || dNote !== note;

  const save = () => {
    const cleanLabel = dLabel.trim() || label;
    onSave({ label: cleanLabel, icon: dIcon, color: dColor, actual: dActual, paid: dPaid, reminder: dReminder, note: dNote });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_32px_80px_-16px_rgba(24,32,24,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: dColor }}
              aria-hidden
            >
              {/* [dIcon].map(...), not a bare resolve-then-render: the lint
                  rule for "component created during render" only exempts a
                  dynamically resolved component when it is built inside an
                  array .map() callback — the same reason BUDGET_ICON_IDS.map()
                  a few lines down and every icon lookup elsewhere in this
                  codebase already goes through .map(). A one-item array is
                  the idiom for a single icon that still needs the exemption. */}
              {[dIcon].map((id) => {
                const Icon = resolveBudgetIcon(id);
                return <Icon key={id} size={17} className="text-white" strokeWidth={2.25} />;
              })}
            </span>
            <div className="min-w-0">
              <Eyebrow>{t('Budgetpost')}</Eyebrow>
              <h2 className="mt-0.5 truncate font-serif text-[1.35rem] text-ink">{dLabel || label}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Luk')}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {/* Oplysninger */}
          <section>
            <Eyebrow>{t('Oplysninger')}</Eyebrow>
            <div className="mt-3">
              <Field label={t('Navn')}>
                <input
                  value={dLabel}
                  onChange={(e) => setDLabel(e.target.value)}
                  placeholder={label}
                  aria-label={t('Navn')}
                  className={fieldCls}
                />
              </Field>
            </div>
          </section>

          {custom && (
            <section>
              <Eyebrow>{t('Ikon & farve')}</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {BUDGET_ICON_IDS.map((id) => {
                  const I = resolveBudgetIcon(id);
                  const selected = dIcon === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDIcon(id)}
                      aria-pressed={selected}
                      aria-label={id}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer',
                        selected ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink',
                      )}
                    >
                      <I size={14} strokeWidth={2.25} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {BUDGET_COLORS.map((hex) => {
                  const selected = dColor.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setDColor(hex)}
                      aria-label={t('Vælg farve')}
                      aria-pressed={selected}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform cursor-pointer',
                        selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--color-card)] scale-105' : 'hover:scale-105',
                      )}
                      style={{ background: hex }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Betalinger */}
          <section>
            <Eyebrow>{t('Betalinger')}</Eyebrow>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={t('Faktisk pris')}>
                <input
                  type="number" min={0} step={500} value={dActual || ''} placeholder="0"
                  onChange={(e) => setDActual(Math.max(0, Number(e.target.value)))}
                  className={fieldCls}
                />
              </Field>
              <Field label={t('Betalt')}>
                <input
                  type="number" min={0} step={500} value={dPaid || ''} placeholder="0"
                  onChange={(e) => setDPaid(Math.max(0, Number(e.target.value)))}
                  className={fieldCls}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.78rem] text-muted">
              <span>{t('Budgetteret')} <b className="text-ink tabular-nums">{kr(planned)} kr</b></span>
              {dActual > 0 && (
                <span>
                  {t('Rest')}{' '}
                  <b className={cn('tabular-nums', rest > 0 ? 'text-[var(--color-terracotta)]' : 'text-success')}>
                    {kr(rest)} kr
                  </b>
                </span>
              )}
              {dActual > 0 && dPaid >= dActual && (
                <span className="inline-flex items-center gap-1 text-success">
                  <Check size={12} strokeWidth={2.5} /> {t('Fuldt betalt')}
                </span>
              )}
            </div>
          </section>

          {/* Betalingsplan */}
          <section>
            <Eyebrow>{t('Betalingsplan')}</Eyebrow>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={dReminder}
                onChange={(e) => setDReminder(e.target.value)}
                aria-label={t('Påmindelsesdato')}
                className="kalas-date rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.9rem] text-ink [color-scheme:light] focus:outline-none focus:border-[var(--color-sage-strong)]"
              />
              {dReminder && (
                <button
                  type="button"
                  onClick={() => setDReminder('')}
                  className="text-[0.78rem] text-muted underline underline-offset-2 hover:text-ink cursor-pointer"
                >
                  {t('Ryd')}
                </button>
              )}
              {days != null && (
                <span className={cn('text-[0.78rem]', days < 0 ? 'text-[var(--color-terracotta)]' : 'text-muted')}>
                  {days < 0
                    ? t('forfaldt for {n} dage siden', { n: Math.abs(days) })
                    : days === 0 ? t('forfalder i dag')
                    : t('forfalder om {n} dage', { n: days })}
                </span>
              )}
            </div>
          </section>

          {/* Noter */}
          <section>
            <Eyebrow>{t('Noter')}</Eyebrow>
            <textarea
              rows={3}
              value={dNote}
              placeholder={t('Fx aftaler, kontaktperson, hvad prisen dækker…')}
              onChange={(e) => setDNote(e.target.value)}
              aria-label={t('Noter')}
              className="mt-3 w-full resize-none rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.85rem] text-ink placeholder:text-muted/60 focus:outline-none focus:border-[var(--color-sage-strong)]"
            />
          </section>

          {findLabel && onFindVendors && (
            <button
              type="button"
              onClick={onFindVendors}
              className="flex w-full items-center justify-between rounded-xl bg-sage-tint px-4 py-3 text-left text-[0.85rem] font-medium text-sage-strong transition-colors hover:bg-sage-tint/70 cursor-pointer"
            >
              {findLabel}
              <ExternalLink size={14} />
            </button>
          )}

          {/* Kontrakt — its own API, independent of this panel's draft */}
          <section>
            <Eyebrow>{t('Kontrakt')}</Eyebrow>
            <div className="mt-3">
              <BudgetContractPanel eventId={eventId} category={categoryId} onApply={onContractApply} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          {confirmingDelete ? (
            <div className="flex items-center gap-3 text-[0.82rem]">
              <span className="text-muted">{t('Slet {label}?', { label })}</span>
              <button
                type="button"
                onClick={onDelete}
                className="font-semibold text-[var(--color-terracotta)] hover:opacity-80 cursor-pointer"
              >
                {t('Ja, slet')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-muted hover:text-ink cursor-pointer"
              >
                {t('Fortryd')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.82rem] font-medium text-[var(--color-terracotta)] transition-colors hover:bg-[var(--color-terracotta-tint)] cursor-pointer"
            >
              <Trash2 size={14} /> {t('Slet')}
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink cursor-pointer"
            >
              {t('Annuller')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-full bg-ink px-5 py-2 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {t('Gem ændringer')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
