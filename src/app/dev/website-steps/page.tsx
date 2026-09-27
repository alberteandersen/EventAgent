"use client";

/* Harness for WebsiteSteps, the Design tab's panel, without a signed-in
   wedding. The panel takes plain props, so the wedding behind it is a few
   lines of state here: a vibe becomes a template version, uploads become
   object URLs, and a build waits a moment and saves a built version. The
   two boxes at the top make the next build fail or hit the paywall, to check
   the panel stays put with the words still in the box.

   The query string opens it part-way in, with what a couple would have by
   then: ?vibe=nordisk&photos=4&step=brief, plus &built=1 for a site that has
   been built, and &stale=1 for one whose words are older than Indhold. A step already open at load shows without its entry animation,
   which is also what lets the harness be driven from a background tab. */

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LangSwitch, LanguageProvider, useLang } from '@/kalas/i18n';
import WebsiteSteps, { type DesignStep } from '@/kalas/screens/WebsiteSteps';
import { findPreset } from '@/kalas/site/presets';
import { DEFAULT_DESIGN, parseSiteDesign } from '@/kalas/site/design';
import { IMAGES } from '@/kalas/images';
import type { SitePhotoRow, WebsiteDesignRow } from '@/lib/db/types';

const SAMPLE_PHOTOS = [IMAGES.florals, IMAGES.olive, IMAGES.candles, IMAGES.arch];
const STEP_IDS: DesignStep[] = ['vibe', 'photos', 'brief'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const designRow = (patch: Partial<WebsiteDesignRow>): WebsiteDesignRow => ({
  id: `d${Date.now()}`, event_id: 'dev', user_id: 'dev', brief: {}, design: {}, html: null,
  active: true, created_at: new Date().toISOString(), ...patch,
});

const photoRow = (id: string): SitePhotoRow => ({
  id, event_id: 'dev', user_id: 'dev', storage_path: `dev/${id}.jpg`, kind: 'upload', role: 'gallery',
  section: null, sort: 0, created_at: new Date().toISOString(),
});

/** What the query string asks the harness to start with. */
function seedFrom(params: { get: (name: string) => string | null }) {
  const preset = findPreset(params.get('vibe') ?? '');
  const built = Boolean(preset && params.get('built'));
  const designs: WebsiteDesignRow[] = [];
  if (preset) {
    const tokens = preset.design;
    if (built) {
      designs.push(designRow({
        id: 'd-built', html: '<p>bygget</p>',
        brief: { preset: preset.id, styleDirection: 'Varme farver, store billeder af os' },
        design: { ...tokens, concept: { ...tokens.concept, name: `${tokens.concept.name} · Ava` } } as unknown as Record<string, unknown>,
      }));
    }
    designs.push(designRow({
      id: 'd-template', brief: { preset: preset.id }, active: !built,
      design: tokens as unknown as Record<string, unknown>,
    }));
  }
  const count = Math.min(Number(params.get('photos')) || 0, 24);
  const photos = Array.from({ length: count }, (_, i) => photoRow(`seed-${i}`));
  const photoUrls = Object.fromEntries(photos.map((p, i) => [p.id, SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length]]));
  const step = STEP_IDS.find((s) => s === params.get('step')) ?? null;
  const stale = built && Boolean(params.get('stale'));
  return { designs, photos, photoUrls, step, stale };
}

export default function DevWebsiteStepsPage() {
  return (
    <LanguageProvider initialLang="da">
      {/* useSearchParams needs a boundary, or the build refuses to prerender. */}
      <Suspense>
        <Harness />
      </Suspense>
    </LanguageProvider>
  );
}

function Harness() {
  const { lang, setLang } = useLang();
  const params = useSearchParams();
  const [seed] = useState(() => seedFrom(params));
  const [designs, setDesigns] = useState<WebsiteDesignRow[]>(seed.designs);
  const [photos, setPhotos] = useState<SitePhotoRow[]>(seed.photos);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(seed.photoUrls);
  const [step, setStep] = useState<DesignStep | null>(seed.step);
  // As in Website.tsx: the box holds the last words given to Ava until
  // something is typed.
  const [briefDraft, setBriefDraft] = useState<string | null>(null);
  const savedBrief = useMemo(
    () => designs.map((d) => d.brief.styleDirection).find((s): s is string => typeof s === 'string' && s !== '') ?? '',
    [designs]
  );
  const [working, setWorking] = useState<null | 'generate' | 'refine' | 'sync'>(null);
  const [stale, setStale] = useState(seed.stale);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [payNext, setPayNext] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  const active = designs.find((d) => d.active) ?? null;
  const design = active ? parseSiteDesign(active.design) : DEFAULT_DESIGN;

  // Newest first, like websiteDesigns in the app.
  const addVersion = (patch: Partial<WebsiteDesignRow>) =>
    setDesigns((prev) => [designRow(patch), ...prev.map((d) => ({ ...d, active: false }))]);

  const applyPreset = async (presetId: string) => {
    note(`stemning: ${presetId}`);
    setApplyingPreset(presetId);
    await wait(300);
    const preset = findPreset(presetId);
    addVersion({ brief: { preset: presetId }, design: (preset?.design ?? DEFAULT_DESIGN) as unknown as Record<string, unknown> });
    setApplyingPreset(null);
  };

  const build = async (text: string) => {
    note(`byg: "${text}"`);
    setGenError(null);
    if (payNext) { setNeedsPayment(true); return false; }
    setWorking('generate');
    await wait(1500);
    setWorking(null);
    if (failNext) {
      setGenError('Ava kunne ikke designe siden lige nu, prøv igen.');
      return false;
    }
    addVersion({
      brief: { ...(active?.brief ?? {}), styleDirection: text },
      design: { ...design, concept: { ...design.concept, name: `${design.concept.name} · Ava` } } as unknown as Record<string, unknown>,
      html: '<p>bygget</p>',
    });
    return true;
  };

  const refine = async (instruction: string) => {
    note(`justér: "${instruction}"`);
    setWorking('refine');
    await wait(1200);
    setWorking(null);
    if (active) addVersion({ brief: active.brief, design: active.design, html: `${active.html ?? ''}<p>${instruction}</p>` });
  };

  const syncContent = async () => {
    note('opdatér teksten');
    setWorking('sync');
    await wait(1200);
    setWorking(null);
    setStale(false);
  };

  const restart = async () => {
    note('start forfra');
    setRestarting(true);
    await wait(600);
    setDesigns([]);
    setRestarting(false);
  };

  const addPhotos = (urls: string[]) => {
    const rows = urls.map((_, i) => photoRow(`p${Date.now()}-${i}`));
    setPhotos((prev) => [...prev, ...rows]);
    setPhotoUrls((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r, i) => [r.id, urls[i]])) }));
  };

  const box = 'rounded-full border border-line bg-card px-3 py-1.5 text-[0.78rem] font-semibold hover:border-ink cursor-pointer';

  return (
    <div className="theme-kalas min-h-screen bg-canvas text-ink">
      <div className="flex flex-wrap items-center gap-3 rule-b px-6 py-4 sm:px-9 lg:px-12">
        <p className="eyebrow mr-auto">Dev · WebsiteSteps</p>
        <LangSwitch lang={lang} onSelect={setLang} />
        <button type="button" className={box} onClick={() => addPhotos(SAMPLE_PHOTOS)}>
          + 4 billeder
        </button>
        <label className="flex items-center gap-1.5 text-[0.78rem]">
          <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Byg fejler
        </label>
        <label className="flex items-center gap-1.5 text-[0.78rem]">
          <input type="checkbox" checked={payNext} onChange={(e) => setPayNext(e.target.checked)} /> Kræver betaling
        </label>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px]">
        <div className="px-6 py-10 sm:px-9 lg:px-12 lg:py-12 lg:rule-r">
          {/* Stand-in for the live preview: what the site would be showing. */}
          <div className="rounded-2xl rule p-6" style={{ background: design.palette.bg, color: design.palette.text }}>
            <p className="text-[0.7rem] uppercase tracking-[0.14em]" style={{ color: design.palette.accent }}>
              {active ? (active.html ? 'Bygget side' : 'Skabelon') : 'Intet design endnu'}
            </p>
            <p className="mt-2 font-serif text-[2rem] leading-tight">{design.concept.name}</p>
            <p className="mt-2 text-[0.85rem]" style={{ color: design.palette.muted }}>
              {String(active?.brief?.styleDirection ?? '')}
            </p>
          </div>
          <pre className="mt-6 whitespace-pre-wrap text-[12px] text-ink-soft">{log.join('\n') || 'ingen handling endnu'}</pre>
        </div>

        <div className="rule-t lg:rule-t-0 px-6 py-10 sm:px-9 lg:py-12">
          <WebsiteSteps
            step={step}
            onStep={setStep}
            brief={briefDraft ?? savedBrief}
            onBrief={setBriefDraft}
            hasDesign={Boolean(active)}
            hasHtml={Boolean(active?.html)}
            design={design}
            designs={designs}
            activePresetId={(active?.brief as { preset?: string } | undefined)?.preset ?? null}
            photos={photos}
            photoUrls={photoUrls}
            working={working}
            applyingPreset={applyingPreset}
            restarting={restarting}
            genError={genError}
            needsPayment={needsPayment}
            websitePaid={false}
            onApplyPreset={(id) => void applyPreset(id)}
            onBuild={build}
            onRefine={(text) => void refine(text)}
            onRestart={() => void restart()}
            onCheckout={() => { note('checkout'); setNeedsPayment(false); setPayNext(false); }}
            onUpload={(files) => { note(`upload: ${files.length}`); addPhotos(Array.from(files).map((f) => URL.createObjectURL(f))); }}
            onDeletePhoto={(id) => { note(`slet: ${id}`); setPhotos((prev) => prev.filter((p) => p.id !== id)); }}
            onSetHero={(id) => setPhotos((prev) => prev.map((p) => ({ ...p, role: p.id === id ? 'hero' : 'gallery' })))}
            content={{ on: 7, todo: 2 }}
            onOpenContent={() => note('til indhold')}
            contentStale={stale}
            onSyncContent={() => void syncContent()}
          />
        </div>
      </div>
    </div>
  );
}
