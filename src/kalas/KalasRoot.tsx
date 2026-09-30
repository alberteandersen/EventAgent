"use client";

/* Authenticated Kalas app. Mounted at /home via next/dynamic with ssr:false,
   so sessionStorage/window access in the screens is safe. Onboarding lives
   on its own Next route (/onboarding), no phase state here. */
import { Suspense, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import Shell, { type ScreenId } from './Shell';
import { armTour, AVA_OPEN_KEY, WALKTHROUGH_DONE_KEY, WALKTHROUGH_KEY, WALKTHROUGH_STEPS } from './walkthrough';
import GuidedTour from './GuidedTour';
import { WeddingProvider, useWedding } from './useWedding';
import { LanguageProvider, type Lang } from './i18n';
import { UndoProvider } from './undo';
import { ConfirmProvider, PageLoader } from './ui';
import Home from './screens/Home';
import Ava from './screens/Ava';
import type { AgentUiAction } from '@/lib/db/types';
import { agentActionToScreen, migrateSavedScreen, resolveScreenNavigation, type NavigateTarget } from './lib/hub-nav';
import { isLegacyHubScreen } from './screens/team/shared';
import { OPEN_GUIDE_EVENT } from './screens/guides/links';
import { Budget, Guests, Guides, Inbox, Invites, Nygift, Planning, Registry, Seating, VendorHub, Website, usePrefetchPages } from './pages';


export default function KalasRoot({ initialLang = 'da' }: { initialLang?: Lang }) {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider initialLang={initialLang}>
        <WeddingProvider>
          <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
            <UndoProvider>
              <ConfirmProvider>
                <AppInner />
              </ConfirmProvider>
            </UndoProvider>
          </div>
        </WeddingProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}

function AppInner() {
  usePrefetchPages();
  const { replies } = useWedding();
  const inboxBadge = replies.filter((r) => !r.read_at).length;
  const [hubTick, setHubTick] = useState(0);
  // Ava's panel, open or put away, remembered on this device. A couple who
  // used chat mode, as the panel was once a whole mode, keeps it open.
  const [avaOpen, setAvaOpen] = useState(() => {
    try { return (localStorage.getItem(AVA_OPEN_KEY) ?? localStorage.getItem('kalas_chat_mode')) === '1'; }
    catch { return false; }
  });
  // Bumped on every page Ava opens; on a phone the panel steps aside for it.
  const [avaSignal, setAvaSignal] = useState(0);
  const [screen, setScreen] = useState<ScreenId>(() => {
    // Returning from the website Stripe checkout → land on the builder,
    // which reads and strips the query param itself.
    try {
      if (new URLSearchParams(window.location.search).has('website_checkout')) return 'website';
      // The "a vendor replied" mail links to /home?screen=inbox.
      const url = new URL(window.location.href);
      if (url.searchParams.get('screen') === 'inbox') {
        url.searchParams.delete('screen');
        window.history.replaceState(null, '', url.toString());
        sessionStorage.setItem('kalas_screen', 'inbox');
        return 'inbox';
      }
    } catch { /* ignore */ }
    return migrateSavedScreen(sessionStorage.getItem('kalas_screen')) || 'home';
  });
  // Ava's one-time guided tour, armed by onboarding completion (or
  // `?walkthrough=1` so it can be replayed on demand).
  const [walkthroughActive, setWalkthroughActive] = useState(() => {
    try {
      const decision = armTour({
        param: new URLSearchParams(window.location.search).get('walkthrough'),
        progress: localStorage.getItem(WALKTHROUGH_KEY),
        done: localStorage.getItem(WALKTHROUGH_DONE_KEY),
      });
      if (decision.setProgress !== undefined) localStorage.setItem(WALKTHROUGH_KEY, decision.setProgress);
      if (decision.clearDone) localStorage.removeItem(WALKTHROUGH_DONE_KEY);
      if (decision.stripParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete('walkthrough');
        window.history.replaceState(null, '', url.toString());
      }
      return decision.active;
    } catch { return false; }
  });

  /* The tour's step lives here rather than inside it, so a re-mount of the
     tour cannot read it back from storage and replay the step just done. */
  const [tourStep, setTourStep] = useState(() => {
    try {
      const raw = localStorage.getItem(WALKTHROUGH_KEY);
      const n = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(n) ? Math.max(n, 0) : 0;
    } catch { return 0; }
  });
  useEffect(() => {
    if (!walkthroughActive) return;
    try { localStorage.setItem(WALKTHROUGH_KEY, String(tourStep)); } catch { /* ignore */ }
  }, [walkthroughActive, tourStep]);

  const setAva = useCallback((open: boolean) => {
    setAvaOpen(open);
    try {
      localStorage.setItem(AVA_OPEN_KEY, open ? '1' : '0');
      localStorage.removeItem('kalas_chat_mode');
    } catch { /* ignore */ }
  }, []);

  const navigate = (s: NavigateTarget) => {
    if (s === 'ava') {
      // In-page “talk to Ava” CTAs open her panel.
      setAva(true);
      return;
    }
    const hadDeepLink = isLegacyHubScreen(s)
      || Boolean(sessionStorage.getItem('kalas_hub_tab') || sessionStorage.getItem('kalas_hub_cat'));
    const target = resolveScreenNavigation(s);
    if (target === 'team' && hadDeepLink) setHubTick((t) => t + 1);
    sessionStorage.setItem('kalas_screen', target);
    startTransition(() => setScreen(target));
  };

  /* The page follows the tour, exactly once per step. It lives up here with
     the step it belongs to: inside the tour it re-fired on re-render and on
     the re-mount a mode change causes, so the couple was pulled back to Hjem
     the instant they clicked a checklist row — the row navigated, and the
     tour navigated straight back. */
  const navigateRef = useRef<(s: NavigateTarget) => void>(() => {});
  useEffect(() => { navigateRef.current = navigate; });

  // "Guide: …" links on the pages open the Guides screen from wherever they are.
  useEffect(() => {
    const onOpenGuide = () => navigateRef.current('guides');
    window.addEventListener(OPEN_GUIDE_EVENT, onOpenGuide);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpenGuide);
  }, []);
  const setAvaRef = useRef(setAva);
  useEffect(() => { setAvaRef.current = setAva; });
  const navigatedForStep = useRef<number | null>(null);
  useEffect(() => {
    if (!walkthroughActive) return;
    if (navigatedForStep.current === tourStep) return;
    navigatedForStep.current = tourStep;
    const step = WALKTHROUGH_STEPS[tourStep];
    if (step?.page) navigateRef.current(step.page);
    /* A step can open or put away Ava's panel: the first one puts it away, so
       the tour is not explaining a page from behind her. */
    if (step?.chat !== undefined) setAvaRef.current(step.chat);
  }, [walkthroughActive, tourStep]);

  // Agent-fired navigation (streamed `ui` frames).
  const applyUiAction = useCallback((action: AgentUiAction) => {
    if (action.kind !== 'navigate') return;
    const target = agentActionToScreen(action);
    if (target === 'team') setHubTick((t) => t + 1);
    sessionStorage.setItem('kalas_screen', target);
    startTransition(() => setScreen(target));
    setAvaSignal((t) => t + 1);
  }, []);

  // End of the walkthrough: back to Hjem, with Ava open beside it.
  const finishWalkthrough = useCallback(() => {
    try {
      localStorage.removeItem(WALKTHROUGH_KEY);
      localStorage.setItem(WALKTHROUGH_DONE_KEY, '1');
    } catch { /* ignore */ }
    setWalkthroughActive(false);
    setAva(true);
    sessionStorage.setItem('kalas_screen', 'home');
    startTransition(() => setScreen('home'));
  }, [setAva]);

  type AppScreen = Exclude<ScreenId, 'ava'>;
  const screens: Record<AppScreen, React.ReactNode> = {
    home:        <Home onNavigate={navigate} />,
    team:        <VendorHub key={hubTick} onNavigate={navigate} />,
    inbox:       <Inbox onNavigate={navigate} />,
    planning:    <Planning onNavigate={navigate} />,
    budget:      <Budget onNavigate={navigate} />,
    guests:      <Guests />,
    website:     <Website />,
    registry:    <Registry onNavigate={navigate} />,
    invites:     <Invites />,
    seating:     <Seating />,
    nygift:      <Nygift onNavigate={navigate} />,
    guides:      <Guides onNavigate={navigate} />,
  };

  const activeScreen = screen === 'ava' ? 'home' : screen;

  const tour = walkthroughActive ? (
    <GuidedTour
      onNavigate={navigate}
      onFinish={finishWalkthrough}
      idx={Math.min(tourStep, WALKTHROUGH_STEPS.length - 1)}
      setIdx={setTourStep}
    />
  ) : null;

  return (
    <Shell
      current={activeScreen}
      onNavigate={navigate}
      inboxBadge={inboxBadge}
      ava={<Ava onNavigate={navigate} onUiAction={applyUiAction} onClose={() => setAva(false)} />}
      avaOpen={avaOpen}
      onAvaOpenChange={setAva}
      avaSignal={avaSignal}
    >
      {/* Outside the keyed page, so a page change (a transition) keeps the
          current page up rather than falling back to the loader. */}
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <div key={activeScreen}>{screens[activeScreen as AppScreen]}</div>
        </AnimatePresence>
      </Suspense>
      {tour}
    </Shell>
  );
}
