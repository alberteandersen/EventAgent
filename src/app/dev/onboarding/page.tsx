"use client";

/* Harness for the onboarding wizard's layout. The real screen sits behind
   login, and the thing worth checking here is geometric: every step has to
   fit the viewport, because the footer carries "Fortsæt" and it used to
   scroll away with the page. Step buttons switch steps without answering. */

import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { LanguageProvider } from '@/kalas/i18n';
import Onboarding from '@/kalas/screens/Onboarding';

export default function DevOnboardingPage() {
  const [start, setStart] = useState(0);

  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider initialLang="da">
        <div className="theme-kalas">
          <div className="fixed right-3 top-3 z-50 flex gap-1">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                data-step={n}
                onClick={() => setStart(n)}
                className="h-7 w-7 rounded-full border border-line bg-card text-[11px] font-semibold text-ink hover:border-ink cursor-pointer"
              >
                {n}
              </button>
            ))}
          </div>
          <Onboarding key={start} initialStep={start} onEnter={() => setStart(0)} />
        </div>
      </LanguageProvider>
    </MotionConfig>
  );
}
