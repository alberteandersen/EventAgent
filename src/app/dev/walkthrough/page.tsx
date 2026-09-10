"use client";

/* Harness for GuidedTour — the real component against stand-in nav
   rows carrying the same `data-tour` values as Shell, so the ring and the
   click-to-advance can be exercised without a signed-in wedding. */

import { useState } from 'react';
import GuidedTour from '@/kalas/GuidedTour';
import { tourFact } from '@/kalas/tourFacts';
import { WALKTHROUGH_STEPS } from '@/kalas/walkthrough';
import RichText from '@/kalas/chat/RichText';
import { LanguageProvider } from '@/kalas/i18n';
import type { ScreenId } from '@/kalas/Shell';

/* The anchors are page regions now, not nav items. These stand in for the
   small-to-medium ones; the globe gets its own large block below, since a
   region that fills the page is the case the card placement has to survive. */
const ANCHORS: { id: string; label: string }[] = [
  { id: 'budget-categories', label: 'Budget · kategorier' },
  { id: 'guests-rsvp', label: 'Gæster · RSVP' },
  { id: 'planning-content', label: 'Tidslinje · indhold' },
  { id: 'inbox-threads', label: 'Inbox · tråde' },
  { id: 'website-preview', label: 'Hjemmeside · forhåndsvisning' },
  { id: 'ava-chat', label: 'Ava · chat' },
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

        {/* The globe: a region filling most of the page. The card must retreat
            to a corner here rather than land in the middle of it. */}
        <div
          data-tour="team-globe"
          className="mb-4 flex h-[min(58vh,520px)] w-full max-w-[980px] items-center justify-center rounded-[28px] border border-line bg-shell"
        >
          <span className="text-[0.8rem] text-muted">team-globe · stor region</span>
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

        <pre className="mt-8 text-[12px] text-ink-soft">{log.join('\n') || 'ingen klik endnu'}</pre>

        <p className="eyebrow mt-12 mb-3">Dev · RichText (Avas velkomst)</p>
        <div className="max-w-[520px] rounded-3xl rounded-bl-lg rule bg-card px-5 py-3.5 text-[0.97rem] leading-relaxed text-ink">
          <RichText text={SAMPLE} />
        </div>

        {running && (
          <GuidedTour
            params={{ city: 'Fyn', guests: 80, foodBudget: '85.000', dateHint: 'juni 2027' }}
            onNavigate={(s: ScreenId) => note(`navigate: ${s}`)}
            onFinish={(mode: 'chat' | 'classic') => { note(`finish: ${mode}`); setRunning(false); }}
            fact={tourFact(WALKTHROUGH_STEPS[step].id, {
              region: 'Fyn',
              guestEstimate: 75,
              budgetTotal: 225000,
              dateISO: '2028-05-20',
              venues: [{ category: 'venue', swipe_status: 'liked' }],
              guests: [],
              tasks: [{ title: 'Book fotograf', due_date: '2026-10-12', done: false }],
              unreadReplies: 2,
            })}
            idx={step}
            setIdx={setStep}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
