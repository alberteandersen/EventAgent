import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListChecks, CheckSquare, PartyPopper } from 'lucide-react';
import { useWedding } from '../useWedding';
import { cn } from '../ui';
import type { ScreenId } from '../Shell';
import { useLang } from '../i18n';
import TimelineTab, { defaultMilestones } from './planning/TimelineTab';
import ChecklistTab from './planning/ChecklistTab';
import DayProgramTab from './planning/DayProgramTab';
import { isMilestone, isCheck, readPlanTab, writePlanTab, type PlanTab } from './planning/shared';

const AVA_CELEBRATION = 'Godt klaret. Ava har opdateret jeres fremdrift.';

/* Two lenses on the same `timeline_tasks` table:
     Tidslinje, the big date-anchored milestones, plus any checklist item the
                 couple has dated
     Tjekliste, the many small to-dos grouped by area, each area headed by its
                 milestone
   See 0020_task_kind.sql for why `kind` (not `category`) separates them. */
export default function Planning({ onNavigate }: { onNavigate?: (s: ScreenId) => void }) {
  const { t } = useLang();
  const { loading, couple, timelineTasks, seedTasks } = useWedding();
  const [tab, setTab] = useState<PlanTab>(() => readPlanTab());
  const [celebration, setCelebration] = useState<{ title: string; msg: string } | null>(null);
  const seededMilestonesRef = useRef(false);

  const milestones = timelineTasks.filter(isMilestone);
  const checks = timelineTasks.filter(isCheck);

  // Only the timeline seeds from here, and only once there is a date: every
  // milestone is placed relative to the wedding day. The checklist is dateless,
  // so it seeds itself from ChecklistTab when the tab is opened — gating it on
  // a date the couple has not set yet is what left the list empty.
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

  function celebrate(title: string) {
    setCelebration({ title, msg: t(AVA_CELEBRATION) });
    setTimeout(() => setCelebration(null), 3200);
  }

  const TABS: { id: PlanTab; label: string; Icon: typeof ListChecks; open: number }[] = [
    { id: 'tidslinje', label: 'Tidslinje', Icon: ListChecks, open: milestones.filter((r) => !r.done).length },
    { id: 'tjekliste', label: 'Tjekliste', Icon: CheckSquare, open: checks.filter((r) => !r.done).length },
    { id: 'bryllupsdagen', label: 'Bryllupsdagen', Icon: PartyPopper, open: 0 },
  ];

  return (
    <div className="flex min-h-full flex-col gap-6 bg-[#f4f5f3] px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Planlægning')}</p>
        <h1 className="mt-1 font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-[#24413a]">
          {t('Tidslinje & tjekliste')}
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#5f6b66]">
          {t('De store milepæle og alle småtingene, hold jer på sporet, ét skridt ad gangen.')}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#e2e6e2]">
        {TABS.map(({ id, label, Icon, open }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2.5 text-[0.82rem] font-semibold transition-colors cursor-pointer',
                active ? 'text-[#24413a]' : 'text-muted hover:text-ink',
              )}
            >
              <Icon size={15} strokeWidth={2} />
              {t(label)}
              {open > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8f0ec] px-1 text-[0.6rem] font-bold text-[#24413a]">
                  {open}
                </span>
              )}
              {active && (
                <motion.span layoutId="planning-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#24413a]" />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'tidslinje' ? (
          <TimelineTab key="tidslinje" onCelebrate={celebrate} />
        ) : tab === 'tjekliste' ? (
          <ChecklistTab key="tjekliste" onCelebrate={celebrate} onNavigate={onNavigate} />
        ) : (
          <DayProgramTab key="bryllupsdagen" />
        )}
      </AnimatePresence>

      {/* celebration toast */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="status" aria-live="polite"
            className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 w-[min(92vw,420px)]"
          >
            <div className="rounded-[18px] border border-[#dcdfdb] bg-[#ffffff] px-6 py-5 shadow-[0_20px_60px_-10px_rgba(36,65,58,0.18)]">
              <p className="font-serif text-lg text-[#24413a]">{t(celebration.title)}</p>
              <p className="mt-1.5 text-sm text-[#5f6b66]">{celebration.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
