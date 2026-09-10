"use client";

/* Harness for GuestDialog — the real guest screen sits behind
   useWedding()/Supabase, but the dialog takes plain props, so both modes can
   be driven here: adding from empty, and editing an existing guest whose
   dietary needs were typed by hand before the chips existed. */

import { useState } from 'react';
import { LanguageProvider } from '@/kalas/i18n';
import GuestDialog, { type GuestDraft } from '@/kalas/screens/GuestDialog';
import type { GuestRow } from '@/lib/db/types';

const EXISTING: GuestRow = {
  id: 'g1', event_id: 'dev', user_id: 'dev',
  name: 'Mette Holm', side: 'Alberte', email: 'mette@eksempel.dk', phone: '+45 20 11 22 33',
  rsvp: 'ja', meal: null, plus_one: true, plus_one_name: 'Jonas Holm',
  notes: null,
  // Typed by hand before the chips existed — the dialog should light up the
  // two it recognises and keep the rest as free text.
  dietary: 'vegetar, ingen skaldyr',
  dietary_tags: [],
  relation: null, overnight: false, no_alcohol: false,
  responded_at: new Date().toISOString(), rsvp_token: 'tok', created_at: new Date().toISOString(),
};

export default function DevGuestDialogPage() {
  const [mode, setMode] = useState<'add' | 'edit' | null>('edit');
  const [log, setLog] = useState<string[]>([]);
  const note = (l: string) => setLog((x) => [...x, l]);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-[#f4f5f3] px-6 py-8 text-ink">
        <p className="eyebrow mb-4">Dev · GuestDialog</p>
        <div className="flex gap-2">
          {(['add', 'edit'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(null); setTimeout(() => setMode(m), 30); }}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-[0.78rem] font-semibold hover:border-ink cursor-pointer">
              {m}
            </button>
          ))}
        </div>
        <pre className="mt-6 max-w-3xl whitespace-pre-wrap text-[12px] text-ink-soft">
          {log.join('\n') || 'ingen handling endnu'}
        </pre>

        {mode && (
          <GuestDialog
            guest={mode === 'edit' ? EXISTING : null}
            sides={['Fælles', 'Alberte', 'Espen']}
            onClose={() => { note('close'); setMode(null); }}
            onSave={(d: GuestDraft) => note('save: ' + JSON.stringify(d, null, 1))}
            onDelete={mode === 'edit' ? () => { note('delete'); setMode(null); } : undefined}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
