"use client";

/* Harness for ClassicWalkthrough — the real component against stand-in nav
   rows carrying the same `data-tour` values as Shell, so the ring and the
   click-to-advance can be exercised without a signed-in wedding. */

import { useState } from 'react';
import ClassicWalkthrough from '@/kalas/ClassicWalkthrough';
import RichText from '@/kalas/chat/RichText';
import { LanguageProvider } from '@/kalas/i18n';
import { WALKTHROUGH_KEY } from '@/kalas/walkthrough';
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
  // Armed during init so ClassicWalkthrough reads step 0 on its first render.
  const [running, setRunning] = useState(() => {
    try { localStorage.setItem(WALKTHROUGH_KEY, '0'); } catch { /* ignore */ }
    return true;
  });
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
        <p className="eyebrow mb-6">Dev · ClassicWalkthrough</p>

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
          <ClassicWalkthrough
            params={{ city: 'Fyn', guests: 80, foodBudget: '85.000', dateHint: 'juni 2027' }}
            onNavigate={(s: ScreenId) => note(`navigate: ${s}`)}
            onAskAva={(p) => note(`askAva: ${p}`)}
            onFinish={(mode) => { note(`finish: ${mode}`); setRunning(false); }}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
