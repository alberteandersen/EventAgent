'use client';

/* The app as a couple sees it, against a fixture wedding: the real shell and
   any screen, to check every page against the others.
     ?screen=budget      which screen (default home)
     ?loading=1          before the wedding's data has arrived
     ?empty=1            a wedding with nothing in it yet
     ?error=1            the wedding could not be loaded
     ?apifail=1          every call to /api fails (a 500), for the error states
     ?juno=1              Juno's panel open (a stand-in; /dev/juno-chat has the real chat)
   Calls to /api are answered empty, so screens that fetch show their empty
   state rather than an auth error. */

import { Suspense, startTransition, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Shell, { type ScreenId } from '@/kalas/Shell';
import { ConfirmProvider, PageLoader } from '@/kalas/ui';
import { resolveScreenNavigation, type NavigateTarget } from '@/kalas/lib/hub-nav';
import { defaultMilestones } from '@/kalas/screens/planning/milestones';
import Home from '@/kalas/screens/Home';
import SetupGuide from '@/kalas/SetupGuide';
// The pages load as they do in the app: lazily, fetched on idle.
import { Budget, Guests, Inbox, Invites, Nygift, Planning, Registry, Seating, VendorHub, Website, usePrefetchPages } from '@/kalas/pages';
import { estimatedLines, SUGGESTED_SUB_ITEMS } from '@/kalas/screens/budget/estimate';
import { FixtureWedding, guest, task } from '../_fixture/wedding';
import type { BudgetItemRow, BudgetSubItemRow, VenueRow } from '@/lib/db/types';

const DATE = '2027-09-11';

let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const real = window.fetch.bind(window);
  const fail = new URLSearchParams(window.location.search).get('apifail') === '1';
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/') && fail) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'dev: failing on purpose' }), { status: 500 }));
    }
    if (url.includes('/api/')) {
      return Promise.resolve(new Response(JSON.stringify({ items: [], photos: [], threads: [], total: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return real(input, init);
  };
}

const venue = (id: string, name: string, patch: Partial<VenueRow> = {}) => ({
  id, event_id: 'dev', user_id: 'dev', name, description: 'Herregård med lade og have, 45 min fra Odense.',
  address: 'Fyn', website: null, email: null, phone: null, capacity: '120', price_hint: null, image_url: null,
  source_urls: [], swipe_status: 'liked', email_lookup_status: 'not_needed', place_id: null, rating: 4.7,
  review_count: 88, reviews: [], photo_urls: [], lat: null, lng: null, price_level: null, business_status: null,
  why_fit: null, contact_verified: true, category: 'venue', booked_at: null, venue_research: null,
  created_at: new Date().toISOString(), ...patch,
}) as unknown as VenueRow;

/* A budget some way in: the venue part paid, the photographer settled, the
   florist's deposit overdue, and the rest still at the opening split. */
const BUDGET_PATCH: Record<string, Partial<BudgetItemRow>> = {
  venue: { actual_cost: 62000, paid_amount: 20000, reminder_at: '2027-03-01', notes: 'Depositum betalt. Restbeløbet forfalder et halvt år før.' },
  photo: { actual_cost: 24000, paid_amount: 24000 },
  florals: { actual_cost: 18500, paid_amount: 0, reminder_at: '2026-09-20' },
};
const POSTS: Record<string, [amount: number, paid: boolean, vendor?: string][]> = {
  venue: [[48000, true, 'Hindsgavl Slot'], [6000, false], [8000, false], [0, false]],
  photo: [[24000, true], [0, false], [0, false]],
  florals: [[4500, false], [9000, false], [5000, false], [0, false]],
};
const BUDGET_ITEMS = estimatedLines(225000).map((line) => ({
  id: `b-${line.category}`, event_id: 'dev', user_id: 'dev', paid_amount: 0, actual_cost: 0, notes: null,
  reminder_at: null, sub_items_seeded: true, created_at: '2026-10-01T00:00:00.000Z', ...line, ...BUDGET_PATCH[line.category],
}) as BudgetItemRow);
const BUDGET_SUB_ITEMS = Object.entries(SUGGESTED_SUB_ITEMS).flatMap(([category, labels]) =>
  labels.map((label, i) => {
    const [amount, paid, vendor] = POSTS[category]?.[i] ?? [0, false];
    return {
      id: `s-${category}-${i}`, event_id: 'dev', user_id: 'dev', category, label, vendor: vendor ?? null,
      amount, paid, sort: i, created_at: '2026-10-01T00:00:00.000Z',
    } as BudgetSubItemRow;
  }));

const SCREENS = (nav: (s: NavigateTarget) => void): Record<string, React.ReactNode> => ({
  home: <Home onNavigate={nav} />,
  planning: <Planning onNavigate={nav} />,
  inbox: <Inbox onNavigate={nav} />,
  team: <VendorHub onNavigate={nav} />,
  budget: <Budget onNavigate={nav} />,
  guests: <Guests />,
  website: <Website />,
  registry: <Registry onNavigate={nav} />,
  invites: <Invites />,
  seating: <Seating />,
  nygift: <Nygift onNavigate={nav} />,
});

function Harness() {
  const params = useSearchParams();
  const empty = params.get('empty') === '1';
  const [screen, setScreen] = useState<ScreenId>(() => (params.get('screen') as ScreenId) || 'home');
  useState(() => { patchFetch(); return null; });
  const [junoOpen, setJunoOpen] = useState(params.get('juno') === '1');

  const fixture = useMemo(() => ({
    guests: empty ? [] : [
      guest('Anna Holm', { side: 'Emma', rsvp: 'ja' }),
      guest('Peter Holm', { side: 'Emma', rsvp: 'ja', dietary_tags: ['vegetar'] }),
      guest('Karen Møller', { side: 'Frederik', rsvp: 'afventer' }),
      guest('Jonas Bech', { side: 'Frederik', rsvp: 'nej' }),
      guest('Sofie Lund', { side: 'Fælles', rsvp: 'ja', overnight: true }),
      guest('Mads Lund', { side: 'Fælles', rsvp: 'afventer', age_group: 'child' }),
    ],
    tasks: empty ? [] : defaultMilestones(DATE).map((m, i) => task(m.title, { ...m, done: i === 0 })),
    venues: empty ? [] : [
      venue('v1', 'Egeskov Lade'),
      // The one Juno has researched, for the briefing in the venue modal.
      venue('v2', 'Hindsgavl Slot', {
        rating: 4.8,
        why_fit: 'Parken ned til Lillebælt giver jer vielse og fest samme sted.',
        price_hint: 'fra 95.000 kr.',
        venue_research: {
          briefing: ['Plads til 140 siddende i Havesalen', 'Egen kok, og menuen smages til på forhånd', '72 værelser på slottet'],
          highlights: ['Vielse i parken med regnplan indenfor', 'Parkering ved hovedbygningen'],
          practical: [{ key: 'Kapacitet', value: '140 siddende' }, { key: 'Slut', value: 'Kl. 02.00' }, { key: 'Overnatning', value: '72 værelser' }],
          packages: [
            { name: 'Slotsbryllup', desc: 'Velkomst, tre retter, vine og natmad.', price: '1.895 kr. pr. gæst', featured: true },
            { name: 'Havefest', desc: 'Reception og buffet i parken.', price: '1.295 kr. pr. gæst' },
          ],
          directions: '10 min. fra Middelfart station',
          researched_at: new Date().toISOString(),
        },
      }),
      venue('v3', 'Dalum Kloster', { swipe_status: 'rejected' as VenueRow['swipe_status'] }),
    ],
    // An empty wedding lets the budget lay out its own opening split.
    budgetItems: empty ? [] : BUDGET_ITEMS,
    budgetSubItems: empty ? [] : BUDGET_SUB_ITEMS,
  }), [empty]);

  usePrefetchPages();
  const navigate = (s: NavigateTarget) => {
    if (s === 'juno') return;
    startTransition(() => setScreen(resolveScreenNavigation(s)));
  };

  return (
    <FixtureWedding
      loading={params.get('loading') === '1'}
      loadError={params.get('error') === '1'}
      guests={fixture.guests}
      tasks={fixture.tasks}
      venues={fixture.venues}
      budgetItems={fixture.budgetItems}
      budgetSubItems={fixture.budgetSubItems}
      couple={{ dateISO: DATE }}
      event={{ event_date: DATE, location: 'Fyn', guest_count: 80, budget: '225000' }}
    >
      <ConfirmProvider>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Shell
            current={screen}
            onNavigate={navigate}
            junoOpen={junoOpen}
            onJunoOpenChange={setJunoOpen}
            corner={<SetupGuide onNavigate={navigate} />}
            juno={
              <div data-testid="juno-standin" className="flex flex-1 flex-col gap-3 p-6">
                <p className="font-serif text-title text-ink">Juno</p>
                <p className="text-meta text-muted">Stand-in for the chat.</p>
                <button type="button" onClick={() => setJunoOpen(false)} className="self-start text-meta text-terracotta">Luk</button>
              </div>
            }
          >
            <Suspense fallback={<PageLoader />}>
              <div key={screen}>{SCREENS(navigate)[screen]}</div>
            </Suspense>
          </Shell>
        </div>
      </ConfirmProvider>
    </FixtureWedding>
  );
}

function Page() {
  return (
    <LanguageProvider initialLang="da" lock>
      <Suspense><Harness /></Suspense>
    </LanguageProvider>
  );
}

export default dynamic(() => Promise.resolve(Page), { ssr: false });
