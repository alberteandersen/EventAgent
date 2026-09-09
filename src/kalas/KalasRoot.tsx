"use client";

/* Authenticated Kalas app. Mounted at /home via next/dynamic with ssr:false,
   so sessionStorage/window access in the screens is safe. Onboarding lives
   on its own Next route (/onboarding), no phase state here. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import Shell, { type ScreenId } from './Shell';
import ChatShell from './ChatShell';
import { WALKTHROUGH_KEY, WALKTHROUGH_STEPS, walkthroughParams } from './walkthrough';
import GuidedTour from './GuidedTour';
import { KalasProvider, useKalas } from './store';
import { WeddingProvider, useWedding } from './useWedding';
import { LanguageProvider, type Lang } from './i18n';
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
import Honeymoon from './screens/Honeymoon';
import Nygift from './screens/Nygift';

export default function KalasRoot({ initialLang = 'da' }: { initialLang?: Lang }) {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider initialLang={initialLang}>
        <WeddingProvider>
          <KalasProvider>
            <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
              <AppInner />
            </div>
          </KalasProvider>
        </WeddingProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}

function AppInner() {
  const { pendingCount } = useKalas();
  const { replies, event, couple } = useWedding();
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
    } catch { /* ignore */ }
    const saved = sessionStorage.getItem('kalas_screen');
    if (saved === 'ava' || saved === 'inspiration') return 'home';
    return migrateSavedScreen(saved) || 'home';
  });
  // Ava's one-time guided tour, armed by onboarding completion (or
  // `?walkthrough=1` so it can be replayed on demand). One tour, mounted below
  // both shells: onboarding lands every couple in chat mode, so a tour that
  // only ran in classic was a tour nobody was shown.
  const [walkthroughActive, setWalkthroughActive] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('walkthrough') === '1') {
        localStorage.setItem(WALKTHROUGH_KEY, '0');
        /* Consume the flag. Left in the address bar it re-armed the tour on
           every reload, so finishing it and coming back started it over —
           the tour ran in a ring and never let them out. */
        const url = new URL(window.location.href);
        url.searchParams.delete('walkthrough');
        window.history.replaceState(null, '', url.toString());
        return true;
      }
      return localStorage.getItem(WALKTHROUGH_KEY) !== null;
    } catch { return false; }
  });

  /* A walkthrough try-prompt pressed in classic: switch to chat and hand Ava
     the prompt to send. The search really runs — that is the point of the
     button, and why this is a walkthrough rather than a slideshow.
     React state, not sessionStorage: writing to storage notifies nobody, so an
     Ava that was already mounted never noticed the prompt arrive. */
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [promptDoneTick, setPromptDoneTick] = useState(0);
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

  const askAva = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    // Already in chat: the prompt lands in the thread they are looking at.
    setChatMode((on) => {
      if (!on) { try { localStorage.setItem('kalas_chat_mode', '1'); } catch { /* ignore */ } }
      return true;
    });
  }, []);

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
  const navigatedForStep = useRef<number | null>(null);
  useEffect(() => {
    if (!walkthroughActive) return;
    if (navigatedForStep.current === tourStep) return;
    navigatedForStep.current = tourStep;
    const page = WALKTHROUGH_STEPS[tourStep]?.page;
    if (page) navigateRef.current(page);
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
    try { localStorage.removeItem(WALKTHROUGH_KEY); } catch { /* ignore */ }
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
    honeymoon:   <Honeymoon onNavigate={navigate} />,
    nygift:      <Nygift onNavigate={navigate} />,
  };

  const activeScreen = screen === 'ava' ? 'home' : screen;

  const tour = walkthroughActive ? (
    <GuidedTour
      params={walkthroughParams(event, couple)}
      onNavigate={navigate}
      onAskAva={askAva}
      onFinish={finishWalkthrough}
      promptDoneTick={promptDoneTick}
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
        pendingCount={pendingCount}
        inboxBadge={inboxBadge}
        chat={
          <Ava
            onNavigate={navigate}
            onUiAction={applyUiAction}
            uiMode="chat"
            variant="drawer"
            pendingPrompt={pendingPrompt}
            onPendingPromptSent={() => setPendingPrompt(null)}
            onPendingPromptDone={() => setPromptDoneTick((n) => n + 1)}
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
      pendingCount={pendingCount}
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
