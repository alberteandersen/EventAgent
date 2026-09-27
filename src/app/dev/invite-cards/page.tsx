"use client";

/* Harness for the invitation cards: every vibe's own design over its sample
   painting, as the builder shows it the moment a vibe is picked. The real
   builder is behind login; what is worth checking here is that the type sits
   well on each painting, with long names, in English and landscape, and that
   the exports come out as the screen shows. The query string sets the boxes:
   ?format=7x5&long=1&en=1. ?try=1 shows the card scripts/try-card-design.mts
   last made with Ava, instead of the vibes. */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import { CardView } from '@/kalas/invitations/card/CardView';
import { CARD_FORMATS, findFormat } from '@/kalas/invitations/card/formats';
import { CARD_VIBES, findVibe, sampleArt, starterSpec } from '@/kalas/invitations/card/vibes';
import { parseCardSpec, type CardSpec } from '@/kalas/invitations/card/spec';
import { cardFileName, exportCardPng, exportCardPptx } from '@/kalas/invitations/card/exportCard';
import type { InviteContent } from '@/kalas/invitations/content';
import { IMAGES } from '@/kalas/images';

const BASE: InviteContent = {
  partnerA: 'Samira',
  partnerB: 'Rufus',
  date: '2027-06-12',
  time: '14:00',
  venue: 'Broholm Slot',
  venueDetail: 'Gudme, Fyn',
  rsvpBy: '2027-04-01',
  note: '',
  language: 'da',
};

function Cards() {
  const params = useSearchParams();
  const [format, setFormat] = useState(findFormat(params.get('format')).id);
  const [long, setLong] = useState(params.get('long') === '1');
  const [en, setEn] = useState(params.get('en') === '1');
  const content: InviteContent = {
    ...BASE,
    ...(long ? { partnerA: 'Christoffer', partnerB: 'Anne-Katrine', note: 'Dresscode: festligt. Vi danser til den lyse morgen.' } : {}),
    language: en ? 'en' : 'da',
  };
  const f = findFormat(format);

  const [tried, setTried] = useState<CardSpec | null>(null);
  useEffect(() => {
    if (params.get('try') !== '1') return;
    void fetch(`/invitations/dev-try.json?${Date.now()}`).then((r) => r.json()).then((raw: { vibe?: string; format?: string }) =>
      setTried(parseCardSpec(raw, starterSpec(findVibe(raw.vibe), findFormat(raw.format), 'da'))));
  }, [params]);
  if (tried) {
    return (
      <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
        <p className="mb-6 font-serif text-2xl">{tried.conceptName} · Ava</p>
        <div className={tried.format === '7x5' ? 'max-w-[760px]' : 'max-w-[520px]'}>
          <CardView spec={tried} content={content} artUrl={`/invitations/dev-try.png?${tried.conceptName.length}`} title="Ava" />
        </div>
      </div>
    );
  }

  return (
    <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
      <h1 className="font-serif text-3xl">Invitation cards</h1>
      <div className="mt-4 flex flex-wrap gap-5 text-sm">
        {CARD_FORMATS.map((cf) => (
          <label key={cf.id} className="flex items-center gap-2">
            <input type="radio" checked={format === cf.id} onChange={() => setFormat(cf.id)} /> {cf.label}
          </label>
        ))}
        <label className="flex items-center gap-2"><input type="checkbox" checked={long} onChange={(e) => setLong(e.target.checked)} /> Long names + note</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={en} onChange={(e) => setEn(e.target.checked)} /> English</label>
      </div>
      <div className={`mt-10 grid gap-x-8 gap-y-12 ${f.widthIn > f.heightIn ? 'grid-cols-[repeat(auto-fill,minmax(420px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))]'}`}>
        {CARD_VIBES.map((v) => {
          const spec = starterSpec(v, f, content.language);
          const job = { spec, content, artUrl: sampleArt(v.id, f.id), photoUrl: IMAGES.portrait, fileName: `${cardFileName(content)}-${v.id}` };
          return (
            <div key={v.id} className="flex flex-col gap-3">
              <div className="overflow-hidden shadow-[0_20px_40px_-24px_rgba(0,0,0,0.5)]">
                <CardView spec={spec} content={content} artUrl={sampleArt(v.id, f.id)} photoUrl={IMAGES.portrait} title={v.label} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{v.label} · <span className="text-muted">{v.placement}</span></span>
                <span className="flex gap-3">
                  <button type="button" data-export="png" data-vibe={v.id} className="underline" onClick={() => void exportCardPng(job)}>PNG</button>
                  <button type="button" data-export="pptx" data-vibe={v.id} className="underline" onClick={() => void exportCardPptx(job)}>PPTX</button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <LanguageProvider>
      <Suspense>
        <Cards />
      </Suspense>
    </LanguageProvider>
  );
}
