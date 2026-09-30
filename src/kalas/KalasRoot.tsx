"use client";

/* Authenticated Kalas app. Mounted at /home via next/dynamic with ssr:false,
   so sessionStorage/window access in the screens is safe. Onboarding lives
   on its own Next route (/onboarding), no phase state here. */
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, MotionConfig } from 'motion/react';
import Shell, { type ScreenId } from './Shell';
import ChatShell from './ChatShell';
import { armTour, WALKTHROUGH_DONE_KEY, WALKTHROUGH_KEY, WALKTHROUGH_STEPS } from './walkthrough';
import GuidedTour from './GuidedTour';
import { WeddingProvider, useWedding } from './useWedding';
import { LanguageProvider, type Lang } from './i18n';
import { UndoProvider } from './undo';
import { ConfirmProvider } from './ui';
import Home from './screens/Home';
import Ava from './screens/Ava';
import type { AgentUiAction } from '@/lib/db/types';
import { agentActionToScreen, migrateSavedScreen, resolveScreenNavigation, type NavigateTarget } from './lib/hub-nav';
import { isLegacyHubScreen } from './screens/team/shared';
import VendorHub from './screens/team/VendorHub';
import Planning from './screens/Planning';
import Budget from './screens/Budget';
import Guests from './screens/Guests';
import Website from './screens/Website';
import Invites from './screens/Invites';
import Seating from './screens/Seating';
import Registry from './screens/Registry';
import Inbox from './screens/Inbox';
import Nygift from './screens/Nygift';
import { OPEN_GUIDE_EVENT } from './screens/guides/links';

// Every guide and FAQ answer ships with this screen; loaded when first opened.
const Guides = dynamic(() => import('./screens/Guides'), { ssr: false });

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
  const { replies } = useWedding();
  const inboxBadge = replies.filter((r) => !r.read_at).length;
  const [hubTick, setHubTick] = useState(0);
  // Chat mode: collapsed icon-rail + Ava-driven stage. Sticky across visits.
  const [chatMode, setChatMode] = useState(() => {
    try { return localStorage.getItem('kalas_chat_mode') === '1'; } catch { return false; }
  });
  // Bumped on every agent-driven navigation (ChatShell flips mobile to stage).
  const [stageTick, setStageTick] = useState(0);
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
  // `?walkthrough=1` so it can be replayed on demand). One tour, mounted below
  // both shells: onboarding lands every couple in chat mode, so a tour that
  // only ran in classic was a tour nobody was shown.
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

  /* The tour's step lives here rather than inside it: switching mode swaps
     which shell the tour is mounted under, and state inside it would be read
     back from storage each time — replaying the step they had just done. */
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

  const toggleChatMode = useCallback((on: boolean) => {
    setChatMode(on);
    try { localStorage.setItem('kalas_chat_mode', on ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const navigate = (s: NavigateTarget) => {
    if (s === 'ava') {
      // In-page “talk to Ava” CTAs enter chat mode.
      toggleChatMode(true);
      return;
    }
    const hadDeepLink = isLegacyHubScreen(s)
      || Boolean(sessionStorage.getItem('kalas_hub_tab') || sessionStorage.getItem('kalas_hub_cat'));
    const target = resolveScreenNavigation(s);
    if (target === 'team' && hadDeepLink) setHubTick((t) => t + 1);
    sessionStorage.setItem('kalas_screen', target);
    setScreen(target);
    // Chat mode: any navigation should surface the stage on mobile too.
    if (chatMode) setStageTick((t) => t + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const toggleChatModeRef = useRef(toggleChatMode);
  useEffect(() => { toggleChatModeRef.current = toggleChatMode; });
  const navigatedForStep = useRef<number | null>(null);
  useEffect(() => {
    if (!walkthroughActive) return;
    if (navigatedForStep.current === tourStep) return;
    navigatedForStep.current = tourStep;
    const step = WALKTHROUGH_STEPS[tourStep];
    if (step?.page) navigateRef.current(step.page);
    /* A step can insist on a mode. The first one opens in classic so the tour
       is not explaining a page from behind the chat column, and the chat step
       opens chat so it can show what it is talking about. The couple's real
       choice is the one they make on the last step. */
    if (step?.chat !== undefined) toggleChatModeRef.current(step.chat);
  }, [walkthroughActive, tourStep]);

  // Agent-fired navigation (streamed `ui` frames).
  const applyUiAction = useCallback((action: AgentUiAction) => {
    if (action.kind !== 'navigate') return;
    const target = agentActionToScreen(action);
    if (target === 'team') setHubTick((t) => t + 1);
    sessionStorage.setItem('kalas_screen', target);
    setScreen(target);
    setStageTick((t) => t + 1);
  }, []);

  // End of the walkthrough: the couple's mode choice is the real one from here.
  const finishWalkthrough = useCallback((mode: 'chat' | 'classic') => {
    try {
      localStorage.removeItem(WALKTHROUGH_KEY);
      localStorage.setItem(WALKTHROUGH_DONE_KEY, '1');
    } catch { /* ignore */ }
    setWalkthroughActive(false);
    toggleChatMode(mode === 'chat');
    if (mode === 'classic') {
      sessionStorage.setItem('kalas_screen', 'home');
      setScreen('home');
    }
  }, [toggleChatMode]);

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
      chatMode={chatMode}
      idx={Math.min(tourStep, WALKTHROUGH_STEPS.length - 1)}
      setIdx={setTourStep}
    />
  ) : null;

  if (chatMode) {
    return (
      <ChatShell
        current={activeScreen}
        onNavigate={navigate}
        onChatModeChange={toggleChatMode}
        stageSignal={stageTick}
        inboxBadge={inboxBadge}
        chat={
          <Ava
            onNavigate={navigate}
            onUiAction={applyUiAction}
            uiMode="chat"
          />
        }
        hideModeToggle={walkthroughActive}
      >
        {screens[activeScreen as AppScreen]}
        {tour}
      </ChatShell>
    );
  }

  return (
    <Shell
      current={activeScreen}
      onNavigate={navigate}
      inboxBadge={inboxBadge}
      chatMode={false}
      onChatModeChange={toggleChatMode}
    >
      <AnimatePresence mode="wait">
        <div key={activeScreen}>{screens[activeScreen as AppScreen]}</div>
      </AnimatePresence>
      {tour}
    </Shell>
  );
}
