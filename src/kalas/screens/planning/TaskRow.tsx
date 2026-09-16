import * as React from 'react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, MoreHorizontal, CalendarDays, CornerDownRight, Pencil, CalendarOff, Flag, StickyNote } from 'lucide-react';
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
};

/** One completable row, shared by both tabs. The menu entries differ:
 *  the checklist is append-only (int `sort`, no fractional insert), so it
 *  passes no `onInsertAfter`. A checklist row visiting the timeline passes
 *  `onClearDate` instead of `onDelete` — taking it off the timeline must not
 *  delete it off the checklist. `onOpen` opens the task in TaskDialog, from
 *  the title and from the menu. */
export default function TaskRow({
  task, deleteLabel, menuOpen, onMenu, onCloseMenu, onToggle, onDelete, onInsertAfter, onOpen, onClearDate, onDateChange,
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
}) {
  const { t } = useLang();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const status = statusOf(task);
  const done = status === 'done';
  const overdue = status === 'overdue';
  const diff = task.dateISO ? daysDiff(task.dateISO) : null;
  const isSoon = status === 'planned' && diff !== null && diff > 0 && diff <= 14;
  const isToday = status === 'planned' && diff === 0;

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-3 rounded-[18px] border px-5 py-4 sm:gap-4',
        taskRowTone(done ? 'done' : overdue ? 'overdue' : 'default'),
      )}
    >
      <TaskCheckbox done={task.done} label={task.title} onToggle={onToggle} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('flex flex-wrap items-center gap-2 text-base font-semibold', done ? doneLabelClass : 'text-[#24413a]')}>
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
          <input
            ref={dateInputRef}
            type="date"
            value={task.dateISO ?? ''}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            tabIndex={-1}
          />
        </button>
      </div>

      {task.assigneeInitials && (
        <span
          title={task.assigneeName ?? undefined}
          aria-label={task.assigneeName ? t('Tildelt {name}', { name: task.assigneeName }) : undefined}
          className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e8f0ec] px-1.5 text-[0.62rem] font-bold tracking-[0.04em] text-[#5f7d70]"
        >
          {task.assigneeInitials}
        </span>
      )}

      <span
        className={cn(
          'text-xs font-bold uppercase tracking-[0.12em]',
          done ? 'text-[#5f7d70]'
            : overdue ? 'text-[#b34e37]'
            : status === 'wedding' ? 'text-[#24413a]'
            : isSoon || isToday ? 'text-[#8a7d5c]'
            : 'text-[#9a9686]',
        )}
      >
        {statusLabel(task, t)}
      </span>

      <div className="relative">
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
