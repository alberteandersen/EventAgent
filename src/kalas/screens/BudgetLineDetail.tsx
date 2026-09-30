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
   and the sub-items list are the exceptions — each manages its own rows with
   its own ids, independent of this draft, same as it always has for the
   contract panel. */

import { useState } from 'react';
import { X, Trash2, Check, ExternalLink, Plus } from 'lucide-react';
import BudgetContractPanel from './BudgetContractPanel';
import {
  BUDGET_COLORS,
  BUDGET_ICON_IDS,
  resolveBudgetIcon,
  type BudgetIconId,
} from '../lib/budget-style';
import { Button, Dialog, Eyebrow, cn } from '../ui';
import { useLang } from '../i18n';
import { subItemSuggestions } from './budget/estimate';
import type { BudgetSubItemRow } from '@/lib/db/types';

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
// Same look, no baked-in `w-full` — for a field that shares a flex row with
// others, since `w-full` fights `flex-1`/a fixed width utility for which one
// wins, and which one wins isn't reliable.
const rowFieldCls =
  'min-w-0 rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.9rem] text-ink placeholder:text-muted/60 tabular-nums focus:outline-none focus:border-[var(--color-sage-strong)]';

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
  subItems,
  onClose,
  onSave,
  onDelete,
  onFindVendors,
  onContractApply,
  onAddSubItem,
  onUpdateSubItem,
  onDeleteSubItem,
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
  /** Already filtered to this category, from Budget.tsx. */
  subItems: BudgetSubItemRow[];
  onClose: () => void;
  onSave: (patch: {
    label: string; icon: string; color: string;
    actual: number; paid: number; reminder: string; note: string;
  }) => void;
  onDelete: () => void;
  onFindVendors?: () => void;
  onContractApply: (patch: { actual_cost?: number; reminder_at?: string }) => void;
  onAddSubItem: (item: { label: string; vendor?: string | null; amount: number }) => void;
  onUpdateSubItem: (id: string, patch: { label?: string; vendor?: string | null; amount?: number }) => void;
  onDeleteSubItem: (id: string) => void;
}) {
  const { t, tn } = useLang();

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
  const [newSubLabel, setNewSubLabel] = useState('');
  const [newSubVendor, setNewSubVendor] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');

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

  const subTotal = subItems.reduce((a, s) => a + s.amount, 0);
  const suggestions = subItemSuggestions(categoryId, subItems);
  const addSubItem = () => {
    const cleanLabel = newSubLabel.trim();
    if (!cleanLabel) return;
    onAddSubItem({ label: cleanLabel, vendor: newSubVendor.trim() || null, amount: Math.max(0, Number(newSubAmount) || 0) });
    setNewSubLabel('');
    setNewSubVendor('');
    setNewSubAmount('');
  };

  const footer = (
    <>
      {confirmingDelete ? (
        <div className="mr-auto flex items-center gap-3 text-meta">
          <span className="text-muted">{t('Slet {label}?', { label })}</span>
          <button type="button" onClick={onDelete} className="cursor-pointer font-semibold text-terracotta hover:opacity-80">
            {t('Ja, slet')}
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} className="cursor-pointer text-muted hover:text-ink">
            {t('Behold')}
          </button>
        </div>
      ) : (
        <Button variant="ghost" icon={Trash2} onClick={() => setConfirmingDelete(true)}
          className="mr-auto text-terracotta hover:bg-terracotta-tint hover:text-terracotta">
          {t('Slet')}
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>{t('Annuller')}</Button>
      <Button onClick={save} disabled={!dirty}>{t('Gem ændringer')}</Button>
    </>
  );

  // The category's own icon and colour, which the couple can change below.
  const title = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: dColor }} aria-hidden>
        {/* [dIcon].map(...): the lint rule for "component created during render"
            only exempts a dynamically resolved component inside a .map(). */}
        {[dIcon].map((id) => {
          const Icon = resolveBudgetIcon(id);
          return <Icon key={id} size={15} className="text-white" strokeWidth={2.25} />;
        })}
      </span>
      <span className="truncate">{dLabel || label}</span>
    </span>
  );

  return (
    <Dialog open onClose={onClose} eyebrow={t('Budgetpost')} title={title} footer={footer}>
        <div className="space-y-7">
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
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} step={500} value={dActual || ''} placeholder="0"
                    onChange={(e) => setDActual(Math.max(0, Number(e.target.value)))}
                    className={fieldCls}
                  />
                  {subItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDActual(subTotal)}
                      title={t('Sæt Faktisk pris til summen af underposterne')}
                      className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-2 text-[0.72rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
                    >
                      {t('Brug summen')}
                    </button>
                  )}
                </div>
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
            {/* Not an error state — the two numbers are allowed to genuinely
                differ (a rebate, a deposit not yet in the sub-items, a rough
                guess before every vendor is confirmed). Just surface both. */}
            {subTotal > 0 && dActual !== subTotal && (
              <p className="mt-2 text-[0.76rem] text-muted">
                {t('Underposterne summer til {sum} kr — Faktisk pris er {actual} kr.', { sum: kr(subTotal), actual: kr(dActual) })}
              </p>
            )}
          </section>

          {/* Underposter — several vendors under one category: a tent from
              one place, chairs and tables from another. Fires immediately,
              same exception as the contract panel below: each row is its own
              id, so there's nothing to reconcile on Save, and an immediate
              write means Annuller can't undo an already-saved sub-item. */}
          <section>
            <Eyebrow>{t('Underposter')}</Eyebrow>
            {/* The posts this kind of line is usually split into. A tap adds
                one at 0 kr, and the price goes in when the quote does. */}
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onAddSubItem({ label, vendor: null, amount: 0 })}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[0.75rem] font-medium text-muted transition-colors hover:border-ink hover:text-ink cursor-pointer"
                  >
                    <Plus size={11} strokeWidth={2.5} /> {t(label)}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {subItems.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    defaultValue={s.label}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== s.label) onUpdateSubItem(s.id, { label: v });
                      else e.target.value = s.label;
                    }}
                    aria-label={t('Navn på underpost')}
                    className={cn(rowFieldCls, 'flex-1')}
                  />
                  <input
                    defaultValue={s.vendor ?? ''}
                    placeholder={t('Leverandør')}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (s.vendor ?? '')) onUpdateSubItem(s.id, { vendor: v || null });
                    }}
                    aria-label={t('Leverandør')}
                    className={cn(rowFieldCls, 'w-32 shrink-0')}
                  />
                  <input
                    type="number" min={0} step={100}
                    defaultValue={s.amount || ''}
                    placeholder="0"
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value));
                      if (v !== s.amount) onUpdateSubItem(s.id, { amount: v });
                    }}
                    aria-label={t('Beløb')}
                    className={cn(rowFieldCls, 'w-24 shrink-0 tabular-nums')}
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteSubItem(s.id)}
                    aria-label={t('Slet {label}', { label: s.label })}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-[var(--color-terracotta)] cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  value={newSubLabel}
                  onChange={(e) => setNewSubLabel(e.target.value)}
                  placeholder={t('Fx telt, stole, borde…')}
                  aria-label={t('Navn på ny underpost')}
                  className={cn(rowFieldCls, 'flex-1')}
                />
                <input
                  value={newSubVendor}
                  onChange={(e) => setNewSubVendor(e.target.value)}
                  placeholder={t('Leverandør')}
                  aria-label={t('Leverandør')}
                  className={cn(rowFieldCls, 'w-32 shrink-0')}
                />
                <input
                  type="number" min={0} step={100}
                  value={newSubAmount}
                  onChange={(e) => setNewSubAmount(e.target.value)}
                  placeholder="0"
                  aria-label={t('Beløb')}
                  className={cn(rowFieldCls, 'w-24 shrink-0 tabular-nums')}
                />
                <button
                  type="button"
                  onClick={addSubItem}
                  disabled={!newSubLabel.trim()}
                  aria-label={t('Tilføj underpost')}
                  className="shrink-0 rounded-full bg-ink p-1.5 text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {subItems.length > 0 && (
              <p className="mt-3 text-[0.78rem] text-muted">
                {t('Sum af underposter')} <b className="text-ink tabular-nums">{kr(subTotal)} kr</b>
              </p>
            )}
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
                    ? tn(Math.abs(days), 'forfaldt i går', 'forfaldt for {n} dage siden')
                    : days === 0 ? t('forfalder i dag')
                    : tn(days, 'forfalder i morgen', 'forfalder om {n} dage')}
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
    </Dialog>
  );
}
