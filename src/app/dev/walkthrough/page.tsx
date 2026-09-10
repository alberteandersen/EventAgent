"use client";

/* Harness for GuidedTour — the real component, without a signed-in wedding.
   Nothing is highlighted any more, so there is nothing to stand in for: what
   this exercises is the card itself, the forward/back buttons, the progress
   ring and the final chat-vs-classic fork. The tall filler below is there so
   the scroll-to-top on each step has something to scroll. */

import { useState } from 'react';
import GuidedTour from '@/kalas/GuidedTour';
import { LanguageProvider } from '@/kalas/i18n';
import type { ScreenId } from '@/kalas/Shell';

export default function DevWalkthroughPage() {
  const [running, setRunning] = useState(true);
  // The step lives with the parent in the app too, so the harness mirrors that.
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
        <p className="eyebrow mb-6">Dev · GuidedTour</p>

        <div className="mb-4 flex h-[120px] max-w-[520px] items-center rounded-[20px] border border-line bg-shell px-6">
          <span className="font-serif text-[1.4rem] text-ink">Alberte &amp; Espen · 584 dage</span>
        </div>

        {/* Enough page to scroll, so "each step opens at the top" is visible. */}
        <div className="mb-4 h-[1400px] w-full max-w-[980px] rounded-[28px] border border-line bg-shell" />

        <pre className="mb-4 text-[12px] text-ink-soft">{log.join('\n') || 'ingen handling endnu'}</pre>

        {running && (
          <GuidedTour
            onNavigate={(s: ScreenId) => note(`navigate: ${s}`)}
            onFinish={(mode: 'chat' | 'classic') => { note(`finish: ${mode}`); setRunning(false); }}
            idx={step}
            setIdx={setStep}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
