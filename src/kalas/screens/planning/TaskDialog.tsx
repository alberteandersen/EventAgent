"use client";

/* One task, opened up: the title, where it belongs, how much it matters,
   which of the couple has it, and the notes that never fit on the row.

   Same contract as GuestDialog and BudgetLineDetail, which it borrows its
   chrome from: everything is a draft until "Gem ændringer", so Escape, the
   backdrop and Annuller all discard cleanly. Only the fields that actually
   changed go to the database. */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, CheckCircle2, Flag, StickyNote, Trash2, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow, SelectPill, Toggle, cn } from '../../ui';
import { useLang } from '../../i18n';
import {
  CHECKLIST_AREAS, PRIORITIES, areaOf, assigneeName, formatDate, hasArea, isCheck, priorityOf,
} from './shared';
import type { TaskAssignee, TaskPriority, TimelineTaskRow } from '@/lib/db/types';

const fieldCls =
  'w-full rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.9rem] text-ink placeholder:text-muted/60 focus:outline-none focus:border-[var(--color-sage-strong)]';

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section>
      <Eyebrow className="flex items-center gap-2">
        <Icon size={13} strokeWidth={2} aria-hidden className="text-sage" />
        {title}
      </Eyebrow>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{children}</span>;
}

export type TaskPatch = Partial<Pick<TimelineTaskRow, 'title' | 'category' | 'done' | 'due_date' | 'priority' | 'assignee' | 'notes'>>;

export default function TaskDialog({
  task,
  couple,
  onClose,
  onSave,
  onDelete,
  deleteLabel = 'Slet punkt',
}: {
  task: TimelineTaskRow;
  couple: { a: string; b: string };
  onClose: () => void;
  /** Receives only what changed; not called when nothing did. */
  onSave: (patch: TaskPatch) => void;
  /** Left out where the row is only visiting, e.g. a checklist item on the
   *  timeline: deleting it there would take it off the checklist too. */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const { t } = useLang();
  const dateRef = useRef<HTMLInputElement>(null);

  // The area picker only makes sense where the category is an area. A
  // milestone without one, or the 'wedding_day' sentinel, keeps its category.
  const showArea = isCheck(task) || hasArea(task);

  const [dTitle, setDTitle] = useState(task.title);
  const [dArea, setDArea] = useState<string>(showArea ? areaOf(task) : (task.category ?? ''));
  const [dDone, setDDone] = useState(task.done);
  const [dDate, setDDate] = useState(task.due_date ?? '');
  const [dPriority, setDPriority] = useState<TaskPriority | null>(priorityOf(task));
  const [dAssignee, setDAssignee] = useState<TaskAssignee | null>(task.assignee ?? null);
  const [dNotes, setDNotes] = useState(task.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = dTitle.trim();
  const save = () => {
    if (!title) return;
    const patch: TaskPatch = {};
    if (title !== task.title) patch.title = title;
    if (showArea && dArea !== areaOf(task)) patch.category = dArea;
    if (dDone !== task.done) patch.done = dDone;
    if ((dDate || null) !== (task.due_date ?? null)) patch.due_date = dDate || null;
    if (dPriority !== priorityOf(task)) patch.priority = dPriority;
    if (dAssignee !== (task.assignee ?? null)) patch.assignee = dAssignee;
    const notes = dNotes.trim() || null;
    if (notes !== (task.notes ?? null)) patch.notes = notes;
    if (Object.keys(patch).length > 0) onSave(patch);
    onClose();
  };

  const assignees: { id: TaskAssignee | null; label: string }[] = [
    { id: null, label: t('Ikke tildelt') },
    { id: 'a', label: t(assigneeName('a', couple) ?? '') },
    { id: 'b', label: t(assigneeName('b', couple) ?? '') },
    { id: 'both', label: t('Begge') },
  ];

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
        role="dialog"
        aria-modal="true"
        aria-label={t('Rediger opgave')}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_32px_80px_-16px_rgba(24,32,24,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <Eyebrow>{t('Opgave')}</Eyebrow>
            <h2 className="mt-0.5 truncate font-serif text-[1.35rem] text-ink">{title || t(task.title)}</h2>
          </div>
          <button
            type="button" onClick={onClose} aria-label={t('Luk')}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <Section icon={CheckCircle2} title={t('Opgaven')}>
            <div className="space-y-3">
              <label className="block">
                <Label>{t('Navn')}</Label>
                <input
                  value={dTitle}
                  onChange={(e) => setDTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                  className={fieldCls}
                />
              </label>
              {showArea && (
                <label className="block">
                  <Label>{t('Område')}</Label>
                  <select value={dArea} onChange={(e) => setDArea(e.target.value)} className={fieldCls}>
                    {CHECKLIST_AREAS.map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
                  </select>
                </label>
              )}
              <div className="flex items-center justify-between rounded-xl bg-shell px-3.5 py-2.5">
                <span className="text-[0.85rem] text-ink">{t('Markér som fuldført')}</span>
                <Toggle value={dDone} onChange={setDDone} />
              </div>
            </div>
          </Section>

          <Section icon={CalendarDays} title={t('Tidsplan')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t('Frist')}</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dateRef.current?.showPicker?.()}
                    className={cn(fieldCls, 'relative flex items-center gap-2 text-left cursor-pointer', !dDate && 'text-muted/80')}
                  >
                    <CalendarDays size={14} className="shrink-0 text-muted" aria-hidden />
                    {dDate ? formatDate(dDate) : t('Vælg dato')}
                    <input
                      ref={dateRef}
                      type="date"
                      value={dDate}
                      onChange={(e) => setDDate(e.target.value)}
                      aria-label={t('Frist')}
                      tabIndex={-1}
                      className="absolute inset-0 w-full cursor-pointer opacity-0"
                    />
                  </button>
                  {dDate && (
                    <button
                      type="button" onClick={() => setDDate('')} aria-label={t('Fjern dato')}
                      className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <Label>{t('Prioritet')}</Label>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {PRIORITIES.map((p) => (
                    <SelectPill
                      key={p.id}
                      active={dPriority === p.id}
                      // A second tap clears it: "no priority" is a real answer.
                      onClick={() => setDPriority(dPriority === p.id ? null : p.id)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {p.id === 'high' && <Flag size={10} strokeWidth={2.5} aria-hidden />}
                        {t(p.label)}
                      </span>
                    </SelectPill>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section icon={UserRound} title={t('Hvem har den')}>
            <div className="flex flex-wrap gap-1.5">
              {assignees.map((a) => (
                <SelectPill key={a.id ?? 'none'} active={dAssignee === a.id} onClick={() => setDAssignee(a.id)}>
                  {a.label}
                </SelectPill>
              ))}
            </div>
          </Section>

          <Section icon={StickyNote} title={t('Noter')}>
            <textarea
              rows={4}
              value={dNotes}
              onChange={(e) => setDNotes(e.target.value)}
              placeholder={t('Detaljer, aftaler, links…')}
              aria-label={t('Noter')}
              className={cn(fieldCls, 'resize-none text-[0.85rem]')}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          {onDelete ? (
            confirmingDelete ? (
              <div className="flex items-center gap-3 text-[0.82rem]">
                <span className="text-muted">{t('Slet opgaven?')}</span>
                <button type="button" onClick={onDelete}
                  className="font-semibold text-[var(--color-terracotta)] hover:opacity-80 cursor-pointer">
                  {t('Ja, slet')}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)}
                  className="text-muted hover:text-ink cursor-pointer">
                  {t('Behold')}
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.82rem] font-medium text-[var(--color-terracotta)] transition-colors hover:bg-[var(--color-terracotta-tint)] cursor-pointer"
              >
                <Trash2 size={14} /> {t(deleteLabel)}
              </button>
            )
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink cursor-pointer"
            >
              {t('Annuller')}
            </button>
            <button
              type="button" onClick={save} disabled={!title}
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
