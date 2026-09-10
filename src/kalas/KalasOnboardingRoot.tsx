"use client";

/* Wedding-interview onboarding. Mounted at /onboarding (ssr:false). On
   completion we persist the couple's answers as a real wedding (creating the
   event, seeding Ava's chat, marking the profile onboarded) and do a full
   navigation to /home so the server gate re-reads profiles.onboarded. */
import { AnimatePresence, MotionConfig } from 'motion/react';
import { type ScreenId } from './Shell';
import Onboarding, { type FormState, toOnboardingPayload } from './screens/Onboarding';
import { LanguageProvider, useLang, type Lang } from './i18n';
import { tourHandoff, WALKTHROUGH_DONE_KEY, WALKTHROUGH_KEY } from './walkthrough';

export default function KalasOnboardingRoot({ initialLang = 'da' }: { initialLang?: Lang }) {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider initialLang={initialLang}>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <OnboardingShell />
        </div>
      </LanguageProvider>
    </MotionConfig>
  );
}

function OnboardingShell() {
  const { lang } = useLang();

  const enter = async (form: FormState, _s?: ScreenId) => {
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toOnboardingPayload(form), language: lang }),
      });
    } catch {
      // Non-fatal: fall back to just marking onboarded so the gate lets them in.
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarded: true, language: lang }),
        });
      } catch {
        // /home's server gate will bounce back here if nothing stuck.
      }
    }
    // Hand off into chat mode with Ava's guided tour armed at step 0 — she
    // takes it from here. localStorage (not session) so a reload resumes it,
    // and the done marker is cleared because finishing the interview means
    // starting over: without that, a couple who had seen the tour once got
    // nothing on their second run through onboarding.
    try {
      const handoff = tourHandoff();
      localStorage.setItem('kalas_chat_mode', '1');
      localStorage.setItem(WALKTHROUGH_KEY, handoff.setProgress);
      if (handoff.clearDone) localStorage.removeItem(WALKTHROUGH_DONE_KEY);
    } catch {
      // Private mode: they just land in whatever mode they were in, no tour.
    }
    sessionStorage.setItem('kalas_screen', 'home');
    window.location.assign('/home');
  };

  return (
    <AnimatePresence mode="wait">
      <Onboarding key="onb" onEnter={enter} />
    </AnimatePresence>
  );
}
