"use client";

/* Harness for GuidedTour — the real component against stand-in nav
   rows carrying the same `data-tour` values as Shell, so the ring and the
   click-to-advance can be exercised without a signed-in wedding. */

import { useState } from 'react';
import GuidedTour from '@/kalas/GuidedTour';
import RichText from '@/kalas/chat/RichText';
import { LanguageProvider } from '@/kalas/i18n';
import type { ScreenId } from '@/kalas/Shell';

const ANCHORS: { id: string; label: string }[] = [
  { id: 'team', label: 'Venue & leverandører' },
  { id: 'budget', label: 'Budget' },
  { id: 'guests', label: 'Gæster' },
  { id: 'planning', label: 'Tidslinje & tjekliste' },
  { id: 'inbox', label: 'Inbox' },
];

const SAMPLE = `Hej Alberte & Espen! Jeg er Ava, jeres bryllupsplanlægger.

Her er hvad jeg har indtil videre:

- Denmark
- Forår 2028
- omkring 75 gæster

Venuet forankrer alt det andet — blomster, musik og catering er alle lokale til det, så det er det første, der er værd at få på plads.

Skal jeg begynde at researche venues nær **Denmark**?`;

export default function DevWalkthroughPage() {
  const [running, setRunning] = useState(true);
  // The step lives with the parent in the app too, so the harness mirrors that.
  const [step, setStep] = useState(0);
  // Stands in for "Ava finished the prompt this step handed her".
  const [doneTick, setDoneTick] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
        <p className="eyebrow mb-6">Dev · GuidedTour</p>

        {/* Stand-in for the home hero: a wide target, which is the case the
            card's placement has to get out of the way of. */}
        <div data-tour="home-hero" className="mb-4 flex h-[120px] max-w-[520px] items-center rounded-[20px] border border-line bg-shell px-6">
          <span className="font-serif text-[1.4rem] text-ink">Alberte &amp; Espen · 584 dage</span>
        </div>

        <div className="flex max-w-[240px] flex-col gap-1">
          <button data-tour="home-checklist" className="rounded-[10px] border border-line px-3 py-2.5 text-left text-sm font-semibold">
            Kom godt i gang
          </button>
          {ANCHORS.map((a) => (
            <button
              key={a.id}
              data-tour={a.id}
              onClick={() => note(`klik: ${a.id}`)}
              className="rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold hover:bg-shell"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Stand-in for the chat column the tour points at while Ava works. */}
        <div data-tour="ava-chat" className="mt-6 flex h-[90px] max-w-[280px] items-center rounded-[16px] rule bg-shell px-4">
          <span className="text-[13px] text-ink-soft">Ava-samtalen</span>
        </div>

        <button
          type="button"
          onClick={() => setDoneTick((n) => n + 1)}
          className="mt-6 rounded-full border border-line px-3 py-1.5 text-[0.78rem] font-semibold hover:border-ink cursor-pointer"
        >
          Simulér: Ava blev færdig
        </button>

        <pre className="mt-8 text-[12px] text-ink-soft">{log.join('\n') || 'ingen klik endnu'}</pre>

        <p className="eyebrow mt-12 mb-3">Dev · RichText (Avas velkomst)</p>
        <div className="max-w-[520px] rounded-3xl rounded-bl-lg rule bg-card px-5 py-3.5 text-[0.97rem] leading-relaxed text-ink">
          <RichText text={SAMPLE} />
        </div>

        {running && (
          <GuidedTour
            params={{ city: 'Fyn', guests: 80, foodBudget: '85.000', dateHint: 'juni 2027' }}
            onNavigate={(s: ScreenId) => note(`navigate: ${s}`)}
            onAskAva={(p: string) => note(`askAva: ${p}`)}
            onFinish={(mode: 'chat' | 'classic') => { note(`finish: ${mode}`); setRunning(false); }}
            promptDoneTick={doneTick}
            idx={step}
            setIdx={setStep}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
