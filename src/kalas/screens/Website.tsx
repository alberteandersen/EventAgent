import { useState, useId, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, Globe, Smartphone, Plus, Trash2, Palette, Loader2, Upload,
  Lock, Copy, Eye, MapPin, Gift, HelpCircle, Bed, History, Star,
  Camera, Clock, BookOpen, Image, QrCode, ChevronDown, RotateCcw,
} from 'lucide-react';
import { IMAGES as IMG, guests } from '../data';
import { Eyebrow, Toggle, cn } from '../ui';
import { useWedding, type Couple } from '../useWedding';
import { SiteRenderer } from '../site/SiteRenderer';
import {
  parseConfig, slugify, INIT_SECTIONS, INIT_PROGRAM, INIT_FAQ, INIT_HOTELS, GALLERY_KEYS,
  type SiteConfig, type ProgramEvent, type FAQItem, type HotelItem, type SectionId, type SectionMeta,
} from '../site/config';
import { parseSiteDesign, DEFAULT_DESIGN, type SiteDesign } from '../site/design';
import { googleFontsHref, fontStack, SITE_FONTS } from '../site/fonts';
import { resolveHtml, familiesInHtml } from '@/lib/website/resolveHtml';
import { SITE_PRESETS } from '../site/presets';
import { normalizeImage } from '../site/normalizeImage';
import { websitePriceDkk } from '@/lib/website/pricing';
import type { SitePhotoRow, WebsiteDesignRow } from '@/lib/db/types';
import { useLang } from '../i18n';
import { EMPTY_CONTACT, withAllSections, type GuestContact } from '../site/config';
import { ContactEditor, GuestbookModeration, QrBlock, SeatFinderInfo, SiteOverview } from './website/HubPanels';
import { BookHeart, Armchair, UserRound } from 'lucide-react';

type WTab = 'design' | 'indhold' | 'indstillinger';

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
export default function Website() {
  const { t } = useLang();
  const {
    couple, loading, event, weddingSite, saveSite, venues,
    websiteDesign, websiteDesigns, sitePhotos, websitePaid, refresh,
  } = useWedding();
  const [tab,      setTab]      = useState<WTab>('design');

  /* Sections */
  const [sections, setSections] = useState<SectionMeta[]>(INIT_SECTIONS);
  /* Sections that get an Ava-generated illustration in the build. */
  const [aiImages, setAiImages] = useState<SectionId[]>(['dresscode', 'transport', 'gifts']);

  /* Content */
  const [heroTagline,  setHeroTagline]  = useState(`Kom og fejr dagen med os`);
  const [storyText,    setStoryText]    = useState(`Vi mødte hinanden på en tilfældig tirsdag og har ikke kunnet slippe hinanden siden. Den ${couple.dateLabel} siger vi ja foran alle dem, vi holder af.`);
  const [countdown,    setCountdown]    = useState(true);
  const [program,      setProgram]      = useState<ProgramEvent[]>(INIT_PROGRAM);
  const [rsvpDeadline, setRsvpDeadline] = useState('2026-08-01');
  const [rsvpPlusOne,  setRsvpPlusOne]  = useState(true);
  const [rsvpMeal,     setRsvpMeal]     = useState(true);
  const [rsvpDietary,  setRsvpDietary]  = useState(true);
  const [galleryKeys,  setGalleryKeys]  = useState<Set<keyof typeof IMG>>(new Set(['florals', 'olive', 'candles', 'arch']));
  const [transport,    setTransport]    = useState('Sonnerupgaard Gods, Sonnerupvej 8, 4060 Kirke Såby');
  const [dresscode,    setDresscode]    = useState('Festligt og elegant. Vi elsker at se jer klædt på til fejring. Kvinder bedes venligst undgå hvid eller cremefarvet.');
  const [giftsText,    setGiftsText]    = useState('Din tilstedeværelse er vores største gave. Har du lyst til at give noget, sætter vi stor pris på bidrag til vores bryllupsrejse.');
  const [giftsUrl,     setGiftsUrl]     = useState('');
  const [faq,          setFaq]          = useState<FAQItem[]>(INIT_FAQ);
  const [hotels,       setHotels]       = useState<HotelItem[]>(INIT_HOTELS);
  const [contact,      setContact]      = useState<GuestContact>(EMPTY_CONTACT);

  /* Publish */
  const [domain,      setDomain]      = useState(`${slugify(couple.a)}-${slugify(couple.b)}`);
  const [published,   setPublished]   = useState(false);
  const [pwProtected, setPwProtected] = useState(false);
  const [sitePassword,setSitePassword]= useState('');
  const [copied,      setCopied]      = useState(false);
  const [hideBranding,setHideBranding]= useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [mobileView,  setMobileView]  = useState(false);
  const [showRsvp,    setShowRsvp]    = useState(false);

  // ── Persistence ──────────────────────────────────────────────────────
  // Hydrate the whole builder from the saved config once the wedding loads,
  // then autosave the config (debounced) as the couple edits.
  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current || loading) return;
    readyRef.current = true;
    const c = (weddingSite?.config ?? {}) as Record<string, unknown>;
    if (weddingSite && Object.keys(c).length > 0) {
      // Sections added since the site was saved (the guest hub) join in off.
      if (Array.isArray(c.sections)) setSections(withAllSections(c.sections as SectionMeta[]));
      if (Array.isArray(c.aiImages)) setAiImages(c.aiImages as SectionId[]);
      if (typeof c.heroTagline === 'string') setHeroTagline(c.heroTagline);
      if (typeof c.storyText === 'string') setStoryText(c.storyText);
      if (typeof c.countdown === 'boolean') setCountdown(c.countdown);
      if (Array.isArray(c.program)) setProgram(c.program as ProgramEvent[]);
      if (typeof c.rsvpDeadline === 'string') setRsvpDeadline(c.rsvpDeadline);
      if (typeof c.rsvpPlusOne === 'boolean') setRsvpPlusOne(c.rsvpPlusOne);
      if (typeof c.rsvpMeal === 'boolean') setRsvpMeal(c.rsvpMeal);
      if (typeof c.rsvpDietary === 'boolean') setRsvpDietary(c.rsvpDietary);
      if (Array.isArray(c.galleryKeys)) setGalleryKeys(new Set(c.galleryKeys as (keyof typeof IMG)[]));
      if (typeof c.transport === 'string') setTransport(c.transport);
      if (typeof c.dresscode === 'string') setDresscode(c.dresscode);
      if (typeof c.giftsText === 'string') setGiftsText(c.giftsText);
      if (typeof c.giftsUrl === 'string') setGiftsUrl(c.giftsUrl);
      if (Array.isArray(c.faq)) setFaq(c.faq as FAQItem[]);
      if (Array.isArray(c.hotels)) setHotels(c.hotels as HotelItem[]);
      if (c.contact && typeof c.contact === 'object') setContact({ ...EMPTY_CONTACT, ...(c.contact as Partial<GuestContact>) });
      if (typeof c.pwProtected === 'boolean') setPwProtected(c.pwProtected);
      if (typeof c.sitePassword === 'string') setSitePassword(c.sitePassword);
      if (typeof c.hideBranding === 'boolean') setHideBranding(c.hideBranding);
    }
    if (weddingSite?.domain) setDomain(weddingSite.domain);
    if (weddingSite) setPublished(weddingSite.published);
  }, [loading, weddingSite]);

  const config = useMemo(
    () => ({
      sections, aiImages, heroTagline, storyText, countdown,
      program, rsvpDeadline, rsvpPlusOne, rsvpMeal, rsvpDietary, galleryKeys: [...galleryKeys],
      transport, dresscode, giftsText, giftsUrl, faq, hotels, contact, pwProtected, sitePassword, hideBranding,
    }),
    [sections, aiImages, heroTagline, storyText, countdown, program,
     rsvpDeadline, rsvpPlusOne, rsvpMeal, rsvpDietary, galleryKeys, transport, dresscode,
     giftsText, giftsUrl, faq, hotels, contact, pwProtected, sitePassword, hideBranding]
  );

  useEffect(() => {
    if (!readyRef.current) return;
    const saveTimer = setTimeout(() => { void saveSite({ config, domain, published }); }, 800);
    return () => clearTimeout(saveTimer);
  }, [config, domain, published, saveSite]);

  const toggleSection = (id: SectionId) =>
    setSections((prev) => prev.map((s) => s.id === id && !s.locked ? { ...s, enabled: !s.enabled } : s));

  const publicPath = `/w/${domain}`;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── AI design state ──────────────────────────────────────────────────
  const design: SiteDesign = useMemo(
    () => (websiteDesign ? parseSiteDesign(websiteDesign.design) : DEFAULT_DESIGN),
    [websiteDesign]
  );

  // Signed preview URLs for the couple's photos (bucket is private).
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoIdsKey = sitePhotos.map((p) => p.id).join(',');
  useEffect(() => {
    if (!event) return;
    let alive = true;
    fetch(`/api/website/photos?eventId=${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photos?: (SitePhotoRow & { url: string | null })[] } | null) => {
        if (!alive || !d?.photos) return;
        setPhotoUrls(Object.fromEntries(d.photos.filter((p) => p.url).map((p) => [p.id, p.url as string])));
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, photoIdsKey]);

  const [working, setWorking] = useState<null | 'generate' | 'refine'>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);

  const callDesignApi = async (path: string, body: Record<string, unknown>, kind: 'generate' | 'refine') => {
    if (!event) return;
    setWorking(kind);
    setGenError(null);
    try {
      const res = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, ...body }),
      });
      if (res.status === 402) { setNeedsPayment(true); return; }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setGenError(data.message ?? data.error ?? 'Noget gik galt. Prøv igen.');
        return;
      }
      await refresh();
    } catch {
      setGenError('Noget gik galt. Prøv igen.');
    } finally {
      setWorking(null);
    }
  };

  const generateDesign = (styleDirection: string, fresh = false) =>
    callDesignApi('/api/website/design', { styleDirection, fresh }, 'generate');
  const refineDesign = (instruction: string) =>
    callDesignApi('/api/website/design/refine', { instruction }, 'refine');

  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const applyPreset = async (presetId: string) => {
    if (!event || applyingPreset) return;
    setApplyingPreset(presetId);
    setGenError(null);
    try {
      await fetch('/api/website/design/preset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, presetId }),
      });
      await refresh();
    } finally {
      setApplyingPreset(null);
    }
  };

  const activateDesign = async (designId: string) => {
    await fetch('/api/website/design/activate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId }),
    }).catch(() => {});
    await refresh();
  };

  const [restarting, setRestarting] = useState(false);
  const restartDesign = async () => {
    if (!event || restarting) return;
    const ok = window.confirm(
      t('Start forfra? Jeres designs og Ava-genererede billeder slettes. Jeres egne uploads beholdes.')
    );
    if (!ok) return;
    setRestarting(true);
    setGenError(null);
    try {
      const res = await fetch('/api/website/design/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setGenError(data.error ?? 'Kunne ikke starte forfra. Prøv igen.');
        return;
      }
      await refresh();
    } catch {
      setGenError('Kunne ikke starte forfra. Prøv igen.');
    } finally {
      setRestarting(false);
    }
  };

  const startCheckout = async () => {
    if (!event) return;
    const res = await fetch('/api/website/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id }),
    }).catch(() => null);
    if (!res) return;
    if (res.status === 503) { setNeedsPayment(false); return; } // Stripe not configured → unlocked
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    if (data.url) window.location.href = data.url;
  };

  // Back from Stripe: land on this screen and poll until the webhook lands.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('website_checkout')) return;
    const success = params.get('website_checkout') === 'success';
    params.delete('website_checkout');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    if (!success) return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      void refresh();
      if (tries >= 8) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPhotos = async (files: FileList | File[]) => {
    if (!event) return;
    let failed = 0;
    for (const raw of Array.from(files)) {
      // HEIC (iPhone) and oversized photos are re-encoded in the browser.
      const file = await normalizeImage(raw);
      if (!file) { failed += 1; continue; }
      const form = new FormData();
      form.append('file', file);
      form.append('eventId', event.id);
      await fetch('/api/website/photos', { method: 'POST', body: form }).catch(() => { failed += 1; });
    }
    if (failed > 0) {
      setGenError(
        failed === 1
          ? t('{n} billede kunne ikke uploades. Prøv et andet format.', { n: failed })
          : t('{n} billeder kunne ikke uploades. Prøv et andet format.', { n: failed }),
      );
    }
    await refresh();
  };

  const deletePhoto = async (photoId: string) => {
    await fetch(`/api/website/photos/${photoId}`, { method: 'DELETE' }).catch(() => {});
    await refresh();
  };

  const setHeroPhoto = async (photoId: string) => {
    await fetch(`/api/website/photos/${photoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'hero' }),
    }).catch(() => {});
    await refresh();
  };

  const previewConfig = useMemo(() => parseConfig(config), [config]);

  // Model-built HTML (aliases → preview URLs, fonts detected from markup).
  const activeHtml = websiteDesign?.html ?? null;
  const previewHtml = useMemo(() => {
    if (!activeHtml) return null;
    const aliases = ((websiteDesign?.brief as { imageAliases?: Record<string, string> })?.imageAliases) ?? {};
    const venue = venues.find((v) => v.id === event?.chosen_venue_id) ?? null;
    const venueUrls = venue
      ? [venue.image_url, ...(venue.photo_urls ?? [])].filter((u): u is string => Boolean(u))
      : [];
    const map: Record<string, string> = {};
    for (const [alias, source] of Object.entries(aliases)) {
      if (source.startsWith('photo:')) {
        const u = photoUrls[source.slice(6)];
        if (u) map[alias] = u;
      } else if (source.startsWith('venue:')) {
        const u = venueUrls[Number(source.slice(6))];
        if (u) map[alias] = u;
      }
    }
    return resolveHtml(activeHtml, map);
  }, [activeHtml, websiteDesign, venues, event?.chosen_venue_id, photoUrls]);

  const htmlFontsHref = useMemo(() => {
    if (!activeHtml) return null;
    const fams = familiesInHtml(activeHtml, SITE_FONTS.map((f) => f.family));
    const ids = SITE_FONTS.filter((f) => fams.includes(f.family)).map((f) => f.id);
    return ids.length > 0 ? googleFontsHref(ids) : null;
  }, [activeHtml]);

  // Per-section generated image thumbnails for the content-tab toggles.
  const sectionThumb = (id: SectionId): string | null => {
    const p = sitePhotos.find((x) => x.role === 'section' && x.section === id);
    return p ? photoUrls[p.id] ?? null : null;
  };
  const aiToggle = (id: SectionId) => ({
    on: aiImages.includes(id),
    onChange: (v: boolean) =>
      setAiImages((prev) => (v ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))),
    thumb: sectionThumb(id),
  });

  const preview = (
    <ScaledPreview
      domain={domain}
      couple={couple}
      config={previewConfig}
      design={design}
      photoUrls={photoUrls}
      html={previewHtml}
      htmlFontsHref={htmlFontsHref}
      mobile={mobileView}
      onRsvp={() => setShowRsvp(true)}
    />
  );

  return (
    <div className="min-h-screen">

      {/* ── Sticky tab header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-canvas/95 backdrop-blur-md rule-b">
        <div className="flex items-center justify-between px-6 pt-5 sm:px-9 lg:px-12">
          <div className="flex items-end gap-8 pb-0">
            {([
              { id: 'design',         label: t('Design')         },
              { id: 'indhold',        label: t('Indhold')        },
              { id: 'indstillinger',  label: t('Indstillinger')  },
            ] as const).map(({ id, label }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} className="relative pb-4 cursor-pointer group">
                  <span className={cn('font-serif text-[clamp(1.2rem,2vw,1.6rem)] leading-none transition-colors',
                    active ? 'text-ink' : 'text-muted/50 group-hover:text-ink/60')}>
                    {label}
                  </span>
                  {active && (
                    <motion.span layoutId="website-underline"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-ink rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={() => setPublished((v) => !v)}
            className={cn(
              'mb-3 h-8 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-all cursor-pointer',
              published ? 'bg-sage text-ink' : 'bg-ink text-canvas hover:bg-ink/80',
            )}>
            {published ? t('● Live') : t('Publicér')}
          </button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === 'design' && (
          <motion.div key="design"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid lg:grid-cols-[1fr_400px] lg:min-h-[calc(100vh-76px)]">

            {/* Left: live preview */}
            <div className="px-6 py-10 sm:px-9 lg:px-12 lg:py-12 lg:rule-r">
              <div className="sticky top-20">
                <div className="flex items-center justify-between mb-5">
                  <p className="eyebrow">{t('Live forhåndsvisning')}</p>
                  <button onClick={() => setMobileView((v) => !v)}
                    className={cn('flex items-center gap-1.5 text-[0.72rem] transition-colors cursor-pointer',
                      mobileView ? 'text-ink font-medium' : 'text-muted hover:text-ink')}>
                    <Smartphone size={12} /> {mobileView ? t('Desktop') : t('Mobil')}
                  </button>
                </div>
                <div className={cn('transition-all duration-300', mobileView && 'mx-auto w-full max-w-[390px]')}>
                  {preview}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 rule rounded-xl bg-shell overflow-hidden">
                    <input value={domain}
                      onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="bg-transparent pl-4 pr-1 py-2 text-[0.82rem] text-ink focus:outline-none w-28"
                    />
                    <span className="pr-4 text-[0.78rem] text-muted">{t('.kalas.dk')}</span>
                  </div>
                  {published && (
                    <p className="text-[0.72rem] text-sage">{t('● Siden er live')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Ava design studio */}
            <div className="rule-t lg:rule-t-0 px-6 py-10 sm:px-9 lg:py-12 overflow-y-auto">
              <DesignStudio
                hasDesign={Boolean(websiteDesign)}
                hasHtml={Boolean(websiteDesign?.html)}
                design={design}
                designs={websiteDesigns}
                activeId={websiteDesign?.id ?? null}
                activePresetId={(websiteDesign?.brief as { preset?: string } | null)?.preset ?? null}
                photos={sitePhotos}
                photoUrls={photoUrls}
                working={working}
                applyingPreset={applyingPreset}
                restarting={restarting}
                genError={genError}
                needsPayment={needsPayment}
                websitePaid={websitePaid}
                onApplyPreset={applyPreset}
                onGenerate={generateDesign}
                onRefine={refineDesign}
                onActivate={activateDesign}
                onRestart={restartDesign}
                onCheckout={startCheckout}
                onUpload={uploadPhotos}
                onDeletePhoto={deletePhoto}
                onSetHero={setHeroPhoto}
              />
            </div>
          </motion.div>
        )}

        {tab === 'indhold' && (
          <motion.div key="indhold"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid lg:grid-cols-[1fr_380px] lg:min-h-[calc(100vh-76px)]">

            {/* Left: section editors */}
            <div className="px-6 py-10 sm:px-9 lg:px-12 lg:py-12 space-y-3 lg:rule-r">
              <div className="mb-8">
                <Eyebrow>{t('Sektioner')}</Eyebrow>
                <p className="mt-2 text-[0.88rem] text-muted">{t('Tænd/sluk sektioner og rediger indholdet. Siden opdateres til højre.')}</p>
              </div>

              {/* HERO */}
              <SectionCard id="hero" section={sections.find((s) => s.id === 'hero')!} onToggle={toggleSection}
                icon={<Image size={15} />}>
                <Label>{t('Navne')}</Label>
                <p className="rule rounded-xl bg-shell px-4 py-3 text-[0.88rem] text-ink">{couple.a} & {couple.b}</p>
                <p className="mt-1 text-[0.7rem] text-muted">{t('Fra jeres profil · redigér under Indstillinger')}</p>
                <div className="mt-4">
                  <Label>{t('Velkomstbesked')}</Label>
                  <Textarea value={heroTagline} onChange={setHeroTagline} rows={2} placeholder={t('Kom og fejr dagen med os')} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Label>{t('Nedtælling til brylluppet')}</Label>
                  <Toggle value={countdown} onChange={setCountdown} />
                </div>
              </SectionCard>

              {/* VORES HISTORIE */}
              <SectionCard id="story" section={sections.find((s) => s.id === 'story')!} onToggle={toggleSection} ai={aiToggle('story')}
                icon={<BookOpen size={15} />}>
                <Label>{t('Jeres historie')}</Label>
                <Textarea value={storyText} onChange={setStoryText} rows={5}
                  placeholder={t('Fortæl gæsterne jeres historie…')} />
                <p className="mt-2 text-[0.7rem] text-muted">{t('Ava har skrevet et udkast. Tilpas det som I ønsker.')}</p>
              </SectionCard>

              {/* PROGRAM */}
              <SectionCard id="program" section={sections.find((s) => s.id === 'program')!} onToggle={toggleSection} ai={aiToggle('program')}
                icon={<Clock size={15} />}>
                <Label>{t('Programpunkter')}</Label>
                <div className="mt-1 space-y-2">
                  {program.map((ev) => (
                    <div key={ev.id} className="flex gap-2 items-start">
                      <input value={ev.time} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, time: e.target.value } : x))}
                        className="w-16 shrink-0 rounded-lg rule bg-card px-2 py-1.5 text-[0.82rem] text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink/20"
                        placeholder={t('00:00')} />
                      <div className="flex-1 space-y-1.5">
                        <input value={ev.label} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, label: e.target.value } : x))}
                          className="w-full rounded-lg rule bg-card px-3 py-1.5 text-[0.82rem] text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                          placeholder={t('Programpunkt')} />
                        <input value={ev.sublabel} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, sublabel: e.target.value } : x))}
                          className="w-full rounded-lg bg-transparent px-3 py-1 text-[0.74rem] text-muted focus:outline-none"
                          placeholder={t('Sted / detalje (valgfrit)')} />
                      </div>
                      <button onClick={() => setProgram((p) => p.filter((x) => x.id !== ev.id))}
                        className="mt-1.5 shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setProgram((p) => [...p, { id: `e${Date.now()}`, time: '', label: '', sublabel: '' }])}
                    className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer mt-2">
                    <Plus size={14} /> {t('Tilføj programpunkt')}
                  </button>
                </div>
              </SectionCard>

              {/* RSVP */}
              <SectionCard id="rsvp" section={sections.find((s) => s.id === 'rsvp')!} onToggle={toggleSection} ai={aiToggle('rsvp')}
                icon={<Check size={15} />}>
                <div className="space-y-4">
                  <div>
                    <Label>{t('RSVP-deadline')}</Label>
                    <input type="date" value={rsvpDeadline} onChange={(e) => setRsvpDeadline(e.target.value)}
                      className="mt-1 rounded-lg rule bg-card px-3 py-2 text-[0.85rem] text-ink focus:outline-none w-full" />
                  </div>
                  <ToggleRow label={t('+1 tilladet')} value={rsvpPlusOne} onChange={setRsvpPlusOne} />
                  <ToggleRow label={t('Måltidsvalg (vegetar/standard)')} value={rsvpMeal} onChange={setRsvpMeal} />
                  <ToggleRow label={t('Allergier & kostbehov')} value={rsvpDietary} onChange={setRsvpDietary} />
                </div>
                <p className="mt-4 text-[0.72rem] text-muted">{t('Svar synkroniseres automatisk med jeres gæsteliste.')}</p>
              </SectionCard>

              {/* GALLERI */}
              <SectionCard id="gallery" section={sections.find((s) => s.id === 'gallery')!} onToggle={toggleSection}
                icon={<Camera size={15} />}>
                <Label>{t('Vælg billeder til galleriet')}</Label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {GALLERY_KEYS.map((key) => {
                    const on = galleryKeys.has(key);
                    return (
                      <button key={key} onClick={() => setGalleryKeys((prev) => {
                        const n = new Set(prev);
                        on ? n.delete(key) : n.add(key);
                        return n;
                      })}
                        className={cn('relative aspect-square overflow-hidden rounded-xl cursor-pointer transition-all',
                          on ? 'ring-2 ring-ink ring-offset-1 ring-offset-canvas' : 'opacity-50 hover:opacity-75')}>
                        <img src={IMG[key]} alt="" className="h-full w-full object-cover" />
                        {on && (
                          <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
                            <Check size={14} className="text-canvas" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[0.7rem] text-muted">{t('{n} billeder valgt · Fra jeres moodboard', { n: galleryKeys.size })}</p>
              </SectionCard>

              {/* TRANSPORT */}
              <SectionCard id="transport" section={sections.find((s) => s.id === 'transport')!} onToggle={toggleSection} ai={aiToggle('transport')}
                icon={<MapPin size={15} />}>
                <Label>{t('Adresse')}</Label>
                <Textarea value={transport} onChange={setTransport} rows={2} placeholder={t('Venue-navn, adresse, postnummer')} />
                <p className="mt-2 text-[0.7rem] text-muted">{t('Ava tilføjer automatisk et kort-link til gæsterne.')}</p>
              </SectionCard>

              {/* DRESSCODE */}
              <SectionCard id="dresscode" section={sections.find((s) => s.id === 'dresscode')!} onToggle={toggleSection} ai={aiToggle('dresscode')}
                icon={<Eye size={15} />}>
                <Label>{t('Dresscode-tekst')}</Label>
                <Textarea value={dresscode} onChange={setDresscode} rows={3} placeholder={t('Beskriv dresscode og ønsker…')} />
              </SectionCard>

              {/* GAVEØNSKER */}
              <SectionCard id="gifts" section={sections.find((s) => s.id === 'gifts')!} onToggle={toggleSection} ai={aiToggle('gifts')}
                icon={<Gift size={15} />}>
                <div className="space-y-4">
                  <div>
                    <Label>{t('Tekst til gæsterne')}</Label>
                    <Textarea value={giftsText} onChange={setGiftsText} rows={3} placeholder={t('Ingen ønskeliste, bryllupsrejse, eller link til registrering…')} />
                  </div>
                  <div>
                    <Label>{t('Ønskeliste-link (valgfrit)')}</Label>
                    <input value={giftsUrl} onChange={(e) => setGiftsUrl(e.target.value)}
                      placeholder={t('https://...')}
                      className="mt-1 w-full rounded-lg rule bg-card px-3 py-2 text-[0.82rem] text-ink placeholder:text-muted focus:outline-none" />
                  </div>
                </div>
              </SectionCard>

              {/* OVERNATNING */}
              <SectionCard id="hotel" section={sections.find((s) => s.id === 'hotel')!} onToggle={toggleSection} ai={aiToggle('hotel')}
                icon={<Bed size={15} />}>
                <Label>{t('Anbefalede hoteller')}</Label>
                <div className="mt-1 space-y-2">
                  {hotels.map((h) => (
                    <div key={h.id} className="rule rounded-xl bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1.5">
                          <input value={h.name} onChange={(e) => setHotels((prev) => prev.map((x) => x.id === h.id ? { ...x, name: e.target.value } : x))}
                            className="w-full text-[0.85rem] font-medium text-ink bg-transparent focus:outline-none border-b border-[var(--color-line)] pb-0.5"
                            placeholder={t('Hotelnavn')} />
                          <div className="flex gap-3">
                            <input value={h.dist} onChange={(e) => setHotels((prev) => prev.map((x) => x.id === h.id ? { ...x, dist: e.target.value } : x))}
                              className="flex-1 text-[0.75rem] text-muted bg-transparent focus:outline-none" placeholder={t('Afstand')} />
                            <input value={h.price} onChange={(e) => setHotels((prev) => prev.map((x) => x.id === h.id ? { ...x, price: e.target.value } : x))}
                              className="flex-1 text-[0.75rem] text-muted bg-transparent focus:outline-none" placeholder={t('Pris')} />
                          </div>
                        </div>
                        <button onClick={() => setHotels((prev) => prev.filter((x) => x.id !== h.id))}
                          className="shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setHotels((prev) => [...prev, { id: `h${Date.now()}`, name: '', dist: '', price: '' }])}
                    className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer">
                    <Plus size={14} /> {t('Tilføj hotel')}
                  </button>
                </div>
              </SectionCard>

              {/* FAQ */}
              <SectionCard id="faq" section={sections.find((s) => s.id === 'faq')!} onToggle={toggleSection} ai={aiToggle('faq')}
                icon={<HelpCircle size={15} />}>
                <Label>{t('Spørgsmål & svar')}</Label>
                <div className="mt-1 space-y-3">
                  {faq.map((item) => (
                    <div key={item.id} className="rule rounded-xl bg-card p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input value={item.q}
                            onChange={(e) => setFaq((f) => f.map((x) => x.id === item.id ? { ...x, q: e.target.value } : x))}
                            className="w-full text-[0.82rem] font-medium text-ink bg-transparent border-b border-[var(--color-line)] pb-0.5 focus:outline-none"
                            placeholder={t('Spørgsmål…')} />
                          <textarea value={item.a} rows={2}
                            onChange={(e) => setFaq((f) => f.map((x) => x.id === item.id ? { ...x, a: e.target.value } : x))}
                            className="w-full resize-none text-[0.78rem] text-muted bg-transparent focus:outline-none leading-relaxed"
                            placeholder={t('Svar…')} />
                        </div>
                        <button onClick={() => setFaq((f) => f.filter((x) => x.id !== item.id))}
                          className="mt-0.5 shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setFaq((f) => [...f, { id: `f${Date.now()}`, q: '', a: '' }])}
                    className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer">
                    <Plus size={14} /> {t('Tilføj spørgsmål')}
                  </button>
                </div>
              </SectionCard>

              {/* DEL BILLEDER */}
              <SectionCard id="photos" section={sections.find((s) => s.id === 'photos')!} onToggle={toggleSection}
                icon={<Camera size={15} />}>
                <p className="text-[0.84rem] text-muted leading-relaxed">
                  {t('Gæsterne får en knap til at uploade egne billeder. Alle billeder samles i jeres private galleri.')}
                </p>
                {/* The upload page is live at /w/{domain}/del; the photos land
                   in the album under Nygift. A code on the tables is how most
                   guests will find it. */}
                <div className="mt-3 flex items-center gap-4 rule rounded-xl bg-shell px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8rem] text-ink">{t('QR-kode til bordene')}</p>
                    <p className="mt-0.5 text-[0.72rem] text-muted">
                      {published
                        ? t('Gæsterne scanner den og uploader deres billeder til jeres album under Nygift.')
                        : t('Koden virker, når siden er udgivet.')}
                    </p>
                  </div>
                  <QrBlock url={`${publicUrl}/del`} caption={t('Del jeres billeder med os')} size={84} />
                </div>
              </SectionCard>

              {/* GÆSTEKONTAKT */}
              <SectionCard id="contact" section={sections.find((s) => s.id === 'contact')!} onToggle={toggleSection}
                icon={<UserRound size={15} />}>
                <ContactEditor value={contact} onChange={setContact} />
              </SectionCard>

              {/* FIND MIN PLADS */}
              <SectionCard id="seat" section={sections.find((s) => s.id === 'seat')!} onToggle={toggleSection}
                icon={<Armchair size={15} />}>
                <SeatFinderInfo />
              </SectionCard>

              {/* GÆSTEBOG */}
              <SectionCard id="guestbook" section={sections.find((s) => s.id === 'guestbook')!} onToggle={toggleSection}
                icon={<BookHeart size={15} />}>
                <GuestbookModeration />
              </SectionCard>
            </div>

            {/* Right: mini preview (desktop only) */}
            <div className="hidden lg:block px-8 py-12 rule-t lg:rule-t-0">
              <div className="sticky top-20">
                <p className="eyebrow mb-5">{t('Live forhåndsvisning')}</p>
                {preview}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'indstillinger' && (
          <motion.div key="indstillinger"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="px-6 py-10 sm:px-9 lg:px-12 max-w-2xl">

            <Eyebrow className="mb-8">{t('Publicering & indstillinger')}</Eyebrow>

            <div className="space-y-8">

              {/* Overblik: where the site stands before anything else. */}
              <SiteOverview
                published={published}
                onTogglePublished={() => setPublished((v) => !v)}
                previewHref={publicPath}
              />

              {/* Domæne */}
              <section className="rule rounded-2xl bg-card p-6">
                <p className="font-serif text-[1.15rem] text-ink mb-1">{t('Domæne')}</p>
                <p className="text-[0.8rem] text-muted mb-4">{t('Jeres side er tilgængelig på denne adresse.')}</p>
                <div className="flex items-center gap-2 rule rounded-xl bg-shell overflow-hidden">
                  <input value={domain}
                    onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 bg-transparent pl-4 py-2.5 text-[0.88rem] text-ink focus:outline-none"
                  />
                  <span className="pr-4 text-[0.82rem] text-muted">{t('.kalas.dk')}</span>
                </div>
                <p className="mt-2 text-[0.7rem] text-muted">{t('Kun bogstaver, tal og bindestreger.')}</p>
              </section>

              {/* Publicer */}
              <section className="rule rounded-2xl bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-[1.15rem] text-ink">{t('Publicering')}</p>
                    <p className="mt-1 text-[0.8rem] text-muted">
                      {published ? t('Jeres side er live og tilgængelig for gæster.') : t('Siden er ikke offentlig endnu.')}
                    </p>
                  </div>
                  <button onClick={() => setPublished((v) => !v)}
                    className={cn('shrink-0 rounded-full px-5 py-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] transition-all cursor-pointer',
                      published ? 'bg-sage text-ink' : 'bg-ink text-canvas hover:bg-ink/80')}>
                    {published ? t('● Live') : t('Publicér')}
                  </button>
                </div>
                {published && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 rule rounded-xl bg-shell overflow-hidden">
                    <Globe size={13} className="ml-3 shrink-0 text-muted" />
                    <a href={publicPath} target="_blank" rel="noopener noreferrer"
                      className="flex-1 truncate py-2.5 text-[0.82rem] text-ink font-mono hover:underline">{publicUrl.replace(/^https?:\/\//, '')}</a>
                    <a href={publicPath} target="_blank" rel="noopener noreferrer"
                      className="mr-1 shrink-0 text-[0.72rem] text-muted hover:text-ink transition-colors">{t('Se live ↗')}</a>
                    <button onClick={copyLink}
                      className="flex items-center gap-1.5 mr-3 text-[0.72rem] text-muted hover:text-ink transition-colors cursor-pointer">
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? t('Kopieret') : t('Kopiér')}
                    </button>
                  </motion.div>
                )}
              </section>

              {/* Adgangskode */}
              <section className="rule rounded-2xl bg-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lock size={15} className="text-muted" />
                    <p className="font-serif text-[1.15rem] text-ink">{t('Adgangskode')}</p>
                  </div>
                  <Toggle value={pwProtected} onChange={setPwProtected} />
                </div>
                <p className="text-[0.8rem] text-muted mb-4">{t('Gæsterne skal indtaste en kode for at se siden.')}</p>
                <AnimatePresence>
                  {pwProtected && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      className="overflow-hidden">
                      <input type="text" value={sitePassword}
                        onChange={(e) => setSitePassword(e.target.value)}
                        placeholder={t('Vælg en kode til gæsterne')}
                        className="w-full rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Del link */}
              <section className="rule rounded-2xl bg-card p-6">
                <p className="flex items-center gap-2 font-serif text-[1.15rem] text-ink mb-1"><QrCode size={15} className="text-muted" /> {t('Del med gæsterne')}</p>
                <p className="text-[0.8rem] text-muted mb-4">{t('Send linket i invitationen eller print QR-koden.')}</p>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="rule rounded-xl bg-shell px-4 py-2.5 text-[0.82rem] font-mono text-ink truncate">
                      {publicUrl.replace(/^https?:\/\//, '')}
                    </div>
                    <button onClick={copyLink}
                      className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? t('Kopieret!') : t('Kopiér link')}
                    </button>
                  </div>
                  <QrBlock url={publicUrl} caption={t('Vores bryllup')} />
                </div>
              </section>

              {/* Kalas branding */}
              <section className="rule rounded-2xl bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-[1.15rem] text-ink">{t('Kalas-branding')}</p>
                    <p className="mt-1 text-[0.8rem] text-muted">
                      {t('Et diskret "Lavet med Kalas" vises i bunden af jeres side, og hjælper andre par med at finde Kalas.')}
                    </p>
                  </div>
                  {websitePaid
                    ? <Toggle value={!hideBranding} onChange={(v) => setHideBranding(!v)} />
                    : <span className="shrink-0 rounded-full bg-sage-tint px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink">{t('Inkluderet i køb')}</span>
                  }
                </div>
                {!websitePaid && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rule rounded-xl bg-shell px-4 py-3 flex items-center justify-between gap-4">
                    <p className="text-[0.78rem] text-muted">{t('Branding fjernes når I låser Ava-designeren op')}</p>
                    <button onClick={() => void startCheckout()}
                      className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                      {t('Lås op · {price} kr', { price: websitePriceDkk() })}
                    </button>
                  </motion.div>
                )}
              </section>

              {/* Statistik */}
              <section className="rule rounded-2xl bg-card p-6">
                <p className="font-serif text-[1.15rem] text-ink mb-4">{t('Statistik')}</p>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl rule bg-[var(--color-line)]">
                  {/* Only real numbers. There is no analytics anywhere in the
                      app, so page views cannot be shown honestly. */}
                  {[
                    { label: t('Gæster inviteret'), value: published ? String(guests.length) : '-' },
                    { label: t('RSVP modtaget'),   value: published ? String(guests.filter((g) => g.rsvp !== 'afventer').length) : '-' },
                    { label: t('Siger ja'),        value: published ? String(guests.filter((g) => g.rsvp === 'ja').length) : '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card px-4 py-5 text-center">
                      <div className="font-serif text-[1.6rem] text-ink">{value}</div>
                      <div className="mt-1 text-[0.62rem] uppercase tracking-[0.14em] text-muted">{label}</div>
                    </div>
                  ))}
                </div>
                {!published && <p className="mt-3 text-[0.72rem] text-muted text-center">{t('Publicér siden for at se statistik')}</p>}
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RSVP confirmation overlay (simulates what guest sees) ──────── */}
      <AnimatePresence>
        {showRsvp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-5"
            onClick={() => setShowRsvp(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rule rounded-3xl bg-canvas overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.28)]"
            >
              {/* Confirmation */}
              <div className="px-8 py-9 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-tint mb-5">
                  <Check size={24} className="text-ink" />
                </div>
                <p className="font-serif text-[1.7rem] text-ink leading-tight">{t('Tak for dit svar!')}</p>
                <p className="mt-2 text-[0.88rem] text-muted">{t('{a} & {b} glæder sig til at se dig den {date}.', { a: couple.a, b: couple.b, date: couple.dateLabel })}</p>
              </div>

              {/* Viral CTA */}
              <div className="rule-t px-8 py-7 bg-shell/60">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                  {t('{a} & {b} bruger', { a: couple.a, b: couple.b })}
                </p>
                <p className="font-serif text-[1.2rem] text-ink leading-snug">
                  {t('Planlægger I selv bryllup?')}<br />
                  <span className="italic">{t('Ava gør arbejdet for jer.')}</span>
                </p>
                <p className="mt-2 text-[0.8rem] text-muted">{t('Tidslinje, venues, budget og bryllupsside på én platform.')}</p>
                <button
                  onClick={() => { setShowRsvp(false); setShowLanding(true); }}
                  className="mt-5 w-full rounded-2xl py-3.5 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-canvas hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ background: 'var(--color-ink)' }}
                >
                  {t('Prøv Kalas gratis →')}
                </button>
                <button onClick={() => setShowRsvp(false)}
                  className="mt-3 w-full text-center text-[0.72rem] text-muted hover:text-ink transition-colors cursor-pointer">
                  {t('Nej tak')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Kalas landing overlay (simulates guest click) ─────────────── */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-5"
            onClick={() => setShowLanding(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rule rounded-3xl bg-canvas px-8 py-10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.28)]"
            >
              <p className="font-serif text-[2rem] leading-tight text-ink">
                {t('Planlæg jeres bryllup.')}<br /><span className="italic">{t('Ava gør arbejdet.')}</span>
              </p>
              <p className="mt-3 text-[0.88rem] text-muted leading-relaxed">
                {t('{a} & {b} bruger Kalas til at planlægge deres store dag. Kom i gang på 2 minutter.', { a: couple.a, b: couple.b })}
              </p>

              <div className="mt-7 space-y-3">
                {[
                  { n: t('Tidslinje på 2 minutter'), d: t('14 milepæle planlagt baglæns fra bryllupsdagen') },
                  { n: t('3 venues fundet'),          d: t('Ava matchede til budget og stil, ingen Google') },
                  { n: t('Invitationer klar'),         d: t('Udkast skrevet og klar til godkendelse på dag 1') },
                ].map(({ n, d }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-sage-tint flex items-center justify-center">
                      <Check size={11} className="text-ink" />
                    </div>
                    <div>
                      <p className="text-[0.88rem] font-medium text-ink">{n}</p>
                      <p className="text-[0.75rem] text-muted">{d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="mt-8 w-full rounded-2xl py-4 text-[0.8rem] font-bold uppercase tracking-[0.18em] text-canvas hover:opacity-90 transition-opacity cursor-pointer"
                style={{ background: 'var(--color-ink)' }}
                onClick={() => setShowLanding(false)}
              >
                {t('Start gratis, ingen kreditkort')}
              </button>
              <p className="mt-3 text-center text-[0.7rem] text-muted">
                {t('Én gang · 499 kr ved launch · normalt 799 kr')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section card (collapsible) ──────────────────────────────────────── */
function SectionCard({
  id, section, onToggle, icon, children, ai,
}: {
  id: SectionId;
  section: SectionMeta;
  onToggle: (id: SectionId) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** AI-illustration toggle for this section (step 2 of the build). */
  ai?: { on: boolean; onChange: (v: boolean) => void; thumb?: string | null };
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(section.enabled && !section.locked);
  const fieldId = useId();

  return (
    <div className={cn('rule rounded-2xl overflow-hidden transition-all',
      section.enabled ? 'bg-card' : 'bg-card/50 opacity-70')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={cn('shrink-0 transition-colors', section.enabled ? 'text-ink' : 'text-muted')}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[1rem] text-ink leading-tight">{t(section.label)}</p>
          <p className="text-[0.7rem] text-muted mt-0.5">{t(section.desc)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {section.locked ? (
            <span className="text-[0.6rem] uppercase tracking-[0.1em] text-muted">{t('Altid')}</span>
          ) : (
            <button onClick={() => onToggle(id)} aria-label={section.enabled ? t('Sluk') : t('Tænd')}
              aria-checked={section.enabled} role="switch" id={fieldId}
              className={cn('relative h-5 w-9 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
                section.enabled ? 'bg-ink' : 'bg-shell')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-canvas shadow-sm transition-all duration-200',
                section.enabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </button>
          )}
          <button onClick={() => setOpen((v) => !v)}
            className="text-muted hover:text-ink transition-colors cursor-pointer"
            aria-label={open ? t('Luk') : t('Åbn')}>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
              <ChevronDown size={16} />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            <div className="rule-t px-5 pb-5 pt-4">
              {children}
              {ai && (
                <div className="mt-4 rule-t pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {ai.thumb ? (
                        <img src={ai.thumb} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-shell">
                          <Palette size={13} className="text-muted" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[0.82rem] text-ink">{t('AI-billede')}</p>
                        <p className="text-[0.68rem] text-muted truncate">
                          {ai.thumb ? t('Genereret, genbruges i næste byg') : t('Ava genererer en illustration til sektionen')}
                        </p>
                      </div>
                    </div>
                    <Toggle value={ai.on} onChange={ai.onChange} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Small helpers ───────────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted mb-1.5">{children}</p>;
}

function Textarea({ value, onChange, rows, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea value={value} rows={rows ?? 3} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-xl rule bg-card px-4 py-3 text-[0.88rem] text-ink placeholder:text-muted leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink/20"
    />
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.85rem] text-ink">{label}</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

/* ── Live preview — the real public renderer, scaled down ─────────────── */
function ScaledPreview({ domain, couple, config, design, photoUrls, html, htmlFontsHref, mobile, onRsvp }: {
  domain: string;
  couple: Couple;
  config: SiteConfig;
  design: SiteDesign;
  photoUrls: Record<string, string>;
  /** Model-built markup (already alias-resolved) — shown in a sandboxed iframe. */
  html?: string | null;
  htmlFontsHref?: string | null;
  /** When true, render at a phone viewport so responsive CSS actually reflows. */
  mobile?: boolean;
  onRsvp: () => void;
}) {
  const { t } = useLang();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.35);
  // Iframe/div width = the CSS viewport the site sees. Mobile must be ~390
  // (not a shrunk 1180) or @media / flex layouts never switch.
  const viewW = mobile ? 390 : 1180;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || (mobile ? 390 : 420);
      setScale(w / viewW);
    };
    measure();
    // Parent width changes when toggling mobile (max-w kicks in) — observe it.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewW, mobile]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl rule bg-card shadow-[0_16px_48px_-20px_rgba(0,0,0,0.25)]',
        mobile && 'mx-auto w-[390px] max-w-full',
      )}
    >
      {/* Fonts the current design uses, loaded app-side for the preview */}
      <link rel="stylesheet" href={googleFontsHref([design.typography.displayFont, design.typography.bodyFont])} />
      {/* Browser chrome */}
      <div className="flex items-center gap-2 rule-b bg-shell px-4 py-2.5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-[var(--color-line-strong)]" />)}
        </div>
        <div className="mx-auto flex min-w-0 items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-[0.68rem] text-muted">
          <Lock size={9} className="shrink-0" /> <span className="truncate">{domain}.kalas.dk</span>
        </div>
      </div>
      {/* Scaled real site, fills the frame (phone-narrow when mobile). */}
      <div ref={wrapRef} className="relative h-[520px] w-full overflow-hidden">
        {html ? (
          /* Sandboxed (no scripts can ever run) — the model-built site. */
          <iframe
            title={t('Forhåndsvisning af jeres side')}
            sandbox=""
            srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${htmlFontsHref ? `<link rel="stylesheet" href="${htmlFontsHref}">` : ''}<style>html,body{margin:0;padding:0}</style></head><body><div id="kalas-site">${html}</div></body></html>`}
            className="absolute left-0 top-0 origin-top-left border-0"
            style={{ width: viewW, height: 520 / scale, transform: `scale(${scale})` }}
          />
        ) : (
          <div
            className="absolute left-0 top-0 origin-top-left overflow-y-auto"
            style={{ width: viewW, height: 520 / scale, transform: `scale(${scale})` }}
          >
            <SiteRenderer
              couple={{ a: couple.a, b: couple.b, dateLabel: couple.dateLabel, dateISO: couple.dateISO }}
              config={config}
              design={design}
              photoUrls={photoUrls}
              onRsvp={onRsvp}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Ava design studio — templates, personalization, refinement ───────── */
function DesignStudio({
  hasDesign, hasHtml, design, designs, activeId, activePresetId, photos, photoUrls,
  working, applyingPreset, restarting, genError, needsPayment, websitePaid,
  onApplyPreset, onGenerate, onRefine, onActivate, onRestart, onCheckout,
  onUpload, onDeletePhoto, onSetHero,
}: {
  hasDesign: boolean;
  hasHtml: boolean;
  design: SiteDesign;
  designs: WebsiteDesignRow[];
  activeId: string | null;
  activePresetId: string | null;
  photos: SitePhotoRow[];
  photoUrls: Record<string, string>;
  working: null | 'generate' | 'refine';
  applyingPreset: string | null;
  restarting: boolean;
  genError: string | null;
  needsPayment: boolean;
  websitePaid: boolean;
  onApplyPreset: (presetId: string) => void;
  onGenerate: (styleDirection: string, fresh?: boolean) => void;
  onRefine: (instruction: string) => void;
  onActivate: (designId: string) => void;
  onRestart: () => void;
  onCheckout: () => void;
  onUpload: (files: FileList | File[]) => Promise<void> | void;
  onDeletePhoto: (id: string) => void;
  onSetHero: (id: string) => void;
}) {
  const { t } = useLang();
  const [styleDirection, setStyleDirection] = useState('');
  const [instruction, setInstruction] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const submitRefine = () => {
    const text = instruction.trim();
    if (!text || working) return;
    setInstruction('');
    onRefine(text);
  };

  /* Working / restart takes over the panel. */
  if (restarting) {
    return (
      <div className="rule rounded-2xl bg-card p-8 text-center">
        <Loader2 size={26} className="mx-auto animate-spin text-ink" />
        <p className="mt-4 font-serif text-[1.25rem] text-ink">{t('Starter forfra…')}</p>
      </div>
    );
  }
  if (working) return <BuildProgress refine={working === 'refine'} />;

  return (
    <div className="space-y-8">
      {genError && (
        <p className="rule rounded-xl bg-[#f2e3dd] px-4 py-3 text-[0.82rem] text-[var(--color-terracotta)]">{t(genError)}</p>
      )}

      {/* Paywall notice, templates stay usable; Ava's edits unlock on purchase. */}
      {needsPayment && !websitePaid && (
        <div className="rule rounded-2xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink">
            <Palette size={18} className="text-canvas" />
          </div>
          <p className="font-serif text-[1.25rem] text-ink leading-tight">{t('Lås Ava-designeren op')}</p>
          <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
            {t('Skabelonerne er jeres, men Avas personalisering og ændringer via chat er en betalt funktion. Inkl. fjernelse af Kalas-branding.')}
          </p>
          <button onClick={onCheckout}
            className="mt-5 rounded-full bg-ink px-6 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
            {t('Lås op · {price} kr', { price: websitePriceDkk() })}
          </button>
        </div>
      )}

      {!hasDesign ? (
        /* ── First visit: pick a template ─────────────────────────────── */
        <section>
          <Eyebrow className="mb-2">{t('Trin 1 · Vælg jeres stil')}</Eyebrow>
          <p className="font-serif text-[1.4rem] leading-tight text-ink">{t('Otte gennemarbejdede skabeloner')}</p>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">
            {t('Vælg den der ligner jer. Siden skifter med det samme i forhåndsvisningen, og bagefter gør Ava den personlig med jeres billeder. I kan bede hende om ændringer.')}
          </p>
          <div className="mt-4">
            <TemplateGallery activePresetId={activePresetId} applyingPreset={applyingPreset} onPick={onApplyPreset} />
          </div>
        </section>
      ) : (
        /* ── Has a design: concept + refine + Ava actions ─────────────── */
        <section className="rule rounded-2xl bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow className="mb-2">{t('Jeres design')}</Eyebrow>
              <p className="font-serif text-[1.5rem] leading-tight text-ink">{design.concept.name}</p>
            </div>
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-tint">
              <Palette size={15} className="text-ink" />
            </span>
          </div>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{design.concept.rationale}</p>
          <div className="mt-4 flex items-center gap-1.5">
            {[design.palette.bg, design.palette.surface, design.palette.accent, design.palette.text].map((c, i) => (
              <span key={i} className="h-5 w-5 rounded-full rule" style={{ background: c }} />
            ))}
            <span className="ml-2 text-[0.7rem] text-muted">{design.typography.displayFont} · {design.typography.bodyFont}</span>
          </div>

          {/* Refine via chat */}
          <div className="mt-5 rule-t pt-5">
            <Label>{t('Fortæl Ava hvad der skal ændres')}</Label>
            <div className="mt-2 flex gap-2">
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
                placeholder={t('f.eks. mere romantisk, mørkere, større billeder…')}
                className="min-w-0 flex-1 rule rounded-xl bg-shell px-4 py-2.5 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none"
              />
              <button onClick={submitRefine} disabled={!instruction.trim()}
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 disabled:opacity-40 transition-colors cursor-pointer">
                {t('Justér')}
              </button>
            </div>

            {/* Build: images per section → venue + photos + template → full site */}
            <button onClick={() => onGenerate(styleDirection)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
              <Palette size={13} /> {hasHtml ? t('Byg siden igen') : t('Byg jeres side med Ava')}
            </button>
            {!hasHtml && (
              <p className="mt-2 text-center text-[0.7rem] text-muted">
                {t('Ava genererer billeder til sektionerne, henter jeres venue-fotos og bygger hele siden ud fra skabelonen.')}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <button onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-ink transition-colors cursor-pointer">
                <Image size={12} /> {t('Skift skabelon')}
              </button>
              <div className="flex items-center gap-3">
                {designs.length > 1 && (
                  <button onClick={() => setShowVersions((v) => !v)}
                    className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-ink transition-colors cursor-pointer">
                    <History size={12} /> {t('Versioner ({n})', { n: designs.length })}
                  </button>
                )}
                <button onClick={onRestart}
                  className="flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-[var(--color-terracotta)] transition-colors cursor-pointer">
                  <RotateCcw size={12} /> {t('Start forfra')}
                </button>
              </div>
            </div>
          </div>

          {/* Template switcher */}
          <AnimatePresence>
            {showTemplates && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4">
                  <TemplateGallery activePresetId={activePresetId} applyingPreset={applyingPreset} onPick={onApplyPreset} compact />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Version history */}
          <AnimatePresence>
            {showVersions && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-2">
                  {designs.map((d) => {
                    const pd = parseSiteDesign(d.design);
                    const isActive = d.id === activeId;
                    return (
                      <button key={d.id} onClick={() => { if (!isActive) void onActivate(d.id); }}
                        className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer',
                          isActive ? 'bg-sage-tint' : 'bg-shell hover:bg-card')}>
                        <span className="flex gap-1">
                          {[pd.palette.bg, pd.palette.accent, pd.palette.text].map((c, i) => (
                            <span key={i} className="h-3.5 w-3.5 rounded-full rule" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">{pd.concept.name}</span>
                        <span className="shrink-0 text-[0.65rem] text-muted">
                          {new Date(d.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                        </span>
                        {isActive && <Check size={13} className="shrink-0 text-ink" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Photos */}
      <PhotoManager
        photos={photos.filter((p) => p.role !== 'section')}
        photoUrls={photoUrls}
        step={hasDesign ? null : t('Trin 2 · Jeres billeder')}
        onUpload={onUpload}
        onDelete={onDeletePhoto}
        onSetHero={onSetHero}
      />

      {/* Free-text brief feeds the next personalization run. */}
      <section className="rule rounded-2xl bg-card p-6">
        <Eyebrow className="mb-2">{hasDesign ? t('Jeres stil med egne ord') : t('Trin 3 · Med jeres egne ord')}</Eyebrow>
        <textarea
          value={styleDirection}
          onChange={(e) => setStyleDirection(e.target.value)}
          rows={3}
          placeholder={t('f.eks. Vi drømmer om noget let og botanisk med varme toner, ikke for stift…')}
          className="w-full resize-none rule rounded-xl bg-shell px-4 py-3 text-[0.85rem] text-ink placeholder:text-muted focus:outline-none"
        />
        <p className="mt-2 text-[0.7rem] text-muted">
          {t('Ava læser dette når hun personaliserer eller designer forfra.')}
        </p>
        {hasDesign && (
          <button onClick={() => onGenerate(styleDirection, true)}
            className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-muted hover:text-ink transition-colors cursor-pointer">
            <Palette size={12} /> {t('Lad Ava designe helt forfra')}
          </button>
        )}
      </section>
    </div>
  );
}

/* ── Build progress — the visible step sequence ───────────────────────── */
const BUILD_STEPS = [
  'Genererer billeder til sektionerne…',
  'Henter billeder fra jeres venue…',
  'Ava komponerer layout og typografi…',
  'Bygger jeres side…',
] as const;

function BuildProgress({ refine }: { refine: boolean }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (refine) return;
    const t = setInterval(() => setStep((v) => Math.min(v + 1, BUILD_STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [refine]);

  return (
    <div className="rule rounded-2xl bg-card p-8 text-center">
      <Loader2 size={26} className="mx-auto animate-spin text-ink" />
      <p className="mt-4 font-serif text-[1.25rem] text-ink">
        {refine ? t('Ava bygger siden om…') : t(BUILD_STEPS[step])}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-[0.82rem] text-muted leading-relaxed">
        {refine
          ? t('Hun anvender jeres ændring på hele siden. Det tager typisk under et minut.')
          : t('Venue-fotos, jeres billeder og skabelonen bliver til én samlet side. Det tager et par minutter første gang.')}
      </p>
      {!refine && (
        <div className="mx-auto mt-5 flex max-w-[200px] gap-1.5">
          {BUILD_STEPS.map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-ink' : 'bg-shell')} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Template gallery — live-typography cards for the 8 presets ───────── */
function TemplateGallery({ activePresetId, applyingPreset, onPick, compact = false }: {
  activePresetId: string | null;
  applyingPreset: string | null;
  onPick: (presetId: string) => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const fontIds = useMemo(
    () => SITE_PRESETS.flatMap((p) => [p.design.typography.displayFont, p.design.typography.bodyFont]),
    []
  );
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <link rel="stylesheet" href={googleFontsHref(fontIds)} />
      {SITE_PRESETS.map((p) => {
        const d = p.design;
        const active = p.id === activePresetId;
        const busy = applyingPreset === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            disabled={busy}
            className={cn(
              'relative overflow-hidden rounded-xl text-left transition-all cursor-pointer',
              active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule hover:scale-[1.015]'
            )}
            style={{ background: d.palette.bg }}
          >
            {/* Palette strip */}
            <div className="flex h-1.5">
              {[d.palette.accent, d.palette.text, d.palette.surface, d.palette.muted].map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className={cn('px-3', compact ? 'py-2.5' : 'py-3.5')}>
              <p
                className={cn('leading-tight', compact ? 'text-[1.05rem]' : 'text-[1.3rem]')}
                style={{
                  fontFamily: fontStack(d.typography.displayFont),
                  fontWeight: d.typography.displayWeight,
                  fontStyle: d.typography.displayItalic ? 'italic' : 'normal',
                  color: d.palette.text,
                }}
              >
                {t('Anna & Emil')}
              </p>
              <p className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: d.palette.accent }}>
                {t(p.label)}
              </p>
              {!compact && (
                <p className="mt-1 text-[0.68rem] leading-snug" style={{ color: d.palette.muted }}>
                  {t(p.tagline)}
                </p>
              )}
            </div>
            {(active || busy) && (
              <span className="absolute right-2 top-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: d.palette.text }}>
                {busy
                  ? <Loader2 size={11} className="animate-spin" style={{ color: d.palette.bg }} />
                  : <Check size={11} style={{ color: d.palette.bg }} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Photo manager — drag & drop + iPhone-friendly picker ─────────────── */
function PhotoManager({ photos, photoUrls, step, onUpload, onDelete, onSetHero }: {
  photos: SitePhotoRow[];
  photoUrls: Record<string, string>;
  step: string | null;
  onUpload: (files: FileList | File[]) => Promise<void> | void;
  onDelete: (id: string) => void;
  onSetHero: (id: string) => void;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try { await onUpload(files); } finally { setBusy(false); }
  };

  return (
    <section
      className={cn('rule rounded-2xl bg-card p-6 transition-colors', dragging && 'bg-sage-tint')}
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
        void handleFiles(files);
      }}
    >
      <div className="flex items-center justify-between">
        <Eyebrow>{step ?? t('Jeres billeder')}</Eyebrow>
        <span className="text-[0.7rem] text-muted">{photos.length} / 24</span>
      </div>
      <p className="mt-2 text-[0.8rem] leading-relaxed text-muted">
        {t('Træk billeder herind eller tryk upload: forlovelsesbilleder, stedet, jer to. Ava designer ud fra dem. Markér ét som forsidebillede.')}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const url = photoUrls[p.id];
          return (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-shell">
              {url
                ? <img src={url} alt="" className="h-full w-full object-cover" />
                : <span className="flex h-full items-center justify-center"><Image size={16} className="text-muted" /></span>}
              {p.role === 'hero' && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-canvas">
                  <Star size={8} /> {t('Forsidebillede')}
                </span>
              )}
              {p.kind === 'generated' && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas/85">
                  <Palette size={10} className="text-ink" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {p.role !== 'hero' ? (
                  <button onClick={() => onSetHero(p.id)} title={t('Brug som forsidebillede')}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas/90 text-ink hover:bg-canvas cursor-pointer">
                    <Star size={11} />
                  </button>
                ) : <span />}
                <button onClick={() => onDelete(p.id)} title={t('Slet billede')}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas/90 text-ink hover:bg-canvas cursor-pointer">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= 24}
          className={cn(
            'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40 cursor-pointer',
            dragging ? 'border-ink text-ink' : 'border-[var(--color-line-strong)]'
          )}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em]">{t('Upload')}</span>
        </button>
      </div>

      {/* accept="image/*" opens the photo library directly on iPhone; HEIC and
          large originals are re-encoded client-side before upload. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
      />
      <p className="mt-3 text-[0.68rem] text-muted">{t('Alle almindelige billedformater, også direkte fra iPhone')}</p>
    </section>
  );
}
