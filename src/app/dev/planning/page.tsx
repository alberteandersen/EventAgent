"use client";

/* The real Tidslinje & tjekliste screen against a fixture wedding. The
   milestones are laid out from the couple's date and the checklist seeds
   itself on the tab, both in memory.
     ?tab=tjekliste|bryllupsdagen  open on that tab
     ?moved=1                     the couple has moved the wedding since the plan was laid out
     ?nodate=1                    no wedding date yet
     ?venue=1                     a venue is chosen, so "Book venue" looks done */

import { Suspense, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import { defaultMilestones } from '@/kalas/screens/planning/TimelineTab';
import { FixtureWedding, task } from '../_fixture/wedding';

// Client-only, like the app itself (KalasRoot mounts with ssr:false): the tab
// comes from sessionStorage, which the server cannot see.
const Planning = dynamic(() => import('@/kalas/screens/Planning'), { ssr: false });

const PLANNED_FOR = '2027-09-11';

function Harness() {
  const params = useSearchParams();
  const moved = params.get('moved') === '1';
  const noDate = params.get('nodate') === '1';
  const venue = params.get('venue') === '1';
  const [navigated, setNavigated] = useState<string | null>(null);
  // Stable, so the fixture's value (and every effect keyed on it) settles.
  const couple = useMemo(() => ({ dateISO: noDate ? null : moved ? '2027-06-12' : PLANNED_FOR }), [noDate, moved]);
  const event = useMemo(() => (venue ? { chosen_venue_id: 'v1' } : undefined), [venue]);

  const [tasks] = useState(() => {
    const tab = params.get('tab');
    try { if (tab) sessionStorage.setItem('kalas_planning_tab', tab); } catch { /* ignore */ }
    if (noDate) return [];
    // The first milestone is ticked, so the list shows done, overdue and ahead.
    return defaultMilestones(PLANNED_FOR).map((m, i) => task(m.title, { ...m, done: i === 0 }));
  });

  return (
    <FixtureWedding
      tasks={tasks}
      couple={couple}
      event={event}
    >
      <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
        {navigated && (
          <p data-testid="navigated" className="px-6 pt-4 text-xs text-muted">→ {navigated}</p>
        )}
        <Planning onNavigate={(s) => setNavigated(String(s))} />
      </div>
    </FixtureWedding>
  );
}

export default function DevPlanningPage() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense><Harness /></Suspense>
    </LanguageProvider>
  );
}
