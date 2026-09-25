import * as React from 'react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, MoreHorizontal, CalendarDays, CalendarPlus, CornerDownRight, Pencil, CalendarOff, Flag, StickyNote, ArrowRight, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, TaskCheckbox, taskRowTone, doneLabelClass } from '../../ui';
import { useLang } from '../../i18n';
import { formatDate, statusOf, statusLabel, daysDiff } from './shared';

export type DisplayTask = {
  id: string;
  title: string;
  /** Null for check items, and for milestones Ava added without a date. */
  dateISO: string | null;
  done: boolean;
  weddingDay: boolean;
  /** Leading icon — the area, on the timeline's visiting checklist rows. */
  Icon?: LucideIcon;
  /** Small label marking a row that lives on the other tab, e.g. "Milepæl". */
  tag?: string;
  /** Only 'high' is drawn: a flag on every row would mean nothing. */
  priority?: 'low' | 'medium' | 'high' | null;
  /** Who has it, as the chip's letters and as its full label. */
  assigneeInitials?: string | null;
  assigneeName?: string | null;
  hasNotes?: boolean;
  /** When a default checklist item is best done, as a Danish label for t(). */
  phase?: string | null;
  /** That phase is now, or already behind them. */
  phaseDue?: boolean;
  /** A checklist item: no date is its normal state, so the row says nothing
   *  about it, and a date is set from the menu ("Sæt på tidslinjen"). */
  dateOptional?: boolean;
};

/** One completable row, shared by both tabs. The menu entries differ:
 *  the checklist is append-only (int `sort`, no fractional insert), so it
 *  passes no `onInsertAfter`. A checklist row visiting the timeline passes
 *  `onClearDate` instead of `onDelete` — taking it off the timeline must not
 *  delete it off the checklist. `onOpen` opens the task in TaskDialog, from
 *  the title and from the menu. */
export default function TaskRow({
  task, deleteLabel, menuOpen, onMenu, onCloseMenu, onToggle, onDelete, onInsertAfter, onOpen, onClearDate, onDateChange,
  action, suggestion,
}: {
  task: DisplayTask;
  deleteLabel: string;
  menuOpen: boolean;
  onMenu: () => void;
  onCloseMenu: () => void;
  onToggle: () => void;
  onDelete?: () => void;
  onInsertAfter?: () => void;
  onOpen?: () => void;
  onClearDate?: () => void;
  onDateChange: (dateISO: string) => void;
  /** Where the task is carried out, e.g. "Find fotograf" → the vendor hub. */
  action?: { label: string; onClick: () => void };
  /** The rest of the app says this looks done; `reason` is shown with it. */
  suggestion?: { reason: string; onAccept: () => void };
}) {
  const { t } = useLang();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const status = statusOf(task);
  const done = status === 'done';
  const overdue = status === 'overdue';
  const diff = task.dateISO ? daysDiff(task.dateISO) : null;
  const isSoon = status === 'planned' && diff !== null && diff > 0 && diff <= 14;
  const isToday = status === 'planned' && diff === 0;

  const statusTone = done ? 'text-[#5f7d70]'
    : overdue ? 'text-[#b34e37]'
    : status === 'wedding' ? 'text-[#24413a]'
    : isSoon || isToday ? 'text-[#8a7d5c]'
    : 'text-[#9a9686]';
  const statusText = statusLabel(task, t);
  // A checklist item without a date: not "Vælg dato · INGEN DATO" 205 times over.
  const quiet = Boolean(task.dateOptional && !task.dateISO);
  const showStatus = !quiet || done;
  const dateInput = (
    <input
      ref={dateInputRef}
      type="date"
      value={task.dateISO ?? ''}
      onChange={(e) => e.target.value && onDateChange(e.target.value)}
      className={quiet ? 'sr-only' : 'absolute inset-0 w-full cursor-pointer opacity-0'}
      tabIndex={-1}
      aria-hidden={quiet || undefined}
    />
  );
  const assignee = task.assigneeInitials && (
    <span
      title={task.assigneeName ?? undefined}
      aria-label={task.assigneeName ? t('Tildelt {name}', { name: task.assigneeName }) : undefined}
      className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e8f0ec] px-1.5 text-[0.62rem] font-bold tracking-[0.04em] text-[#5f7d70]"
    >
      {task.assigneeInitials}
    </span>
  );

  /* On a phone the title gets the whole width and everything else moves to
     a line under it; side by side, a three-word title wrapped into a column
     two words wide and the status ran across it. From sm up the status and
     the owner sit on the right as before. */
  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-[18px] border px-4 py-3.5 sm:items-center sm:gap-4 sm:px-5 sm:py-4',
        taskRowTone(done ? 'done' : overdue ? 'overdue' : 'default'),
      )}
    >
      <div className="mt-0.5 shrink-0 sm:mt-0">
        <TaskCheckbox done={task.done} label={task.title} onToggle={onToggle} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-0.5">
        <span className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] font-semibold leading-snug sm:text-base', done ? doneLabelClass : 'text-[#24413a]')}>
          {task.Icon && <task.Icon size={14} strokeWidth={2} className="shrink-0 text-[#7d938a]" aria-hidden />}
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-left underline-offset-4 decoration-[#c6cbc6] hover:underline cursor-pointer"
            >
              {t(task.title)}
            </button>
          ) : t(task.title)}
          {task.priority === 'high' && !done && (
            <Flag size={12} strokeWidth={2.5} className="shrink-0 text-[#b34e37]" aria-label={t('Høj prioritet')} />
          )}
          {task.hasNotes && (
            <StickyNote size={12} strokeWidth={2} className="shrink-0 text-[#9a9686]" aria-label={t('Har noter')} />
          )}
          {task.tag && (
            <span className="rounded-full bg-[#e8f0ec] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#5f6b66]">
              {t(task.tag)}
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
          {task.phase && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              task.phaseDue && !done ? 'bg-[#f4ecdc] text-[#746b56]' : 'bg-[#eef1ee] text-[#5f6b66]',
            )}>
              {t(task.phase)}
            </span>
          )}
          {quiet ? dateInput : (
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              aria-label={t("Ændr dato for '{title}'", { title: task.title })}
              className={cn(
                'relative flex w-fit items-center gap-1.5 text-[13px] hover:text-[#24413a] cursor-pointer',
                task.dateISO ? 'text-[#5f6b66]' : 'text-[#9a9686]',
              )}
            >
              <CalendarDays size={12} />
              {task.dateISO ? formatDate(task.dateISO) : t('Vælg dato')}
              {dateInput}
            </button>
          )}
          {showStatus && (
            <span className={cn('text-[0.68rem] font-bold uppercase tracking-[0.12em] sm:hidden', statusTone)}>
              {statusText}
            </span>
          )}
          <span className="sm:hidden">{assignee}</span>
          {!done && suggestion ? (
            <button
              type="button"
              onClick={suggestion.onAccept}
              aria-label={t("Sæt flueben ved '{title}': {reason}", { title: t(task.title), reason: t(suggestion.reason) })}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#dbe5e0] py-1 pl-2.5 pr-3 text-left text-[12px] font-semibold text-[#2f5a48] transition-colors hover:bg-[#cddbd4] cursor-pointer"
            >
              <Check size={12} strokeWidth={2.6} aria-hidden />
              {t(suggestion.reason)} · {t('Sæt flueben')}
            </button>
          ) : !done && action ? (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                'group inline-flex items-center gap-1 text-[13px] font-semibold transition-colors cursor-pointer',
                overdue ? 'text-[#b34e37] hover:text-[#8f3d2b]' : 'text-[#5f6b66] hover:text-[#24413a]',
              )}
            >
              {t(action.label)}
              <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <span className="hidden sm:inline-flex">{assignee}</span>

      {showStatus && (
        <span className={cn('hidden text-xs font-bold uppercase tracking-[0.12em] sm:inline', statusTone)}>
          {statusText}
        </span>
      )}

      <div className="relative -mr-1.5 -mt-1 shrink-0 sm:m-0">
        <button
          type="button"
          onClick={onMenu}
          aria-label={t("Handlinger for '{title}'", { title: task.title })}
          className="flex size-8 items-center justify-center rounded-full text-[#9a9686] transition-colors hover:bg-white/70 hover:text-[#24413a] cursor-pointer"
        >
          <MoreHorizontal size={18} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-9 z-50 w-[168px] overflow-hidden rounded-[14px] border border-[#dcdfdb] bg-[#ffffff] py-1 shadow-[0_16px_40px_-12px_rgba(20,26,19,0.25)]"
              >
                {onInsertAfter && (
                  <button type="button" onClick={onInsertAfter}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#24413a] transition-colors hover:bg-[#eceeeb] cursor-pointer">
                    <CornerDownRight size={14} className="text-[#5f6b66]" /> {t('Indsæt under')}
                  </button>
                )}
                {onOpen && (
                  <button type="button" onClick={() => { onCloseMenu(); onOpen(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#24413a] transition-colors hover:bg-[#eceeeb] cursor-pointer">
                    <Pencil size={14} className="text-[#5f6b66]" /> {t('Rediger')}
                  </button>
                )}
                {quiet && (
                  <button type="button" onClick={() => { onCloseMenu(); dateInputRef.current?.showPicker?.(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#24413a] transition-colors hover:bg-[#eceeeb] cursor-pointer">
                    <CalendarPlus size={14} className="text-[#5f6b66]" /> {t('Sæt på tidslinjen')}
                  </button>
                )}
                {onClearDate && (
                  <button type="button" onClick={onClearDate}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#24413a] transition-colors hover:bg-[#eceeeb] cursor-pointer">
                    <CalendarOff size={14} className="text-[#5f6b66]" /> {t('Fjern dato')}
                  </button>
                )}
                {onDelete && (
                  <button type="button" onClick={onDelete}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#b34e37] transition-colors hover:bg-[#faf4ef] cursor-pointer">
                    <Trash2 size={14} /> {t(deleteLabel)}
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
