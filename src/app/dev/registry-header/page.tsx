"use client";

/* Harness for the ønskeliste header's layout. HeroPhoto used to bake the home
   hero's 380px width into itself, so it burst out of this narrower column and
   covered the couple's name — this page is where that framing is checked
   without needing a signed-in wedding. */

import { LanguageProvider } from '@/kalas/i18n';
import { WeddingProvider } from '@/kalas/useWedding';
import HeroPhoto from '@/kalas/screens/home/HeroPhoto';

const PHOTO =
  'https://cdn.wonder.so/images/019d9110-e1f2-74f3-85e8-c89f82be5a63/6d0cada0901a800c9f43a2cf68a9d52f6cf2620687565337240b2d069d261834.jpg';

export default function DevRegistryHeaderPage() {
  return (
    <LanguageProvider initialLang="da">
      <WeddingProvider>
        <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
          <p className="eyebrow mb-6">Dev · Ønskeliste-header</p>

          <div className="flex flex-col gap-6 rounded-[28px] border border-line bg-card p-6 sm:flex-row sm:items-start sm:p-7">
            <HeroPhoto
              fallback={PHOTO}
              alt="Alberte & Espen"
              className="sm:w-[200px]"
              frameClassName="h-[180px] sm:h-[200px]"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="eyebrow">Ønskeliste</p>
              <h1 className="font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-ink">
                Alberte &amp; Espen
              </h1>
              <p className="text-[0.95rem] leading-relaxed text-ink-soft">
                Skriv et par ord til jeres gæster — hvad I ønsker jer, og hvad I helst er fri for.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.82rem] text-muted">12 ønsker på listen</span>
                <span className="rounded-full border border-line-strong px-3 py-1.5 text-[0.78rem] font-semibold">
                  Del listen
                </span>
                <span className="px-2.5 py-1.5 text-[0.78rem] text-muted">Vis reservationer</span>
              </div>
            </div>
          </div>

          <p className="eyebrow mt-12 mb-3">Til sammenligning · hero-rammen</p>
          <div className="flex flex-col gap-8 rounded-[28px] border border-line bg-shell p-7 lg:flex-row">
            <HeroPhoto fallback={PHOTO} alt="Alberte & Espen" />
            <div className="flex flex-1 flex-col justify-center gap-3">
              <p className="eyebrow">Brylluppet for</p>
              <h2 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-[1.05] text-ink">Alberte &amp; Espen</h2>
            </div>
          </div>
        </div>
      </WeddingProvider>
    </LanguageProvider>
  );
}
