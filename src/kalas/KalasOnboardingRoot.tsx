"use client";

/* Wedding-interview onboarding. Mounted at /onboarding (ssr:false). On
   completion we persist the couple's answers as a real wedding (creating the
   event, seeding Juno's chat, marking the profile onboarded) and do a full
   navigation to /home so the server gate re-reads profiles.onboarded. */
import { AnimatePresence, MotionConfig } from 'motion/react';
import Onboarding, { type FormState, type PhotoDraft, toOnboardingPayload } from './screens/Onboarding';
import { LanguageProvider, useLang, type Lang } from './i18n';
import { JUNO_OPEN_KEY, tourHandoff, WALKTHROUGH_DONE_KEY, WALKTHROUGH_KEY } from './walkthrough';

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

  const enter = async (form: FormState) => {
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toOnboardingPayload(form), language: lang }),
      });
      const { eventId } = (await res.json().catch(() => ({}))) as { eventId?: string };
      if (res.ok && eventId) await uploadPhotos(eventId, form.photos);
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
    // Hand off to Hjem with Juno's panel open and her guided tour armed at step 0 — she
    // takes it from here. localStorage (not session) so a reload resumes it,
    // and the done marker is cleared because finishing the interview means
    // starting over: without that, a couple who had seen the tour once got
    // nothing on their second run through onboarding.
    try {
      const handoff = tourHandoff();
      localStorage.setItem(JUNO_OPEN_KEY, '1');
      localStorage.setItem(WALKTHROUGH_KEY, handoff.setProgress);
      if (handoff.clearDone) localStorage.removeItem(WALKTHROUGH_DONE_KEY);
    } catch {
      // Private mode: they land on Hjem as it was, without the tour.
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

/* The photos picked in onboarding, filed under the wedding that now exists.
   Through the same route the home hero and the website use, so the first one
   lands as the hero both of them already show. Best effort: a photo that does
   not make it can be added from home, and none of this should hold them at
   the door. */
async function uploadPhotos(eventId: string, photos: PhotoDraft[]) {
  await Promise.allSettled(
    photos.map((p, i) => {
      const body = new FormData();
      body.append('file', p.file);
      body.append('eventId', eventId);
      body.append('role', i === 0 ? 'hero' : 'gallery');
      return fetch('/api/website/photos', { method: 'POST', body });
    }),
  );
}
