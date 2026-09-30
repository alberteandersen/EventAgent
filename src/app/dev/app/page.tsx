'use client';

/* The app as a couple sees it, against a fixture wedding: the real shell and
   any screen, to check every page against the others.
     ?screen=budget      which screen (default home)
     ?loading=1          before the wedding's data has arrived
     ?empty=1            a wedding with nothing in it yet
     ?error=1            the wedding could not be loaded
     ?ava=1              Ava's panel open (a stand-in; /dev/ava-chat has the real chat)
   Calls to /api are answered empty, so screens that fetch show their empty
   state rather than an auth error. */

import { Suspense, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Shell, { type ScreenId } from '@/kalas/Shell';
import { ConfirmProvider } from '@/kalas/ui';
import { resolveScreenNavigation, type NavigateTarget } from '@/kalas/lib/hub-nav';
import { defaultMilestones } from '@/kalas/screens/planning/milestones';
import Home from '@/kalas/screens/Home';
import Planning from '@/kalas/screens/Planning';
import Inbox from '@/kalas/screens/Inbox';
import VendorHub from '@/kalas/screens/team/VendorHub';
import Budget from '@/kalas/screens/Budget';
import Guests from '@/kalas/screens/Guests';
import Website from '@/kalas/screens/Website';
import Registry from '@/kalas/screens/Registry';
import Invites from '@/kalas/screens/Invites';
import Seating from '@/kalas/screens/Seating';
import Nygift from '@/kalas/screens/Nygift';
import Guides from '@/kalas/screens/Guides';
import { FixtureWedding, guest, task } from '../_fixture/wedding';
import type { VenueRow } from '@/lib/db/types';

const DATE = '2027-09-11';

let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
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
  guides: <Guides onNavigate={nav} />,
});

function Harness() {
  const params = useSearchParams();
  const empty = params.get('empty') === '1';
  const [screen, setScreen] = useState<ScreenId>(() => (params.get('screen') as ScreenId) || 'home');
  useState(() => { patchFetch(); return null; });
  const [avaOpen, setAvaOpen] = useState(params.get('ava') === '1');

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
      venue('v2', 'Hindsgavl Slot', { rating: 4.8 }),
      venue('v3', 'Dalum Kloster', { swipe_status: 'rejected' as VenueRow['swipe_status'] }),
    ],
  }), [empty]);

  const navigate = (s: NavigateTarget) => {
    if (s === 'ava') return;
    setScreen(resolveScreenNavigation(s));
  };

  return (
    <FixtureWedding
      loading={params.get('loading') === '1'}
      loadError={params.get('error') === '1'}
      guests={fixture.guests}
      tasks={fixture.tasks}
      venues={fixture.venues}
      couple={{ dateISO: DATE }}
      event={{ event_date: DATE, location: 'Fyn', guest_count: 80, budget: '225000' }}
    >
      <ConfirmProvider>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Shell
            current={screen}
            onNavigate={navigate}
            avaOpen={avaOpen}
            onAvaOpenChange={setAvaOpen}
            ava={
              <div data-testid="ava-standin" className="flex flex-1 flex-col gap-3 p-6">
                <p className="font-serif text-title text-ink">Ava</p>
                <p className="text-meta text-muted">Stand-in for the chat.</p>
                <button type="button" onClick={() => setAvaOpen(false)} className="self-start text-meta text-terracotta">Luk</button>
              </div>
            }
          >
            <div key={screen}>{SCREENS(navigate)[screen]}</div>
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
