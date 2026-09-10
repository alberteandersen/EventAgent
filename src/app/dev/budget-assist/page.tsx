"use client";

/* Harness for BudgetAvaAssistant — the modal Ava opens with a real
   recommendation. Fetch is stubbed so the loading/ready/error states and the
   apply action can all be checked without a live Gemini call or a signed-in
   session; the API route's own arithmetic is covered separately by
   src/lib/budget/advice.test.ts. */

import { useEffect, useRef, useState } from 'react';
import { LanguageProvider } from '@/kalas/i18n';
import BudgetAvaAssistant from '@/kalas/screens/BudgetAvaAssistant';

const SAMPLE = {
  headline: 'Med 225.000 kr og 80 gæster på Fyn er der plads til et rigtigt godt sted uden at gå på kompromis med maden.',
  total: 225000,
  lines: [
    { category: 'venue', label: 'Venue & leje', pct: 33, amount: 74250, rationale: 'Fyn har flere gårde og gods i denne prisklasse med plads til 80.' },
    { category: 'catering', label: 'Mad & drikke', pct: 30, amount: 67500, rationale: 'I har allerede lagt 60.000 kr her — vi runder op, ikke ned.' },
    { category: 'photo', label: 'Foto & film', pct: 10, amount: 22500, rationale: 'En hel dag med fotograf er realistisk i det bånd.' },
    { category: 'florals', label: 'Blomster & dekoration', pct: 9, amount: 20250, rationale: 'Sæsonblomster i juni holder prisen nede.' },
    { category: 'music', label: 'Musik & underholdning', pct: 7, amount: 15750, rationale: 'DJ frem for liveband holder budgettet i ro.' },
    { category: 'attire', label: 'Tøj & beauty', pct: 7, amount: 15750, rationale: '' },
    { category: 'misc', label: 'Invitationer & andet', pct: 4, amount: 9000, rationale: '' },
  ],
  tips: [
    'Book venuet først — resten af budgettet retter sig efter datoen og stedet.',
    'Et bryllup i juni på Fyn ligger i højsæson — spørg om ledige hverdage for en bedre pris.',
    'Sæt 5-10 % til side som buffer; det plejer at gå til noget, I ikke havde regnet med.',
  ],
};

type Mode = 'ready' | 'error' | 'slow';

export default function DevBudgetAssistPage() {
  const [mode, setMode] = useState<Mode>('ready');
  const [open, setOpen] = useState(true);
  // The modal's own effect fires its fetch as soon as it mounts — before a
  // child-then-parent effect order would install the stub above — so mounting
  // waits for this flag instead of a bare `useEffect(() => {...}, [])`.
  const [stubbed, setStubbed] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  // Mode lives in a ref, not state: the stub reads it at call time, and a ref
  // (unlike a `let` closed over once) stays current without reinstalling fetch.
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Stub fetch for exactly the one endpoint this component calls, once.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/budget/assist')) {
        const current = modeRef.current;
        if (current === 'slow') await new Promise((r) => setTimeout(r, 60000));
        if (current === 'error') {
          return new Response(JSON.stringify({ error: 'Ava kunne ikke regne på budgettet lige nu.' }), { status: 500 });
        }
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }
      return real(input, init);
    }) as typeof fetch;
    // A timeout, not a direct call: the lint rule for setState-in-effect
    // wants an async callback here, not a synchronous cascade.
    const id = window.setTimeout(() => setStubbed(true), 0);
    return () => { window.fetch = real; window.clearTimeout(id); };
  }, []);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas p-8 text-ink">
        <p className="eyebrow mb-4">Dev · BudgetAvaAssistant</p>
        <div className="flex gap-2">
          {(['ready', 'error', 'slow'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setOpen(false); setTimeout(() => setOpen(true), 30); }}
              className="rounded-full border border-line px-3 py-1.5 text-[0.78rem] font-semibold hover:border-ink cursor-pointer"
            >
              {m}
            </button>
          ))}
        </div>
        <pre className="mt-6 text-[12px] text-ink-soft">{log.join('\n') || 'ingen handling endnu'}</pre>

        {stubbed && open && (
          <BudgetAvaAssistant
            eventId="dev-event"
            guests={80}
            region="Fyn"
            onClose={() => { note('close'); setOpen(false); }}
            onApply={(lines) => note(`apply: ${JSON.stringify(lines)}`)}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
