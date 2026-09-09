"use client";

/* Harness for the Takkekort tab. The real screen is behind login, and what
   is worth checking here is that the invitation templates render the
   past-tense wording without a venue line — the one thing the reuse could
   have got wrong. */

import { useState } from 'react';
import { PhoneFrame, ScaledPhone } from '@/kalas/invitations/PhoneFrame';
import { templatesByGroup } from '@/kalas/invitations/templates';
import { useInvitationFonts } from '@/kalas/invitations/fonts';
import { LanguageProvider } from '@/kalas/i18n';
import { thankCardData } from '@/kalas/screens/nygift/thankCard';

const INPUT = {
  partnerA: 'Alberte',
  partnerB: 'Espen',
  isoDate: '2027-06-12T15:00:00',
  venue: 'Broholm Slot',
  venueDetail: 'Gudme, Fyn',
  language: 'da' as const,
};

function Cards() {
  useInvitationFonts();
  const [note, setNote] = useState('');
  const groups = templatesByGroup();

  return (
    <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
      <p className="eyebrow mb-4">Dev · Takkekort</p>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Jeres egen hilsen"
        className="mb-8 w-full max-w-md rounded-2xl rule bg-card px-4 py-3 text-[0.92rem] text-ink"
      />

      {groups.map((g) => (
        <section key={g.group} className="mb-10">
          <p className="eyebrow mb-3">{g.label}</p>
          <div className="flex flex-wrap gap-6">
            {g.templates.map((tpl) => (
              <div key={tpl.id} data-card={tpl.id} className="flex flex-col items-center gap-2">
                <ScaledPhone width={168}>
                  <PhoneFrame>
                    <tpl.Component data={thankCardData(tpl, { ...INPUT, personalNote: note })} />
                  </PhoneFrame>
                </ScaledPhone>
                <span className="text-[0.78rem] text-ink-soft">{tpl.name}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function DevTakkekortPage() {
  return (
    <LanguageProvider initialLang="da">
      <Cards />
    </LanguageProvider>
  );
}
