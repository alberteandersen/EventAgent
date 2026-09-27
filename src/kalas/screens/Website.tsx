import { useState, useId, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, Globe, Smartphone, Plus, Trash2, Palette,
  Lock, Copy, Eye, MapPin, Gift, HelpCircle, Bed,
  Camera, Clock, BookOpen, Image, QrCode, CalendarClock,
} from 'lucide-react';
import { IMAGES as IMG } from '../images';
import { Eyebrow, Toggle, cn } from '../ui';
import { useWedding, type Couple } from '../useWedding';
import { SiteRenderer } from '../site/SiteRenderer';
import {
  parseConfig, slugify, GALLERY_KEYS,
  type SiteConfig, type ProgramEvent, type FAQItem, type HotelItem, type SectionId, type SectionMeta,
} from '../site/config';
import { parseSiteDesign, DEFAULT_DESIGN, type SiteDesign } from '../site/design';
import { googleFontsHref, SITE_FONTS } from '../site/fonts';
import { resolveHtml, familiesInHtml } from '@/lib/website/resolveHtml';
import { settleJob } from '@/lib/jobs/client';
import { fillSlots, needsRebuild } from '@/lib/website/slots';
import { normalizeImage } from '../site/normalizeImage';
import { websitePriceDkk } from '@/lib/website/pricing';
import type { SitePhotoRow, WebsiteDesignRow } from '@/lib/db/types';
import { useLang } from '../i18n';
import type { GuestContact } from '../site/config';
import { CONTENT_STEPS, outlineSummary, sectionStatus, stepSummary, type SectionStatus } from '../site/outline';
import { ContactEditor, GuestbookModeration, QrBlock, SeatFinderInfo, SiteOverview } from './website/HubPanels';
import { ContentStepNav, ContentStepRow, SectionStatusLine, StaleContentNotice } from './website/ContentOutline';
import { BookHeart, Armchair, UserRound } from 'lucide-react';
import WebsiteSteps, { type DesignStep } from './WebsiteSteps';
import { builderStart, programFromDay, stableJson, venueLine as lineFor } from '../site/builderStart';
import { AvaFaqPanel, AvaTextPanel, AvaWriteButton, useAvaText } from './website/AvaDraft';
import { mergeFaqDraft } from '@/lib/website/draft';
import { describeVersions } from '../site/versions';
import { DesignVersions, versionWhat } from './website/DesignVersions';

type WTab = 'design' | 'indhold' | 'indstillinger';

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
export default function Website() {
  const { loading, weddingSite } = useWedding();
  // Content first: Ava builds from it. Until the couple picks a tab, a site
  // that is already built opens on its design instead. Kept out here so a
  // reload of the builder (below) leaves them where they were.
  const [pickedTab, setTab] = useState<WTab | null>(null);
  const [contentStep, setContentStep] = useState(0);

  // The builder holds its own copy of the content and saves it as a whole,
  // so a change made elsewhere (Ava in the chat) would be overwritten by the
  // next keystroke. When the saved content turns into something the builder
  // did not save itself, it starts over from it instead.
  const [ownSave, setOwnSave] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const incoming = stableJson(weddingSite?.config ?? {});
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    if (incoming !== ownSave) setEpoch((e) => e + 1);
  }

  // The builder starts from the saved site, so it waits until that is here
  // (loading goes false once and stays there; refreshes do not unmount it).
  if (loading) return <div className="min-h-screen" />;
  return (
    <WebsiteBuilder key={epoch}
      pickedTab={pickedTab} setTab={setTab}
      contentStep={contentStep} setContentStep={setContentStep}
      onSaving={(config) => setOwnSave(stableJson(config))}
    />
  );
}

function WebsiteBuilder({ pickedTab, setTab, contentStep, setContentStep, onSaving }: {
  pickedTab: WTab | null;
  setTab: (tab: WTab) => void;
  contentStep: number;
  setContentStep: (step: number) => void;
  /** Told what is about to be saved, so the save coming back is known as ours. */
  onSaving: (config: Record<string, unknown>) => void;
}) {
  const { t, tn } = useLang();
  const {
    couple, event, weddingSite, saveSite, venues, dayProgramItems, registryItems,
    websiteDesign, websiteDesigns, sitePhotos, websitePaid, refresh, guests,
  } = useWedding();
  const chosenVenue = venues.find((v) => v.id === event?.chosen_venue_id) ?? null;
  const [start] = useState(() => builderStart({ site: weddingSite, venue: chosenVenue, dayProgram: dayProgramItems }));

  const tab: WTab = pickedTab ?? (websiteDesign?.html ? 'design' : 'indhold');

  /* Sections */
  const [sections, setSections] = useState<SectionMeta[]>(start.sections);
  /* Sections that get an Ava-generated illustration in the build. */
  const [aiImages, setAiImages] = useState<SectionId[]>(start.aiImages);

  /* Content */
  const [heroTagline,  setHeroTagline]  = useState(start.heroTagline);
  const [storyText,    setStoryText]    = useState(start.storyText);
  const [countdown,    setCountdown]    = useState(start.countdown);
  const [program,      setProgram]      = useState<ProgramEvent[]>(start.program);
  const [rsvpDeadline, setRsvpDeadline] = useState(start.rsvpDeadline);
  const [rsvpPlusOne,  setRsvpPlusOne]  = useState(start.rsvpPlusOne);
  const [rsvpMeal,     setRsvpMeal]     = useState(start.rsvpMeal);
  const [rsvpDietary,  setRsvpDietary]  = useState(start.rsvpDietary);
  const [galleryKeys,  setGalleryKeys]  = useState<Set<keyof typeof IMG>>(() => new Set(start.galleryKeys));
  const [transport,    setTransport]    = useState(start.transport);
  const [dresscode,    setDresscode]    = useState(start.dresscode);
  const [giftsText,    setGiftsText]    = useState(start.giftsText);
  const [giftsUrl,     setGiftsUrl]     = useState(start.giftsUrl);
  const [faq,          setFaq]          = useState<FAQItem[]>(start.faq);
  const [hotels,       setHotels]       = useState<HotelItem[]>(start.hotels);
  const [contact,      setContact]      = useState<GuestContact>(start.contact);

  /* Publish */
  const [domain,      setDomain]      = useState(start.domain ?? `${slugify(couple.a)}-${slugify(couple.b)}`);
  const [published,   setPublished]   = useState(start.published);
  const [pwProtected, setPwProtected] = useState(start.pwProtected);
  const [sitePassword,setSitePassword]= useState(start.sitePassword);
  const [copied,      setCopied]      = useState(false);
  const [hideBranding,setHideBranding]= useState(start.hideBranding);
  const [showLanding, setShowLanding] = useState(false);
  const [mobileView,  setMobileView]  = useState(false);
  const [showRsvp,    setShowRsvp]    = useState(false);

  // ── Persistence ──────────────────────────────────────────────────────
  // Autosave the config (debounced) as the couple edits. The first save
  // also stores what a new site started from (venue, Bryllupsdagen), so
  // Ava reads the same content the builder shows.
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

  const save = () => { onSaving(config); return saveSite({ config, domain, published }); };
  useEffect(() => {
    const saveTimer = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(saveTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, domain, published, saveSite]);

  // Ava's drafts read the saved content, so an edit waiting on the
  // autosave goes first.
  const flushSave = save;
  const eventId = event?.id ?? null;
  const avaTagline = useAvaText({ eventId, field: 'heroTagline', beforeCall: flushSave });
  const avaStory = useAvaText({ eventId, field: 'story', beforeCall: flushSave });
  const avaDresscode = useAvaText({ eventId, field: 'dresscode', beforeCall: flushSave });

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

  const [working, setWorking] = useState<null | 'generate' | 'refine' | 'sync'>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);

  // Where the couple is in the design steps, and what they are telling Ava.
  // Kept here because the panel itself unmounts on every tab switch.
  const [designStep, setDesignStep] = useState<DesignStep | null>(null);
  const [briefDraft, setBriefDraft] = useState<string | null>(null);
  // Until they type, the box holds what they last told Ava: the newest
  // version that carries it (picking a vibe saves a version without).
  const savedBrief = useMemo(
    () => websiteDesigns
      .map((d) => (d.brief as { styleDirection?: string } | null)?.styleDirection)
      .find((s): s is string => Boolean(s)) ?? '',
    [websiteDesigns]
  );

  /** Resolves true when Ava's change went through and the wedding reloaded. */
  const callDesignApi = async (path: string, body: Record<string, unknown>, kind: 'generate' | 'refine' | 'sync') => {
    if (!event) return false;
    setWorking(kind);
    setGenError(null);
    try {
      // Ava reads the saved content, so an edit still waiting on the
      // autosave must land first.
      await save();
      const res = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, ...body }),
      });
      if (res.status === 402) { setNeedsPayment(true); return false; }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setGenError(data.message ?? data.error ?? 'Noget gik galt. Prøv igen.');
        return false;
      }
      // In production the build runs as a background job; wait for it.
      const outcome = await settleJob(res);
      if (!outcome.ok) {
        setGenError(outcome.error ?? 'Noget gik galt. Prøv igen.');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setGenError('Noget gik galt. Prøv igen.');
      return false;
    } finally {
      setWorking(null);
    }
  };

  const generateDesign = (styleDirection: string) =>
    callDesignApi('/api/website/design', { styleDirection }, 'generate');
  // A change asked for while looking at an earlier version is a change to
  // that version: it goes live first, and Ava works from it.
  const refineDesign = async (instruction: string) => {
    if (viewing) {
      await activateDesign(viewing.id);
      setViewingId(null);
    }
    return callDesignApi('/api/website/design/refine', { instruction }, 'refine');
  };
  /** New words into the built site, same design. */
  const syncContent = () =>
    callDesignApi('/api/website/design/refine', { syncContent: true }, 'sync');

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

  // The outline: what is on the site, and what still misses something.
  const outlineExtras = { hasRegistry: registryItems.length > 0 };
  const stepSummaries = CONTENT_STEPS.map((s) => stepSummary(s, previewConfig, outlineExtras));
  const contentSummary = outlineSummary(previewConfig, outlineExtras);
  const statusOf = (id: SectionId) => sectionStatus(id, previewConfig, outlineExtras);

  // Rewording flows into a built site through its text slots; a new
  // section or row needs Ava. Older builds without slots need her for any
  // change, and builds that recorded nothing say nothing (see slots.ts).
  const contentStale = Boolean(
    websiteDesign?.html
    && needsRebuild(websiteDesign.html, websiteDesign.brief as Parameters<typeof needsRebuild>[1], previewConfig),
  );

  // Model-built HTML (aliases → preview URLs, fonts detected from markup).
  // Under Design the couple can look at an earlier version without making
  // it live; everywhere else the preview is the live one.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = viewingId ? websiteDesigns.find((d) => d.id === viewingId && d.html && !d.active) ?? null : null;
  const shownDesign = tab === 'design' && viewing ? viewing : websiteDesign;

  const venueUrls = useMemo(() => {
    const venue = venues.find((v) => v.id === event?.chosen_venue_id) ?? null;
    return venue ? [venue.image_url, ...(venue.photo_urls ?? [])].filter((u): u is string => Boolean(u)) : [];
  }, [venues, event?.chosen_venue_id]);

  /** A version's HTML as guests would get it: today's words, fresh images. */
  const renderVersion = useCallback((row: WebsiteDesignRow): string => {
    const aliases = ((row.brief as { imageAliases?: Record<string, string> })?.imageAliases) ?? {};
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
    return resolveHtml(fillSlots(row.html ?? '', previewConfig), map);
  }, [photoUrls, venueUrls, previewConfig]);

  const fontsHrefFor = (html: string | null | undefined): string | null => {
    if (!html) return null;
    const fams = familiesInHtml(html, SITE_FONTS.map((f) => f.family));
    const ids = SITE_FONTS.filter((f) => fams.includes(f.family)).map((f) => f.id);
    return ids.length > 0 ? googleFontsHref(ids) : null;
  };

  const previewHtml = useMemo(
    () => (shownDesign?.html ? renderVersion(shownDesign) : null),
    [shownDesign, renderVersion],
  );
  const htmlFontsHref = useMemo(() => fontsHrefFor(shownDesign?.html), [shownDesign]);

  // Every built version, newest first, for the row under the preview.
  const versionInfos = useMemo(() => describeVersions(websiteDesigns), [websiteDesigns]);
  const versionThumbs = useMemo(
    () => versionInfos
      .filter((v) => v.kind !== 'template')
      .slice(0, 12)
      .map((info) => {
        const row = websiteDesigns.find((d) => d.id === info.id)!;
        return { info, html: renderVersion(row), fontsHref: fontsHrefFor(row.html) };
      }),
    [versionInfos, websiteDesigns, renderVersion],
  );
  const viewingInfo = viewing ? versionInfos.find((v) => v.id === viewing.id) ?? null : null;

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

  /* ── Indhold: one editor per section, shown by the step it belongs to ── */
  const step = CONTENT_STEPS[contentStep];
  const venueLine = lineFor(chosenVenue);
  // Offered while the programme differs from Bryllupsdagen, however it came to.
  const dayRows = programFromDay(dayProgramItems);
  const sameAsDay = dayRows.length === program.length
    && dayRows.every((d, i) => d.time === program[i].time && d.label === program[i].label && d.sublabel === program[i].sublabel);
  const importDayProgram = () => {
    const edited = program.some((p) => p.label.trim() || p.time.trim());
    if (edited && !window.confirm(t('Erstat programmet med jeres Bryllupsdagen? Det, der står her nu, forsvinder.'))) return;
    setProgram(dayRows);
  };

  const card = (id: SectionId, icon: React.ReactNode, children: React.ReactNode, withAi = false) => (
    <SectionCard section={sections.find((s) => s.id === id)!} status={statusOf(id)} onToggle={toggleSection}
      icon={icon} ai={withAi ? aiToggle(id) : undefined}>
      {children}
    </SectionCard>
  );

  const editor = (id: SectionId): React.ReactNode => {
    switch (id) {
      case 'hero': return card('hero', <Image size={15} />, <>
        <Label>{t('Navne')}</Label>
        <p className="rule rounded-xl bg-shell px-4 py-3 text-[0.88rem] text-ink">{couple.a} & {couple.b} · {couple.dateLabel}</p>
        <p className="mt-1 text-[0.7rem] text-muted">{t('Fra jeres profil')}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <Label>{t('Velkomstbesked')}</Label>
            <AvaWriteButton onClick={avaTagline.start} busy={avaTagline.busy} />
          </div>
          <Textarea value={heroTagline} onChange={setHeroTagline} rows={2} placeholder={t('Kom og fejr dagen med os')} />
          <AvaTextPanel state={avaTagline} hasText={Boolean(heroTagline.trim())} onUse={setHeroTagline} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Label>{t('Nedtælling til brylluppet')}</Label>
          <Toggle value={countdown} onChange={setCountdown} />
        </div>
      </>);

      case 'story': return card('story', <BookOpen size={15} />, <>
        <div className="flex items-center justify-between gap-3">
          <Label>{t('Jeres historie')}</Label>
          <AvaWriteButton onClick={avaStory.start} busy={avaStory.busy} />
        </div>
        <Textarea value={storyText} onChange={setStoryText} rows={5}
          placeholder={t('Hvordan I mødtes, hvornår I vidste det, og hvad I glæder jer til…')} />
        <AvaTextPanel state={avaStory} hasText={Boolean(storyText.trim())} onUse={setStoryText} />
        <p className="mt-2 text-[0.7rem] text-muted">{t('Et par linjer er nok. Ava skriver den ind, som den står.')}</p>
      </>, true);

      case 'program': return card('program', <Clock size={15} />, <>
        <div className="flex items-center justify-between gap-3">
          <Label>{t('Programpunkter')}</Label>
          {dayRows.length > 0 && !sameAsDay && (
            <button type="button" onClick={importDayProgram}
              className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] text-muted hover:text-ink transition-colors cursor-pointer">
              <CalendarClock size={12} /> {t('Hent fra Bryllupsdagen ({n})', { n: dayProgramItems.length })}
            </button>
          )}
        </div>
        <div className="mt-1 space-y-2">
          {program.map((ev) => (
            <div key={ev.id} className="flex gap-2 items-start">
              <input value={ev.time} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, time: e.target.value } : x))}
                className="w-16 shrink-0 rounded-lg rule bg-card px-2 py-1.5 text-[0.82rem] text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink/20"
                placeholder={t('00:00')} aria-label={t('Tidspunkt')} />
              <div className="flex-1 space-y-1.5">
                <input value={ev.label} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, label: e.target.value } : x))}
                  className="w-full rounded-lg rule bg-card px-3 py-1.5 text-[0.82rem] text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                  placeholder={t('Programpunkt')} />
                <input value={ev.sublabel} onChange={(e) => setProgram((p) => p.map((x) => x.id === ev.id ? { ...x, sublabel: e.target.value } : x))}
                  className="w-full rounded-lg bg-transparent px-3 py-1 text-[0.74rem] text-muted focus:outline-none"
                  placeholder={t('Sted / detalje (valgfrit)')} />
              </div>
              <button type="button" onClick={() => setProgram((p) => p.filter((x) => x.id !== ev.id))}
                aria-label={t('Slet')}
                className="mt-1.5 shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => setProgram((p) => [...p, { id: `e${Date.now()}`, time: '', label: '', sublabel: '' }])}
            className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer mt-2">
            <Plus size={14} /> {t('Tilføj programpunkt')}
          </button>
        </div>
      </>, true);

      case 'rsvp': return card('rsvp', <Check size={15} />, <>
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
      </>, true);

      case 'gallery': return card('gallery', <Camera size={15} />, <>
        <Label>{t('Vælg billeder til galleriet')}</Label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {GALLERY_KEYS.map((key) => {
            const on = galleryKeys.has(key);
            return (
              <button key={key} type="button" aria-pressed={on} onClick={() => setGalleryKeys((prev) => {
                const n = new Set(prev);
                if (on) n.delete(key); else n.add(key);
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
      </>);

      case 'transport': return card('transport', <MapPin size={15} />, <>
        <Label>{t('Adresse')}</Label>
        <Textarea value={transport} onChange={setTransport} rows={2} placeholder={t('Venue-navn, adresse, postnummer')} />
        {venueLine && transport.trim() !== venueLine && (
          <button type="button" onClick={() => setTransport(venueLine)}
            className="mt-2 text-[0.72rem] text-muted underline decoration-dotted underline-offset-2 hover:text-ink cursor-pointer">
            {t('Brug {venue}', { venue: venueLine })}
          </button>
        )}
        <p className="mt-2 text-[0.7rem] text-muted">{t('Ava tilføjer automatisk et kort-link til gæsterne.')}</p>
      </>, true);

      case 'dresscode': return card('dresscode', <Eye size={15} />, <>
        <div className="flex items-center justify-between gap-3">
          <Label>{t('Dresscode-tekst')}</Label>
          <AvaWriteButton onClick={avaDresscode.start} busy={avaDresscode.busy} label={t('Foreslå med Ava')} />
        </div>
        <Textarea value={dresscode} onChange={setDresscode} rows={3}
          placeholder={t('f.eks. Festligt og elegant. Tag gerne flade sko med til plænen.')} />
        <AvaTextPanel state={avaDresscode} hasText={Boolean(dresscode.trim())} onUse={setDresscode} />
      </>, true);

      case 'gifts': return card('gifts', <Gift size={15} />, <>
        <div className="space-y-4">
          <div>
            <Label>{t('Tekst til gæsterne')}</Label>
            <Textarea value={giftsText} onChange={setGiftsText} rows={3} placeholder={t('Ingen ønskeliste, bryllupsrejse, eller link til registrering…')} />
          </div>
          {registryItems.length > 0 ? (
            <p className="rule rounded-xl bg-shell px-4 py-3 text-[0.78rem] text-muted">
              {tn(registryItems.length,
                'Jeres ønskeliste med én gave vises under teksten.',
                'Jeres ønskeliste med {n} gaver vises under teksten.',
                { n: registryItems.length })}
            </p>
          ) : (
            <div>
              <Label>{t('Ønskeliste-link (valgfrit)')}</Label>
              <input value={giftsUrl} onChange={(e) => setGiftsUrl(e.target.value)}
                placeholder={t('https://...')}
                className="mt-1 w-full rounded-lg rule bg-card px-3 py-2 text-[0.82rem] text-ink placeholder:text-muted focus:outline-none" />
            </div>
          )}
        </div>
      </>, true);

      case 'hotel': return card('hotel', <Bed size={15} />, <>
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
                <button type="button" onClick={() => setHotels((prev) => prev.filter((x) => x.id !== h.id))}
                  aria-label={t('Slet')}
                  className="shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setHotels((prev) => [...prev, { id: `h${Date.now()}`, name: '', dist: '', price: '' }])}
            className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer">
            <Plus size={14} /> {t('Tilføj hotel')}
          </button>
        </div>
      </>, true);

      case 'faq': return card('faq', <HelpCircle size={15} />, <>
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <Label>{t('Spørgsmål & svar')}</Label>
          <AvaFaqPanel eventId={eventId} beforeCall={flushSave} faq={faq}
            onUse={(draft) => setFaq((prev) => mergeFaqDraft(prev, draft, (i) => `f${Date.now()}-${i}`))} />
        </div>
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
                <button type="button" onClick={() => setFaq((f) => f.filter((x) => x.id !== item.id))}
                  aria-label={t('Slet')}
                  className="mt-0.5 shrink-0 text-muted hover:text-ink transition-colors cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setFaq((f) => [...f, { id: `f${Date.now()}`, q: '', a: '' }])}
            className="flex items-center gap-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer">
            <Plus size={14} /> {t('Tilføj spørgsmål')}
          </button>
        </div>
      </>, true);

      case 'photos': return card('photos', <Camera size={15} />, <>
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
      </>);

      case 'contact': return card('contact', <UserRound size={15} />, <ContactEditor value={contact} onChange={setContact} />);
      case 'seat': return card('seat', <Armchair size={15} />, <SeatFinderInfo />);
      case 'guestbook': return card('guestbook', <BookHeart size={15} />, <GuestbookModeration />);
    }
  };

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
              { id: 'indhold',        label: t('Indhold')        },
              { id: 'design',         label: t('Design')         },
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
                {viewingInfo && viewing && (
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-sage-tint/70 px-4 py-2.5">
                    <p className="min-w-0 flex-1 text-[0.8rem] text-ink">
                      <span className="font-medium">{t('Du ser version {n}', { n: viewingInfo.number ?? '' })}</span>
                      <span className="text-muted"> · {versionWhat(viewingInfo, t)}</span>
                    </p>
                    <button type="button" onClick={() => { void activateDesign(viewing.id).then(() => setViewingId(null)); }}
                      className="rounded-full bg-ink px-3.5 py-1.5 text-[0.64rem] font-bold uppercase tracking-[0.14em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                      {published ? t('Gør den live') : t('Brug denne')}
                    </button>
                    <button type="button" onClick={() => setViewingId(null)}
                      className="text-[0.74rem] text-muted hover:text-ink transition-colors cursor-pointer">
                      {t('Tilbage til den aktive')}
                    </button>
                  </div>
                )}
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
              <DesignVersions versions={versionThumbs} viewingId={viewing?.id ?? null}
                published={published} onView={setViewingId} />
            </div>

            {/* Right: Ava, one step at a time */}
            <div className="rule-t lg:rule-t-0 px-6 py-10 sm:px-9 lg:py-12 overflow-y-auto">
              <WebsiteSteps
                step={designStep}
                onStep={setDesignStep}
                brief={briefDraft ?? savedBrief}
                onBrief={setBriefDraft}
                hasDesign={Boolean(websiteDesign)}
                hasHtml={Boolean(websiteDesign?.html)}
                design={design}
                designs={websiteDesigns}
                refineTarget={viewingInfo?.number ?? null}
                activePresetId={(websiteDesign?.brief as { preset?: string } | null)?.preset ?? null}
                photos={sitePhotos.filter((p) => p.role !== 'section')}
                photoUrls={photoUrls}
                working={working}
                applyingPreset={applyingPreset}
                restarting={restarting}
                genError={genError}
                needsPayment={needsPayment}
                websitePaid={websitePaid}
                onApplyPreset={applyPreset}
                onBuild={generateDesign}
                onRefine={refineDesign}
                onRestart={restartDesign}
                onCheckout={startCheckout}
                onUpload={uploadPhotos}
                onDeletePhoto={deletePhoto}
                onSetHero={setHeroPhoto}
                content={contentSummary}
                onOpenContent={() => setTab('indhold')}
                contentStale={contentStale}
                onSyncContent={() => void syncContent()}
              />
            </div>
          </motion.div>
        )}

        {tab === 'indhold' && (
          <motion.div key="indhold"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid lg:grid-cols-[1fr_380px] lg:min-h-[calc(100vh-76px)]">

            {/* Left: the site as an outline, one step at a time */}
            <div className="px-6 py-10 sm:px-9 lg:px-12 lg:py-12 lg:rule-r">
              <div className="mb-7">
                <Eyebrow>{t('Indhold')}</Eyebrow>
                <p className="mt-2 text-[0.88rem] text-muted">
                  {contentSummary.todo === 0
                    ? t('{n} sektioner på siden, og alle er klar.', { n: contentSummary.on })
                    : tn(contentSummary.todo,
                        '{on} sektioner på siden. Én mangler stadig noget.',
                        '{on} sektioner på siden. {n} mangler stadig noget.',
                        { on: contentSummary.on, n: contentSummary.todo })}
                </p>
              </div>

              {contentStale && (
                <div className="mb-7">
                  <StaleContentNotice syncing={working === 'sync'} onSync={() => void syncContent()} />
                  {genError && working === null && (
                    <p className="mt-2 text-[0.75rem] text-[var(--color-terracotta)]">{t(genError)}</p>
                  )}
                </div>
              )}

              <ContentStepRow steps={CONTENT_STEPS} summaries={stepSummaries}
                current={contentStep} onStep={setContentStep} />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-7">
                  <p className="font-serif text-[1.4rem] leading-tight text-ink">{t(step.title)}</p>
                  <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{t(step.intro)}</p>
                  <div className="mt-5 space-y-3">
                    {step.sections.map((id) => <div key={id}>{editor(id)}</div>)}
                  </div>
                  <ContentStepNav
                    onBack={contentStep > 0 ? () => setContentStep(contentStep - 1) : undefined}
                    onNext={contentStep < CONTENT_STEPS.length - 1
                      ? () => setContentStep(contentStep + 1)
                      // The last step hands over to the design, unless the site
                      // is built and they came here only to fix a word.
                      : websiteDesign?.html ? undefined : () => setTab('design')}
                    nextLabel={contentStep < CONTENT_STEPS.length - 1
                      ? t('Næste: {step}', { step: t(CONTENT_STEPS[contentStep + 1].label) })
                      : t('Videre til design')}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: mini preview (desktop only) */}
            <div className="hidden lg:block px-8 py-12 rule-t lg:rule-t-0">
              <div className="sticky top-20">
                <p className="eyebrow mb-5">{t('Live forhåndsvisning')}</p>
                {preview}
                {previewHtml && (
                  <p className="mt-3 text-[0.72rem] leading-relaxed text-muted">
                    {contentStale
                      ? t('Jeres tekst vises med det samme. Nye sektioner og punkter kommer med, når I opdaterer.')
                      : t('Siden, som Ava byggede den, med jeres tekst, som den står nu.')}
                  </p>
                )}
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

/* ── Section card: on or off, and whether it is ready ─────────────────── */
function SectionCard({
  section, status, onToggle, icon, children, ai,
}: {
  section: SectionMeta;
  status: SectionStatus;
  onToggle: (id: SectionId) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** AI-illustration toggle for this section (step 2 of the build). */
  ai?: { on: boolean; onChange: (v: boolean) => void; thumb?: string | null };
}) {
  const { t } = useLang();
  const labelId = useId();
  // A step shows only a handful of sections, so what is on is open: the
  // couple sees what they are writing without a click per card.
  const open = section.enabled || Boolean(section.locked);

  return (
    <div className={cn('rule rounded-2xl overflow-hidden transition-colors',
      open ? 'bg-card' : 'bg-card/50')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={cn('shrink-0 transition-colors', open ? 'text-ink' : 'text-muted')}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p id={labelId} className={cn('font-serif text-[1rem] leading-tight', open ? 'text-ink' : 'text-ink/60')}>{t(section.label)}</p>
          <SectionStatusLine status={status} desc={section.desc} />
        </div>
        {section.locked ? (
          <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.1em] text-muted">{t('Altid')}</span>
        ) : (
          <button type="button" onClick={() => onToggle(section.id)} role="switch" aria-checked={section.enabled}
            aria-labelledby={labelId}
            className={cn('relative h-5 w-9 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
              section.enabled ? 'bg-ink' : 'bg-shell')}>
            <span className={cn('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-canvas shadow-sm transition-all duration-200',
              section.enabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
          </button>
        )}
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
