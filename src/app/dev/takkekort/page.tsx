"use client";

/* Harness for the Takkekort tab: the thank-you card in every vibe, as it
   follows the couple's invitation. The real screen is behind login, and what
   is worth checking here is that each of the six compositions carries the
   past-tense words, their own greeting and no venue line — the things the
   reuse could have got wrong. The query string sets the boxes:
   ?photo=0&long=1&en=1. */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import { SITE_PRESETS } from '@/kalas/site/presets';
import { IMAGES } from '@/kalas/data';
import { InvitePreview } from '@/kalas/invitations/InvitePreview';
import type { InviteContent } from '@/kalas/invitations/content';
import { thankContent, thankWords } from '@/kalas/screens/nygift/thankCard';

const INVITATION: InviteContent = {
  partnerA: 'Alberte',
  partnerB: 'Espen',
  date: '2027-06-12',
  time: '14:00',
  venue: 'Broholm Slot',
  venueDetail: 'Gudme, Fyn',
  rsvpBy: '2027-04-01',
  note: 'Dresscode: festligt.',
  language: 'da',
};

function Cards() {
  const params = useSearchParams();
  const [photo, setPhoto] = useState(params.get('photo') !== '0');
  const [long, setLong] = useState(params.get('long') === '1');
  const [en, setEn] = useState(params.get('en') === '1');
  const [note, setNote] = useState('');
  const content = thankContent({
    ...INVITATION,
    ...(long ? { partnerA: 'Christoffer', partnerB: 'Anne-Katrine' } : {}),
    language: en ? 'en' : 'da',
  }, note);

  return (
    <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
      <h1 className="font-serif text-3xl">Takkekort</h1>
      <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} /> Photo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={long} onChange={(e) => setLong(e.target.checked)} /> Long names</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={en} onChange={(e) => setEn(e.target.checked)} /> English</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Jeres egen hilsen"
          className="w-full max-w-md rounded-2xl rule bg-card px-4 py-2 text-[0.92rem] text-ink"
        />
      </div>
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-6 gap-y-12">
        {SITE_PRESETS.map((p) => (
          <div key={p.id} data-card={p.id} className="flex flex-col items-center gap-3">
            <InvitePreview
              html={null}
              htmlFontsHref={null}
              design={p.design}
              content={content}
              photoUrl={photo ? IMAGES.florals : null}
              width={250}
              title={p.label}
              thanks={thankWords(content.language)}
            />
            <p className="text-sm">{p.label} · <span className="text-muted">{p.design.hero.variant}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DevTakkekortPage() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense>
        <Cards />
      </Suspense>
    </LanguageProvider>
  );
}
