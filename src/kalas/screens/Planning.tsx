import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { ListChecks, PartyPopper } from 'lucide-react';
import { useWedding } from '../useWedding';
import { showNotice } from '../notice';
import { Page, PageHeader, PageLoader, Tabs } from '../ui';
import type { ScreenId } from '../Shell';
import { useLang } from '../i18n';
import PlanView from './planning/PlanTab';
import { defaultMilestones } from './planning/milestones';
import DayProgramTab from './planning/DayProgramTab';
import { isMilestone, readPlanTab, todayISO, writePlanTab, type PlanTab } from './planning/shared';

const AVA_CELEBRATION = 'Godt klaret. Ava har opdateret jeres fremdrift.';

const TABS: { id: PlanTab; label: string; Icon: typeof ListChecks }[] = [
  { id: 'planen', label: 'Planen', Icon: ListChecks },
  { id: 'bryllupsdagen', label: 'Bryllupsdagen', Icon: PartyPopper },
];

/* The plan and the day:
     Planen,        the milestones and the to-dos of `timeline_tasks` together,
                    one phase at a time (PlanTab)
     Bryllupsdagen, the programme for the day itself
   The overview of the whole wedding is Hjem's; this screen is the plan.
   See 0020_task_kind.sql for why `kind` (not `category`) separates the two
   kinds of row. */
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
  // and seeds itself (useChecklistSeed) when the plan is opened.
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

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader title={t('Planlægning')} guide="planning">
        <Tabs
          label={t('Planlægning')}
          value={tab}
          onChange={selectTab}
          items={TABS.map(({ id, label, Icon }) => ({
            id,
            label: t(label),
            icon: Icon,
            alert: id === 'planen' && anyLate ? t('Noget er forsinket') : undefined,
          }))}
        />
      </PageHeader>

      <AnimatePresence mode="wait">
        {tab === 'planen' ? (
          <PlanView key="planen" onCelebrate={celebrate} onNavigate={onNavigate} onOpenDay={() => selectTab('bryllupsdagen')} />
        ) : (
          <DayProgramTab key="bryllupsdagen" />
        )}
      </AnimatePresence>
    </Page>
  );
}
