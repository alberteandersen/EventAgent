import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListChecks, CheckSquare, PartyPopper } from 'lucide-react';
import { useWedding } from '../useWedding';
import { showNotice } from '../notice';
import { cn } from '../ui';
import type { ScreenId } from '../Shell';
import { useLang } from '../i18n';
import { GuideLink } from './guides/GuideLink';
import TimelineTab, { defaultMilestones } from './planning/TimelineTab';
import ChecklistTab from './planning/ChecklistTab';
import DayProgramTab from './planning/DayProgramTab';
import { isMilestone, readPlanTab, todayISO, writePlanTab, type PlanTab } from './planning/shared';

const AVA_CELEBRATION = 'Godt klaret. Ava har opdateret jeres fremdrift.';

const TABS: { id: PlanTab; label: string; Icon: typeof ListChecks }[] = [
  { id: 'tidslinje', label: 'Tidslinje', Icon: ListChecks },
  { id: 'tjekliste', label: 'Tjekliste', Icon: CheckSquare },
  { id: 'bryllupsdagen', label: 'Bryllupsdagen', Icon: PartyPopper },
];

/* Two lenses on the same `timeline_tasks` table, and the day itself:
     Tidslinje,     the big date-anchored milestones, plus any checklist item
                    the couple has dated
     Tjekliste,     the many small to-dos grouped by area, each area headed by
                    its milestone
     Bryllupsdagen, the programme for the day, minute by minute
   The overview of the whole wedding is Hjem's; this screen is the plan.
   See 0020_task_kind.sql for why `kind` (not `category`) separates them. */
export default function Planning({ onNavigate }: { onNavigate?: (s: ScreenId) => void }) {
  const { t } = useLang();
  const { loading, couple, timelineTasks, seedTasks } = useWedding();
  const [tab, setTab] = useState<PlanTab>(() => readPlanTab());
  const seededMilestonesRef = useRef(false);

  const milestones = timelineTasks.filter(isMilestone);
  const today = todayISO();
  const anyLate = milestones.some((r) => !r.done && r.category !== 'wedding_day' && r.due_date != null && r.due_date < today);

  // Only the timeline seeds from here, and only once there is a date: every
  // milestone is placed relative to the wedding day. The checklist is dateless
  // and seeds itself (useChecklistSeed) when its tab is opened.
  useEffect(() => {
    if (loading || !couple.dateISO) return;
    if (!seededMilestonesRef.current && milestones.length === 0) {
      seededMilestonesRef.current = true;
      void seedTasks(defaultMilestones(couple.dateISO));
    }
  }, [loading, couple.dateISO, milestones.length, seedTasks]);

  function selectTab(next: PlanTab) {
    setTab(next);
    writePlanTab(next);
  }

  // Through the shared toaster, so it stacks with a Fortryd toast instead of
  // landing on it, and clears the phone's bottom bar.
  function celebrate(title: string) {
    showNotice(t(title), t(AVA_CELEBRATION));
  }

  return (
    <div className="flex min-h-full flex-col gap-6 bg-canvas px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      {/* Header: the page's name and its guide. */}
      <div>
        <h1 className="font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          {t('Tidslinje & tjekliste')}
        </h1>
        <GuideLink screen="planning" />
      </div>

      {/* Tab bar. Scrolls sideways on a narrow phone rather than wrapping. */}
      <nav aria-label={t('Planlægning')}
        className="-mx-6 flex gap-1 overflow-x-auto border-b border-line px-6 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => selectTab(id)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[0.85rem] font-semibold transition-colors cursor-pointer',
                active ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Icon size={15} strokeWidth={2} className="hidden sm:block" aria-hidden />
              {t(label)}
              {id === 'tidslinje' && anyLate && (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-terracotta" />
                  <span className="sr-only">{t('Noget er forsinket')}</span>
                </>
              )}
              {active && (
                <motion.span layoutId="planning-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink" />
              )}
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        {tab === 'tidslinje' ? (
          <TimelineTab key="tidslinje" onCelebrate={celebrate} onNavigate={onNavigate} />
        ) : tab === 'tjekliste' ? (
          <ChecklistTab key="tjekliste" onCelebrate={celebrate} onNavigate={onNavigate} />
        ) : (
          <DayProgramTab key="bryllupsdagen" />
        )}
      </AnimatePresence>
    </div>
  );
}
