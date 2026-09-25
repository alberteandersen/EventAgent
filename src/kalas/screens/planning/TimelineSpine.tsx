import * as React from 'react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import TaskRow, { type DisplayTask } from './TaskRow';
import type { TimelineBand } from './shared';

/** The minimum the spine draws: a task row plus whether its date has already
 *  passed, which the day pill colours on and the row's status logic keeps
 *  private. The component is generic over anything extending this, so a caller
 *  can hang its own fields on a task and still get them back in the callbacks
 *  without a cast. */
export type SpineTask = DisplayTask & { overdue: boolean };

/** What a row's menu offers, which differs by where the row really lives. */
export type RowActions = {
  onDelete?: () => void;
  onInsertAfter?: () => void;
  onClearDate?: () => void;
  onOpen?: () => void;
  action?: { label: string; onClick: () => void };
  suggestion?: { reason: string; onAccept: () => void };
};

/** The "you are here" line, drawn between the rows it falls between. */
function TodayMarker({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-4">
      <span className="relative z-10 flex w-6 shrink-0 justify-center sm:w-8">
        <span className="size-2.5 rounded-full bg-terracotta ring-4 ring-card" />
      </span>
      <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-terracotta">
        {label}
      </span>
      <span className="h-px flex-1 bg-terracotta/25" />
    </div>
  );
}

/**
 * The timeline itself: months running down a single rule, each dated task a
 * node on it, and the lulls between them stated in months rather than closed
 * up — eight quiet months should look like eight quiet months.
 *
 * Presentational on purpose. It takes bands and callbacks and owns no data,
 * which is what keeps TimelineTab about *which* tasks belong here rather than
 * about how they are drawn, and what lets a fixture render it in isolation.
 */
export default function TimelineSpine<T extends SpineTask>({
  bands,
  undated,
  monthLabel,
  menuId,
  onMenu,
  onCloseMenu,
  onToggle,
  onDateChange,
  rowActions,
  renderAddRow,
}: {
  bands: TimelineBand<T>[];
  undated: T[];
  monthLabel: (monthISO: string) => string;
  menuId: string | null;
  onMenu: (id: string) => void;
  onCloseMenu: () => void;
  onToggle: (task: T) => void;
  onDateChange: (id: string, dateISO: string) => void;
  rowActions: (task: T) => RowActions;
  /** The inline "add milestone" form, when it is open under this row. */
  renderAddRow?: (taskId: string) => React.ReactNode;
}) {
  const { t } = useLang();

  const row = (task: T) => (
    <TaskRow
      task={task}
      deleteLabel="Slet milepæl"
      menuOpen={menuId === task.id}
      onMenu={() => onMenu(task.id)}
      onCloseMenu={onCloseMenu}
      onToggle={() => onToggle(task)}
      onDateChange={(d) => onDateChange(task.id, d)}
      {...rowActions(task)}
    />
  );

  return (
    <div className="relative">
      {/* One continuous rule behind every band, so the months read as a single
          stretch of time rather than as separate cards. */}
      {bands.length > 0 && (
        <div aria-hidden className="absolute bottom-3 left-[11.5px] top-3 w-px bg-line sm:left-[15.5px]" />
      )}

      <div className="flex flex-col gap-7">
        {bands.map((band) =>
          // A month or two between milestones is the plan breathing: the line
          // runs on, and no gap is drawn at all.
          band.kind === 'gap' && band.months < 3 ? null
          : band.kind === 'gap' ? (
            <div key={band.key} className="flex items-center gap-2.5 sm:gap-4">
              <span className="flex w-6 shrink-0 justify-center sm:w-8">
                {/* Dashed over the solid rule: time passing, nothing planned.
                    Height grows with the lull, capped so a year-long gap does
                    not push the rest of the plan off the screen. */}
                <span
                  className="w-0 border-l border-dashed border-line-strong"
                  style={{ height: `${Math.min(band.months, 6) * 9 + 18}px` }}
                />
              </span>
              <span className="text-xs italic text-faint">
                {t('{n} måneder uden opgaver', { n: band.months })}
              </span>
            </div>
          ) : (
            <div key={band.key}>
              <div className="flex items-center gap-2.5 sm:gap-4">
                <span className="relative z-10 flex w-6 shrink-0 justify-center sm:w-8">
                  <span className="size-2 rounded-full border border-line-strong bg-card" />
                </span>
                <h3 className="font-serif text-[1.1rem] leading-none text-ink first-letter:uppercase">
                  {monthLabel(band.monthISO)}
                </h3>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {band.todayIndex === 0 && <TodayMarker label={t('I dag')} />}
                {band.items.map((task, i) => (
                  <React.Fragment key={task.id}>
                    <div className="flex items-start gap-2.5 sm:gap-4">
                      {/* The date is on the card; the line only marks where it falls. */}
                      <span aria-hidden className="relative z-10 flex w-6 shrink-0 justify-center pt-[22px] sm:w-8 sm:pt-[26px]">
                        <span
                          className={cn(
                            'rounded-full',
                            task.weddingDay ? 'size-3.5 bg-ink ring-4 ring-card'
                              : task.done ? 'size-2.5 bg-sage-strong'
                              : task.overdue ? 'size-2.5 bg-terracotta'
                              : 'size-2.5 border border-line-strong bg-card',
                          )}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        {row(task)}
                        {renderAddRow?.(task.id)}
                      </div>
                    </div>
                    {band.todayIndex === i + 1 && <TodayMarker label={t('I dag')} />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      {/* An undated task has no place in time, so it waits here rather than
          being pinned to a date nobody chose. */}
      {undated.length > 0 && (
        <div className="mt-7 rounded-[18px] border border-dashed border-line-strong bg-shell/60 p-3 sm:p-5">
          <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted">
            {t('Uden dato')}
          </h3>
          <p className="mt-1 text-xs text-faint">
            {t('Giv dem en dato for at sætte dem på tidslinjen.')}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {undated.map((task) => (
              <React.Fragment key={task.id}>{row(task)}</React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
