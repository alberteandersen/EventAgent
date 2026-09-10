"use client";

import { Fragment, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Check, MessageCircle, ArrowLeft, MapPin,
  Star, Loader2, BookOpen, Globe as GlobeIcon, Plus, X, Send, Mail, Clock, ArrowRight,
  Expand, Search, PenLine,
} from 'lucide-react';
import { Lightbox } from '../onboarding/Lightbox';
import OutreachDialog from '../OutreachDialog';
import { IMAGES } from '../data';
import { useWedding, type Couple } from '../useWedding';
import { venueBudget } from './budget/estimate';
import { Eyebrow, Pill, cn } from '../ui';
import type { NavigateTarget } from '../lib/hub-nav';
import { useLang } from '../i18n';
import type { VenueRow, EmailDraftRow } from '@/lib/db/types';
import type { VenueResearchProfile } from '@/lib/venue/research';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import type { VenueSuggestion } from '@/lib/venue/search';
import { applyFilters, type VenueBadge, type VenueFilters, type VenueSort } from '@/lib/venue/filter';
import {
  regionsForCountry, regionShortLabel, regionsLabel, groupByRegion, findRegion,
  curatedCountryFromLocation, shardsFor, MAX_SHARDS, type VenueRegion,
} from '@/lib/venue/regions';
import VenueFilterBar, { type VenueFilterCounts, type RegionOption } from './venues/VenueFilterBar';
import VenuePanel from './venues/VenuePanel';
import {
  countryView, regionView, areaPoint, centroid, TOWN_ALTITUDE, type GeoPoint,
} from '@/lib/venue/geo';
import type { GlobeFocus, GlobePlace } from '../onboarding/DestinationGlobe';
import { panelSlot } from './venues/grid';

const DestinationGlobe = dynamic(() => import('../onboarding/DestinationGlobe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 size={22} className="animate-spin text-muted" />
    </div>
  ),
});

/* Real venue row → the display shape the discovery views render. */
interface DisplayVenue {
  id: string;
  name: string;
  location: string;
  image: string;      // real URL, or an IMAGES key fallback
  rating: number | null;
  reviewCount: number;
  price: string;
  capacity: string;
  why: string[];
  quote: string;
  photos: string[];
  description: string | null;
  research: VenueResearchProfile | null;
}

function toDisplay(v: VenueRow): DisplayVenue {
  const reviewSnippets = (v.reviews ?? [])
    .map((r) => r.text ?? '')
    .filter(Boolean);
  return {
    id: v.id,
    name: v.name,
    location: v.address ?? '',
    image: v.image_url ?? v.photo_urls?.[0] ?? 'orangeri',
    rating: v.rating != null ? Number(v.rating) : null,
    reviewCount: v.review_count ?? 0,
    price: v.price_hint ?? '-',
    capacity: v.capacity ?? '-',
    why: v.why_fit ? [v.why_fit, ...reviewSnippets.slice(0, 2)] : reviewSnippets.slice(0, 3),
    quote: v.why_fit ?? '',
    photos: v.photo_urls ?? [],
    description: v.description,
    research: v.venue_research ?? null,
  };
}

/* Resolve an image that may be a real URL or a mock IMAGES key. */
const imgSrc = (src: string) =>
  src.startsWith('http') ? src : IMAGES[src as keyof typeof IMAGES] ?? IMAGES.orangeri;

function venueAreaLabel(region: string): string {
  return region.trim().replace(/\bnær\s+/gi, '').trim();
}

/* Outreach progress a couple can see on their list. */
type VenueStage = 'idle' | 'contacted' | 'replied' | 'quoted';
const STAGE_META: Record<VenueStage, { label: string; cls: string; Icon: typeof Mail }> = {
  idle:      { label: 'Ikke kontaktet', cls: 'bg-shell text-muted',                 Icon: Clock },
  contacted: { label: 'Kontaktet',      cls: 'bg-[#e9edf2] text-[#3f5b6b]',          Icon: Send },
  replied:   { label: 'Svar modtaget',  cls: 'bg-[#e5ead8] text-[#46574f]',          Icon: Mail },
  quoted:    { label: 'Tilbud',         cls: 'bg-[#f3d8cf] text-[#7b4032]',          Icon: Mail },
};

function StageChip({ stage, className }: { stage: VenueStage; className?: string }) {
  const { t } = useLang();
  const { label, cls, Icon } = STAGE_META[stage];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em]', cls, className)}>
      <Icon size={11} /> {t(label)}
    </span>
  );
}

function RatingBadge({ rating, count, className }: { rating: number | null; count?: number; className?: string }) {
  if (rating == null) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm', className)}>
      <Star size={11} fill="currentColor" className="text-[#e6a34e]" />
      {rating.toFixed(1)}
      {count ? <span className="font-normal text-muted">({count})</span> : null}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT, venue discovery & management
══════════════════════════════════════════════════════════════════════ */
import type { HubCat, HubTab } from './team/shared';

export type VenueHubView = 'discover' | 'list' | 'review';

export type VenueHubConfig = {
  view: VenueHubView;
  onViewChange: (view: VenueHubView) => void;
  onSwitchTab?: (tab: HubTab, cat?: HubCat) => void;
  category?: HubCat;
  showHint?: boolean;
  /** Optional category filter bar rendered under the "Trin 2" list header (hub shortlist). */
  categoryBar?: ReactNode;
};

export default function VenueDiscovery({
  onNavigate,
  hub,
}: {
  onNavigate?: (s: NavigateTarget) => void;
  hub?: VenueHubConfig;
}) {
  type VView = 'home' | 'discover' | 'list' | 'review';
  const { t } = useLang();
  const { couple, event, venues: allVenues, outbound, replies, refresh } = useWedding();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Real venues for this wedding (never vendors).
  const venues = allVenues.filter((v) => v.category === 'venue');
  const displayVenues = venues.map(toDisplay);

  const hasRealVenues = displayVenues.length > 0;
  // Landing is derived: once the couple has venues (or Ava routed here) we open
  // the list, otherwise discovery — until they navigate, which pins `navView`.
  const [navView, setVView] = useState<VView | null>(() => {
    if (hub) return hub.view;
    if (typeof window === 'undefined') return null;
    const fromAva = sessionStorage.getItem('kalas_venues_view');
    if (fromAva === 'picks' || fromAva === 'list') {
      sessionStorage.removeItem('kalas_venues_view');
      return 'list';
    }
    return null;
  });
  // Hub mode: controlled view from parent. Standalone: home until user navigates.
  const vview: VView = hub ? hub.view : (navView ?? 'home');

  const setView = (next: VView) => {
    if (hub) {
      if (next === 'discover' || next === 'list' || next === 'review') hub.onViewChange(next);
      return;
    }
    setVView(next);
  };

  const goInbox = () => {
    onNavigate?.('inbox');
  };

  // Derived state from real rows.
  const saved = new Set(venues.filter((v) => v.swipe_status === 'liked').map((v) => v.id));
  const savedPlaceIds = new Set(venues.map((v) => v.place_id).filter(Boolean) as string[]);
  const sent = new Set(outbound.map((o) => o.venue_id));
  const booked = event?.chosen_venue_id ?? venues.find((v) => v.booked_at)?.id ?? null;

  // Per-venue outreach stage, derived from real outbound + replies.
  const repliedIds = new Set(replies.map((r) => r.venue_id).filter(Boolean) as string[]);
  const quotedIds = new Set(
    replies.filter((r) => r.quote_status === 'quoted').map((r) => r.venue_id).filter(Boolean) as string[],
  );
  const stageOf = (id: string): VenueStage =>
    quotedIds.has(id) ? 'quoted' : repliedIds.has(id) ? 'replied' : sent.has(id) ? 'contacted' : 'idle';

  const toggleSave = async (id: string) => {
    const v = venues.find((x) => x.id === id);
    const next = v?.swipe_status === 'liked' ? 'rejected' : 'liked';
    await fetch(`/api/venues/${id}/swipe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: next }),
    });
    await refresh();
  };
  // Contacting one venue: Ava composes, the couple approves in the dialog.
  const [contacting, setContacting] = useState<{ id: string; name: string } | null>(null);
  const openOutreach = (id: string) => {
    const name = displayVenues.find((v) => v.id === id)?.name ?? 'venue';
    setContacting({ id, name });
  };
  // Confirmation toast shown the moment a venue becomes "jeres venue".
  const [chosenToast, setChosenToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookVenue = async (id: string) => {
    const alreadyChosen = booked === id;
    await fetch(`/api/venues/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booked: true }),
    });
    await refresh();
    if (!alreadyChosen) {
      const name = displayVenues.find((v) => v.id === id)?.name ?? null;
      setChosenToast(name);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setChosenToast(null), 3800);
    }
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Open the list, optionally straight into a venue's detail.
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const goList = (id: string | null = null) => { setPendingSelect(id); setView('list'); };

  // "Find flere som disse" seeds discovery with the names already on the list.
  const [similarSeed, setSimilarSeed] = useState(false);
  const likedNames = displayVenues.filter((v) => saved.has(v.id)).map((v) => v.name);
  const goDiscover = (similar = false) => { setSimilarSeed(similar); setView('discover'); };

  const likedNotContacted = displayVenues.filter((v) => saved.has(v.id) && !sent.has(v.id));
  const likedVenues = displayVenues.filter((v) => saved.has(v.id));
  const journeyCounts = {
    listed: likedVenues.length,
    contacted: likedVenues.filter((v) => sent.has(v.id)).length,
    replied: likedVenues.filter((v) => repliedIds.has(v.id)).length,
    quoted: likedVenues.filter((v) => quotedIds.has(v.id)).length,
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {vview === 'home' && (
          <VenuesHome
            key="home"
            couple={couple}
            chosen={booked ? displayVenues.find((v) => v.id === booked) ?? null : null}
            counts={journeyCounts}
            list={likedVenues}
            stageOf={stageOf}
            onDiscover={() => goDiscover(false)}
            onList={() => goList()}
            onReview={() => setView('review')}
            onOpenVenue={(id) => goList(id)}
            onOpenDetail={booked ? () => goList(booked) : undefined}
            onInbox={goInbox}
          />
        )}
        {vview === 'discover' && (
          <DiscoverView
            key="discover"
            couple={couple}
            savedPlaceIds={savedPlaceIds}
            similarNames={similarSeed ? likedNames : null}
            onSaved={refresh}
            onBack={hub ? undefined : () => setView('home')}
            /* The heart in the filter row. In the hub it switches to the
               Favoritter tab; standalone it opens the list view. Both routes
               already existed, hub.onSwitchTab had simply never been called. */
            onViewList={
              hub?.onSwitchTab
                ? () => hub.onSwitchTab!('shortlist', hub.category ?? 'venue')
                : hasRealVenues ? () => goList() : undefined
            }
            savedCount={saved.size}
            embedded={Boolean(hub)}
            categoryBar={hub?.categoryBar}
          />
        )}
        {vview === 'list' && (
          <PicksView key="list"
            venues={displayVenues} couple={couple}
            saved={saved} sent={sent} booked={booked}
            stageOf={stageOf}
            initialSelectedId={pendingSelect}
            onToggleSave={toggleSave} onOutreach={openOutreach}
            onBook={bookVenue}
            onBack={hub ? undefined : () => setView('home')}
            onDiscover={() => goDiscover(false)}
            onReview={() => setView('review')}
            onAva={() => onNavigate?.('ava')}
            onRefresh={refresh}
            embedded={Boolean(hub)}
            categoryBar={hub?.categoryBar} />
        )}
        {vview === 'review' && (
          <OutreachReview key="review"
            recipients={likedNotContacted}
            onBack={() => setView('list')}
            onApproved={() => { void refresh(); goInbox(); }}
            onAva={() => onNavigate?.('ava')}
          />
        )}
      </AnimatePresence>


      {/* ── "Venue valgt" confirmation toast ───────────────────────────── */}
      <AnimatePresence>
        {chosenToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="status" aria-live="polite"
            className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-8 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3.5 rounded-full bg-[#24413a] py-3 pl-4 pr-5 shadow-[0_16px_48px_rgba(18,51,43,0.32)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7d938a]">
                <Check size={16} className="text-white" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-[0.98rem] leading-snug text-[#f8f9f8]">
                  {chosenToast ? t('{name} er nu jeres venue', { name: chosenToast }) : t('Venue valgt')}
                </p>
                <p className="text-[0.72rem] text-[#a6b0aa]">{t('Alt om stedet samles nu på jeres oversigt.')}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contacting && (
          <OutreachDialog
            venueId={contacting.id}
            venueName={contacting.name}
            onClose={() => setContacting(null)}
            onSent={() => void refresh()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chosen-venue overview — read-only "jeres venue" status header ────── */
function ChosenOverview({ chosen, couple, onOpenDetail, onDiscover }: {
  chosen: DisplayVenue | null; couple: Couple;
  onOpenDetail?: () => void; onDiscover: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex min-h-[210px] flex-col overflow-hidden rounded-[18px] bg-[#24413a] sm:flex-row">
      <div className="relative flex min-h-[150px] w-full shrink-0 flex-col justify-end overflow-hidden sm:min-h-0 sm:w-[42%]">
        {chosen ? (
          <>
            <img src={imgSrc(chosen.image)} alt={chosen.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#24413a]/90 via-[#24413a]/25 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#4d5638] via-[#3B432A] to-[#24413a]" />
        )}
        <div className="relative p-5">
          {chosen ? (
            <div className="flex flex-wrap gap-2">
              {chosen.location && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">{chosen.location}</span>
              )}
              {couple.dateLabel && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">{couple.dateLabel}</span>
              )}
            </div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><MapPin size={19} className="text-white/70" /></div>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-6">
        <div className="flex flex-col gap-2">
          {chosen ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f8f9f8] px-[10px] py-1 text-[9px] font-bold uppercase tracking-wide text-[#24413a]"><Check size={11} /> {t('Valgt venue')}</span>
          ) : (
            <span className="inline-flex w-fit rounded-full bg-white/15 px-[10px] py-1 text-[9px] font-bold uppercase tracking-wide text-white/80">{t('Ingen venue valgt endnu')}</span>
          )}
          <h2 className="font-serif text-[1.6rem] leading-snug text-white">{chosen ? chosen.name : t('I har ikke valgt et sted endnu')}</h2>
          <p className="max-w-[420px] text-xs leading-[1.6] text-[#a6b0aa]">
            {chosen
              ? (chosen.quote || chosen.why[0] || chosen.location || t('Jeres valgte sted.'))
              : t('Byg jeres liste nedenfor, lad Ava kontakte dem, og vælg til sidst det sted der føles rigtigt.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {chosen && onOpenDetail && (
            <button type="button" onClick={onOpenDetail} className="inline-flex items-center gap-2 rounded-full bg-[#f8f9f8] px-5 py-2.5 text-[13px] font-bold text-[#24413a] transition-opacity hover:opacity-90 cursor-pointer">{t('Se detaljer')}</button>
          )}
          <button type="button" onClick={onDiscover} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-white/20 cursor-pointer"><GlobeIcon size={15} /> {t('Udforsk venues')}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   VENUES HOME, project-management overview + the 1-2-3 steps as a tree
═══════════════════════════════════════════════════════════════════════ */
type HomeCounts = { listed: number; contacted: number; replied: number; quoted: number };

function VenuesHome({
  couple, chosen, counts, list, stageOf, onDiscover, onList, onReview, onOpenVenue, onOpenDetail, onInbox,
}: {
  couple: Couple; chosen: DisplayVenue | null; counts: HomeCounts;
  list: DisplayVenue[]; stageOf: (id: string) => VenueStage;
  onDiscover: () => void; onList: () => void; onReview: () => void;
  onOpenVenue: (id: string) => void; onOpenDetail?: () => void; onInbox: () => void;
}) {
  const { t } = useLang();
  const metrics = [
    { label: 'På listen', value: String(counts.listed) },
    { label: 'Kontaktet', value: String(counts.contacted) },
    { label: 'Tilbud', value: String(counts.quoted) },
    { label: 'Valgt', value: chosen ? '1' : '0', accent: !chosen },
  ];

  type StepState = 'done' | 'active' | 'todo';
  const steps: {
    n: number; title: string; desc: string; stat: string; cta: string;
    Icon: typeof GlobeIcon; onClick: () => void; disabled?: boolean; state: StepState;
  }[] = [
    {
      n: 1, title: 'Opdag',
      desc: 'Find rigtige venues på kloden og tilføj dem I kan lide til listen.',
      stat: counts.listed > 0 ? t('{n} tilføjet', { n: counts.listed }) : t('Ikke startet'),
      cta: counts.listed > 0 ? t('Opdag flere') : t('Start søgning'),
      Icon: GlobeIcon, onClick: onDiscover, state: counts.listed > 0 ? 'done' : 'active',
    },
    {
      n: 2, title: 'Byg jeres liste',
      desc: 'Sammenlign, research og forfin listen, fjern dem der ikke passer.',
      stat: counts.listed > 0 ? t('{n} på listen', { n: counts.listed }) : t('Tom endnu'),
      cta: t('Rediger liste'), Icon: Heart, onClick: onList,
      disabled: counts.listed === 0, state: counts.listed > 0 ? 'active' : 'todo',
    },
    {
      n: 3, title: 'Lad Ava kontakte',
      desc: 'Godkend Avas henvendelse og følg samtalerne under Henvendelser.',
      stat: counts.contacted > 0
        ? t('{contacted} kontaktet · {replied} svar', { contacted: counts.contacted, replied: counts.replied })
        : t('Klar til at sende'),
      cta: counts.contacted > 0 ? t('Følg svarene') : t('Gennemgå & send'),
      Icon: Send, onClick: counts.contacted > 0 ? onInbox : onReview,
      disabled: counts.listed === 0,
      state: counts.contacted > 0 ? 'done' : counts.listed > 0 ? 'active' : 'todo',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 sm:px-9 lg:px-12"
    >
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Planlægning')}</p>
        <h1 className="mt-1 font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-[#24413a]">{t('Venues')}</h1>
        <p className="mt-1 max-w-xl text-[13px] text-[#5f6b66]">
          {t('Fra opdagelse til det endelige ja, her er jeres overblik og de næste skridt.')}
        </p>
      </div>

      {/* Chosen overview */}
      <ChosenOverview chosen={chosen} couple={couple} onOpenDetail={onOpenDetail} onDiscover={onDiscover} />

      {/* Metrics strip */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-card sm:grid-cols-4">
        {metrics.map((m, i) => (
          <div key={m.label} className={cn('px-5 py-4', i < 3 && 'sm:border-r border-[var(--color-line)]', i % 2 === 0 && 'border-r sm:border-r')}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted">{t(m.label)}</p>
            <p className={cn('mt-1 font-serif text-[1.6rem] leading-none', m.accent ? 'text-[#7d938a]' : 'text-ink')}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* What you've built so far */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">
            {list.length > 0 ? t('Jeres liste indtil videre · {n}', { n: list.length }) : t('Jeres liste indtil videre')}
          </p>
          {list.length > 0 && (
            <button type="button" onClick={onList}
              className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#24413a] hover:underline cursor-pointer">
              {t('Rediger liste →')}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <button
            type="button"
            onClick={onDiscover}
            className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-[var(--color-line-strong)] bg-card p-5 text-left transition-colors hover:border-[#24413a]/40 cursor-pointer"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#24413a]">
              <GlobeIcon size={18} className="text-white" />
            </span>
            <div>
              <p className="font-serif text-[1.1rem] text-ink">{t('Ingen venues endnu')}</p>
              <p className="mt-0.5 text-[0.8rem] text-ink-soft">{t('Start i Opdag og tilføj de steder I bliver forelsket i.')}</p>
            </div>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.slice(0, 8).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onOpenVenue(v.id)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-card text-left transition-shadow hover:shadow-sm cursor-pointer"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={imgSrc(v.image)} alt={v.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a221566] to-transparent" />
                  {chosen && v.id === chosen.id ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-canvas">
                      <Check size={9} /> {t('Valgt')}
                    </span>
                  ) : stageOf(v.id) !== 'idle' ? (
                    <div className="absolute left-2 top-2"><StageChip stage={stageOf(v.id)} /></div>
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="truncate font-serif text-[0.92rem] leading-tight text-ink">{v.name}</p>
                  <p className="truncate text-[0.66rem] text-muted">
                    {v.rating != null ? `★ ${v.rating.toFixed(1)}` : v.location || v.price}
                  </p>
                </div>
              </button>
            ))}
            {list.length > 8 && (
              <button
                type="button"
                onClick={onList}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line-strong)] bg-card p-4 text-center transition-colors hover:border-[#24413a]/40 cursor-pointer"
              >
                <span className="font-serif text-[1.4rem] text-ink">+{list.length - 8}</span>
                <span className="text-[0.7rem] font-semibold text-muted">{t('flere på listen')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Steps tree */}
      <div>
        <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Sådan gør I')}</p>
        <div className="relative">
          {steps.map((s, i) => {
            const badge = s.state === 'done'
              ? 'bg-[#24413a] text-white'
              : s.state === 'active'
                ? 'bg-[#7d938a] text-white'
                : 'bg-shell text-muted';
            return (
              <div key={s.n} className="relative flex gap-4 pb-3 last:pb-0">
                {i < steps.length - 1 && (
                  <span className="absolute left-[19px] top-11 bottom-1 w-px bg-[var(--color-line-strong)]" />
                )}
                <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-[1rem]', badge)}>
                  {s.state === 'done' ? <Check size={17} /> : s.n}
                </div>
                <button
                  type="button"
                  onClick={s.onClick}
                  disabled={s.disabled}
                  className={cn(
                    'flex flex-1 items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all',
                    s.disabled
                      ? 'cursor-not-allowed border-[var(--color-line)] bg-card opacity-55'
                      : 'border-[var(--color-line)] bg-card hover:border-[#24413a]/40 hover:shadow-sm cursor-pointer',
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ec] text-[#24413a]">
                      <s.Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-[1.15rem] leading-tight text-ink">{t(s.title)}</p>
                      <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-soft">{t(s.desc)}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-shell px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[#5f6b66]">{s.stat}</span>
                    </div>
                  </div>
                  {!s.disabled && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#24413a]">
                      {s.cta} <ArrowRight size={14} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DISCOVER VIEW, globe → country → region → filters → real venues
═══════════════════════════════════════════════════════════════════════ */

/** Pseudo-destination for "Find flere som disse". */
const SIMILAR_KEY = 'Ligner jeres liste';

/** Which level of the globe the couple is on. */
type GlobeLevel = 'earth' | 'country' | 'region';

/* A region for a country with no curated taxonomy: the destinations the model
   already grouped under one region name, which `groupByRegion` builds. Lived
   in the region-chip picker until that picker was removed, the areas are the
   globe's markers and the "Område" filter pill now. */
export interface AiRegion {
  label: string;
  destinations: DestinationSuggestion[];
}

/* The results grid is `sm:grid-cols-2 xl:grid-cols-3`, and an opened venue has
   to unfold after the last card in its own row, which means knowing how many
   columns there are. Read from the same breakpoints the classes use, so the
   two can only drift if someone changes one and forgets the other. */
function useGridColumns(): number {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)');
    const xl = window.matchMedia('(min-width: 1280px)');
    const read = () => setCols(xl.matches ? 3 : sm.matches ? 2 : 1);
    read();
    sm.addEventListener('change', read);
    xl.addEventListener('change', read);
    return () => {
      sm.removeEventListener('change', read);
      xl.removeEventListener('change', read);
    };
  }, []);
  return cols;
}
function DiscoverView({
  couple, savedPlaceIds, similarNames, onSaved, onBack, onViewList, savedCount = 0,
  embedded = false, categoryBar,
}: {
  couple: Couple;
  savedPlaceIds: Set<string>;
  similarNames: string[] | null;
  onSaved: () => Promise<void>;
  onBack?: () => void;
  onViewList?: () => void;
  /** Venues already on the couple's list — the number on the heart. */
  savedCount?: number;
  embedded?: boolean;
  categoryBar?: ReactNode;
}) {
  const { lang, t } = useLang();
  const { updateEvent, budgetItems, event } = useWedding();
  const venueArea = venueAreaLabel(couple.region);

  /* Seeded, not null. The globe was a mandatory first step before a Danish
     couple could even see "Nordsjælland", but we usually already know where
     they are, and Danish is the app's own language. The globe still works;
     it is just no longer a toll gate. */
  const [country, setCountry] = useState<string | null>(
    () => curatedCountryFromLocation(couple.region) ?? (lang === 'da' ? 'Denmark' : null),
  );
  /* Earth → land → område → by. The globe draws the markers for whichever
     level this is on; the panel beside it draws the same level as a list. */
  const [level, setLevel] = useState<GlobeLevel>(() => (curatedCountryFromLocation(couple.region) || lang === 'da' ? 'country' : 'earth'));
  /** The region opened at level 'region' — a curated slug or an AI label. */
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [focus, setFocus] = useState<GlobeFocus | null>(
    () => countryView(curatedCountryFromLocation(couple.region) ?? (lang === 'da' ? 'Denmark' : null)),
  );

  const [destCards, setDestCards] = useState<DestinationSuggestion[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [destFailed, setDestFailed] = useState(false);
  const seenDest = useRef<Record<string, DestinationSuggestion[]>>({});

  // City ↔ wedding-destination toggle (mirrors the onboarding globe step).
  const [destTab, setDestTab] = useState<'city' | 'wedding'>('city');
  // "Write your own" location box.
  const [custom, setCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const [destination, setDestination] = useState<string | null>(null);
  const [results, setResults] = useState<VenueSuggestion[]>([]);
  const [resultsFailed, setResultsFailed] = useState(false);

  /* The couple's requirements. Seeded from the wedding, then theirs to change.
     Only `min_capacity` refetches, it steers the prompt as well as the
     filter, and a filter cannot conjure a venue the model never looked for.
     Everything else re-filters the list already on screen. */
  const [filters, setFilters] = useState<VenueFilters>({
    min_capacity: couple.guests > 0 ? couple.guests : null,
    // What they set aside for the VENUE on the budget page — not the whole
    // wedding budget. Seeding this from the total meant a place costing every
    // krone they had counted as "within budget".
    budget_max: venueBudget(budgetItems, couple.budgetTotal),
    catering: 'any',
    accommodation: 'any',
    settings: [],
    require: [],
  });
  /* Areas are multi-select: "Nordsjælland og Fyn" is one search, not two.
     The whole selection is searched at once and the results merge into a
     single list, so a couple open to two parts of the country compares them
     side by side instead of flipping between them. */
  const [selectedRegions, setSelectedRegions] = useState<VenueRegion[]>([]);
  const [selectedAiLabels, setSelectedAiLabels] = useState<string[]>([]);
  /* Shards still in flight. A region is several parallel searches, so results
     stream in and the grid grows rather than blocking on the slowest area. */
  const [pending, setPending] = useState(0);
  /* Venues the server dropped for being too small, so the count line can say
     so instead of the list quietly being short. */
  const [hiddenCapacity, setHiddenCapacity] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<VenueSort>('relevance');

  /* The venue allocation arrives from Supabase after the first render, so the
     seed above starts from the benchmark share and is corrected here once the
     real line lands, but never after the couple has moved the slider
     themselves. Their choice outranks their budget. */
  const budgetTouched = useRef(false);
  const allocatedBudget = venueBudget(budgetItems, couple.budgetTotal);
  useEffect(() => {
    if (budgetTouched.current) return;
    setFilters((f) => (f.budget_max === allocatedBudget ? f : { ...f, budget_max: allocatedBudget }));
  }, [allocatedBudget]);

  const onFiltersChange = (next: VenueFilters) => {
    if (next.budget_max !== filters.budget_max) budgetTouched.current = true;
    setFilters(next);
  };
  /** Why the search failed, when we know. A silent generic message made a
   *  function timeout indistinguishable from "this town has no venues". */
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fullscreen photo viewer for destinations and venues.
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; alt: string } | null>(null);
  /* The venue unfolded under its row. Deliberately built from the suggestion
     rather than a saved row: opening a venue must not put it on the list. */
  const [openId, setOpenId] = useState<string | null>(null);
  const cols = useGridColumns();

  /* Once they pick a place themselves, their pick outranks their location —
     changing the chip must not yank the list back to their home town. */
  const pickedRef = useRef(false);
  /** The area the automatic search last ran for. */
  const autoSearched = useRef<string | null>(null);
  /* The area we search on our own. "Find flere som disse" owns the first
     search when it is armed, so it opts out. */
  const autoArea = similarNames && similarNames.length > 0 ? '' : venueArea;
  /** Fall back to the couple's area, or to the picker when we have no area. */
  const backToArea = async () => {
    if (!autoArea) { setDestination(null); setResults([]); return; }
    pickedRef.current = false;
    autoSearched.current = autoArea;
    await searchVenues(autoArea, { quiet: true });
  };
  // The results section below the globe — scrolled into view once a place is chosen.
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => {
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  // Default the toggle to whichever category actually has cards.
  const applyDefaultTab = (list: DestinationSuggestion[]) =>
    setDestTab(list.some((s) => s.kind === 'city') ? 'city' : 'wedding');

  const loadDestinations = async (c: string) => {
    setDestFailed(false);
    const hit = seenDest.current[c];
    if (hit) { setDestCards(hit); applyDefaultTab(hit); return; }
    setDestLoading(true);
    setDestCards([]);
    try {
      const res = await fetch(`/api/onboarding/destinations?country=${encodeURIComponent(c)}&lang=${lang}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { suggestions?: DestinationSuggestion[] };
      const list = data.suggestions ?? [];
      if (list.length === 0) { setDestFailed(true); return; }
      seenDest.current[c] = list;
      setDestCards(list);
      applyDefaultTab(list);
    } catch {
      setDestFailed(true);
    } finally {
      setDestLoading(false);
    }
  };

  /* The globe has always passed the clicked coordinates as a second argument
     and every call site has always dropped them. They are the camera target
     for a country we have no curated view of. */
  const pickCountry = (c: string, coords?: { lat: number; lng: number }) => {
    setCustom(false);
    setCountry(c);
    setOpenRegion(null);
    setLevel('country');
    setFocus(countryView(c) ?? (coords ? { ...coords, altitude: 0.9 } : null));
    void loadDestinations(c);
  };

  /* What every search sends. The requirements steer the prompt — asking the
     model for venues that seat 70 with rooms on site beats asking for
     anything and discarding most of it. */
  const searchBody = (extra: Record<string, unknown>) => ({
    // Where the couple actually is, so every venue can carry a distance.
    origin: venueArea || couple.region || undefined,
    guest_count: filters.min_capacity ?? undefined,
    budget: filters.budget_max ? String(filters.budget_max) : undefined,
    lang,
    filters: {
      catering: filters.catering,
      accommodation: filters.accommodation,
      settings: filters.settings,
    },
    ...extra,
  });

  /** Merge a shard's results in, keeping the first sighting of each place. */
  const mergeVenues = (prev: VenueSuggestion[], incoming: VenueSuggestion[]) => {
    const seen = new Set(prev.map((v) => v.place_id ?? v.id));
    const added = incoming.filter((v) => {
      const key = v.place_id ?? v.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return added.length ? [...prev, ...added] : prev;
  };

  interface ShardResponse { venues?: VenueSuggestion[]; hidden?: { capacity?: number } }

  /** One area. Never throws — a single failed shard must not empty a region. */
  const fetchShard = async (body: Record<string, unknown>): Promise<ShardResponse | null> => {
    try {
      const res = await fetch('/api/onboarding/venues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody(body)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ShardResponse;
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  /** Run a set of shards in parallel, streaming each one in as it lands. */
  const runShards = async (bodies: Record<string, unknown>[], append: boolean) => {
    setResultsFailed(false);
    setResultsError(null);
    if (!append) { setResults([]); setHiddenCapacity(0); }
    setPending(bodies.length);
    let got = 0;
    await Promise.all(
      bodies.map(async (body) => {
        const data = await fetchShard(body);
        if (data?.venues?.length) {
          got += data.venues.length;
          setResults((prev) => mergeVenues(prev, data.venues!));
        }
        if (data?.hidden?.capacity) setHiddenCapacity((h) => h + data.hidden!.capacity!);
        setPending((n) => n - 1);
      })
    );
    if (!append && got === 0) setResultsFailed(true);
  };

  /* A whole region: one request per area, in parallel. This is what turns
     "seven venues in Copenhagen" into a browsable list, a single request
     could never do it inside the platform's function budget. */
  /* One search across every picked area. `shardsFor` spreads a fixed request
     budget round-robin, so two regions run at full depth and ten still each
     contribute something rather than the first two eating the budget. */
  const searchRegions = async (rs: VenueRegion[]) => {
    setSelectedRegions(rs);
    setSelectedAiLabels([]);
    // Dropping the last area shouldn't blank the page — fall back to the
    // couple's own patch, which is where the list started.
    if (rs.length === 0) { await backToArea(); return; }
    pickedRef.current = true;
    setDestination(regionsLabel(rs, lang));
    scrollToResults();
    await runShards(shardsFor(rs).map((sh) => ({ ...sh })), false);
  };

  /** Add or remove one region, then re-run the search for what is left. */
  const toggleRegion = (r: VenueRegion) => {
    const next = selectedRegions.some((x) => x.slug === r.slug)
      ? selectedRegions.filter((x) => x.slug !== r.slug)
      : [...selectedRegions, r];
    void searchRegions(next);
  };

  /* Countries with no curated taxonomy: the destinations the model grouped
     under one region name become that region's shards. */
  const searchAiRegions = async (rs: AiRegion[]) => {
    setSelectedRegions([]);
    setSelectedAiLabels(rs.map((r) => r.label));
    if (rs.length === 0) { await backToArea(); return; }
    pickedRef.current = true;
    setDestination(rs.map((r) => r.label).join(', '));
    scrollToResults();
    // Same budget as the curated path, interleaved for the same reason.
    const bodies: Record<string, unknown>[] = [];
    const deepest = Math.max(...rs.map((r) => r.destinations.length));
    for (let depth = 0; depth < deepest && bodies.length < MAX_SHARDS; depth++) {
      for (const r of rs) {
        if (bodies.length >= MAX_SHARDS) break;
        const d = r.destinations[depth];
        if (d) bodies.push({ destination: `${d.name}, ${country}` });
      }
    }
    await runShards(bodies, false);
  };

  const toggleAiRegion = (r: AiRegion) => {
    const next = selectedAiLabels.includes(r.label)
      ? aiRegions.filter((x) => selectedAiLabels.includes(x.label) && x.label !== r.label)
      : [...aiRegions.filter((x) => selectedAiLabels.includes(x.label)), r];
    void searchAiRegions(next);
  };

  /* A single city or a free-text place — the narrow path, unchanged in feel.
     `quiet` is the automatic search for the couple's own area: it must not
     scroll (nothing has moved yet) and must not count as them picking. */
  const searchVenues = async (dest: string, opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) pickedRef.current = true;
    setSelectedRegions([]);
    setSelectedAiLabels([]);
    setDestination(dest);
    if (!opts?.quiet) scrollToResults();
    await runShards([{ destination: dest }], false);
  };

  /* "Vis flere" — the exclude mechanism has existed server-side since the
     first version of this route and no client ever called it. */
  const loadMore = async () => {
    if (!destination) return;
    setLoadingMore(true);
    const exclude = results.map((v) => v.name);
    const exclude_place_ids = results.map((v) => v.place_id).filter((id): id is string => Boolean(id));
    const page = { exclude, exclude_place_ids };
    try {
      if (selectedRegions.length > 0) {
        await runShards(shardsFor(selectedRegions).map((sh) => ({ ...sh, ...page })), true);
      } else if (destination !== SIMILAR_KEY) {
        await runShards([{ destination, ...page }], true);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // "Find flere som disse" — recommendations seeded by what's already on the
  // list, reusing the same curator endpoint with the liked names as the vibe.
  const searchSimilar = async (names: string[]) => {
    setSelectedRegions([]);
    setSelectedAiLabels([]);
    setDestination(SIMILAR_KEY);
    scrollToResults();
    await runShards(
      [{
        destination: venueArea || couple.region || 'jeres område',
        loved_destinations: names.slice(0, 8),
      }],
      false
    );
  };

  /* The couple's own area is already on the wedding — it is the chip in the
     top right of this very page. Search it. Making them find Denmark on a
     globe and click "Odense" to tell us "Odense" was the whole friction. */
  useEffect(() => {
    if (!autoArea || pickedRef.current) return;
    if (autoSearched.current === autoArea) return;
    autoSearched.current = autoArea;
    void searchVenues(autoArea, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoArea]);

  /* Load the seeded country once. Not in the pickCountry path, because the
     couple never picked it, and `loadDestinations` memoises per country, so
     a later globe click on the same country costs nothing. */
  const seededCountryRef = useRef(false);
  useEffect(() => {
    if (seededCountryRef.current || !country) return;
    seededCountryRef.current = true;
    void loadDestinations(country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !similarNames || similarNames.length === 0) return;
    seededRef.current = true;
    void searchSimilar(similarNames);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [similarNames]);

  const submitCustom = () => {
    const v = customValue.trim();
    if (v) void searchVenues(v);
  };

  const saveVenue = async (v: VenueSuggestion) => {
    setSavingId(v.id);
    try {
      const res = await fetch('/api/venues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue: v }),
      });
      if (res.ok) {
        setJustSaved((prev) => new Set(prev).add(v.id));
        await onSaved();
      }
    } finally {
      setSavingId(null);
    }
  };

  const isSaved = (v: VenueSuggestion) =>
    justSaved.has(v.id) || (v.place_id != null && savedPlaceIds.has(v.place_id));

  // Dismissing an AI suggestion just hides it for this session (there is no DB
  // row to reject yet — it only exists once added to the list).
  const dismissVenue = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  const cities = destCards.filter((s) => s.kind === 'city');
  const weddings = destCards.filter((s) => s.kind === 'wedding');
  const activeDest = destTab === 'city' ? cities : weddings;

  /* Regions for the picker: curated where we have them, otherwise the model's
     own region strings, grouped. */
  const curatedRegions = country ? regionsForCountry(country) : [];
  const aiRegions: AiRegion[] = useMemo(
    () => (curatedRegions.length > 0 || destCards.length === 0
      ? []
      : groupByRegion(destCards, t('Andre steder'))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destCards, curatedRegions.length]
  );
  /* ── The globe's drill-down ─────────────────────────────────────────── */

  /** The open region's own name, for the breadcrumb and the panel title. */
  const openRegionLabel = useMemo(() => {
    if (!openRegion) return null;
    const curated = findRegion(openRegion);
    return curated ? regionShortLabel(curated, lang) : openRegion;
  }, [openRegion, lang]);

  /** The town rows of the open region, whichever taxonomy it came from. */
  const openRegionTowns = ((): { id: string; label: string; point: GeoPoint | null }[] => {
    if (!openRegion) return [];
    const curated = findRegion(openRegion);
    if (curated) {
      return curated.areas.map((a) => ({
        id: `${a}, ${curated.country}`,
        label: a,
        point: areaPoint(a),
      }));
    }
    const ai = aiRegions.find((r) => r.label === openRegion);
    if (!ai) return [];
    return ai.destinations.map((d) => ({
      id: `${d.name}, ${country}`,
      label: d.name,
      point: d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null,
    }));
  })();

  /* The country's areas. These used to be the dots on the globe; the globe
     carries no place markers any more, so they are a chip row in the panel —
     the one place that still has room to name them. */
  const regionChoices = ((): GlobePlace[] => {
    if (level === 'earth' || !country) return [];
    if (level === 'country') {
      if (curatedRegions.length > 0) {
        return curatedRegions.flatMap((r) => {
          const view = regionView(r.slug);
          if (!view) return [];
          return [{
            id: r.slug,
            name: regionShortLabel(r, lang),
            lat: view.lat,
            lng: view.lng,
            kind: 'region' as const,
          }];
        });
      }
      // No curated taxonomy: the model's groupings, placed at the middle of
      // the destinations Google already put on the map for them.
      return aiRegions.flatMap((r) => {
        const mid = centroid(
          r.destinations
            .filter((d) => d.lat != null && d.lng != null)
            .map((d) => ({ lat: d.lat!, lng: d.lng! }))
        );
        if (!mid) return [];
        return [{
          id: r.label,
          name: r.label,
          lat: mid.lat,
          lng: mid.lng,
          kind: 'region' as const,
        }];
      });
    }
    return openRegionTowns.flatMap((tn) => (tn.point ? [{
      id: tn.id,
      name: tn.label,
      lat: tn.point.lat,
      lng: tn.point.lng,
      kind: 'city' as const,
    }] : []));
  })();

  /** Open a region: fly to it, list its towns, and search it straight away. */
  const openRegionLevel = (id: string) => {
    setOpenRegion(id);
    setLevel('region');
    const curated = findRegion(id);
    if (curated) {
      const view = regionView(curated.slug);
      if (view) setFocus(view);
      void searchRegions([curated]);
      return;
    }
    const ai = aiRegions.find((r) => r.label === id);
    if (!ai) return;
    const mid = centroid(
      ai.destinations
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({ lat: d.lat!, lng: d.lng! }))
    );
    if (mid) setFocus({ ...mid, altitude: 0.5 });
    void searchAiRegions([ai]);
  };

  /** A town is the end of the drill: search it, and sit the camera on it. */
  const openTown = (query: string, point: GeoPoint | null) => {
    if (point) setFocus({ ...point, altitude: TOWN_ALTITUDE });
    void searchVenues(query);
  };

  /** One step back out — a town view returns to its region, a region to Earth. */
  const zoomOut = () => {
    if (level === 'region') {
      setOpenRegion(null);
      setLevel('country');
      const view = countryView(country);
      setFocus(view ?? null);
      return;
    }
    setOpenRegion(null);
    setLevel('earth');
    setFocus({ lat: 35, lng: 10, altitude: 2.1 });
  };

  /* Filtering happens here, over the venues already fetched — flipping a
     toggle re-ranks the list instantly instead of costing another search. */
  const notDismissed = useMemo(
    () => results.filter((v) => !dismissed.has(v.id)),
    [results, dismissed]
  );
  const { kept, rejected } = useMemo(
    () => applyFilters(notDismissed, filters, lang === 'en' ? 'en' : 'da', sort),
    [notDismissed, filters, lang, sort]
  );
  const visibleResults = kept;

  const counts: VenueFilterCounts = {
    total: notDismissed.length,
    shown: kept.length,
    withCatering: notDismissed.filter((v) => v.facts.catering === 'in_house').length,
    withStay: notDismissed.filter(
      (v) => v.facts.accommodation === 'on_site' || v.facts.accommodation === 'nearby'
    ).length,
    // The server drops the too-small ones before they ever reach the client;
    // the client drops any that slip through when the guest count changes.
    hiddenCapacity: hiddenCapacity + rejected.filter((r) => r.verdict.rejectedBy === 'capacity').length,
  };

  /* Which filter emptied the list, so the empty state can say something
     useful instead of "no venues here". */
  const blockingRule = rejected.length > 0 && kept.length === 0
    ? rejected[0].verdict.rejectedBy
    : null;

  const searching = pending > 0;

  /* The area switcher in the filter bar. Curated regions win; otherwise the
     model's own groupings, so both look identical to the control. */
  const regionOptions: RegionOption[] = curatedRegions.length > 0
    ? curatedRegions.map((r) => ({ id: r.slug, label: regionShortLabel(r, lang) }))
    : aiRegions.map((r) => ({ id: r.label, label: r.label }));

  /** Slugs currently searched, whichever source they came from. */
  const activeRegionIds = curatedRegions.length > 0
    ? selectedRegions.map((r) => r.slug)
    : selectedAiLabels;

  const toggleRegionById = (id: string) => {
    const curated = curatedRegions.find((r) => r.slug === id);
    if (curated) { toggleRegion(curated); return; }
    const ai = aiRegions.find((r) => r.label === id);
    if (ai) toggleAiRegion(ai);
  };

  /* Guest count steers the prompt, so changing it re-runs the current search
    , and it belongs to the wedding, not just this screen. */
  const onGuestsCommit = (guests: number | null) => {
    if (guests && guests !== couple.guests) void updateEvent({ guest_count: guests });
    if (!destination) return;
    if (selectedRegions.length > 0) void searchRegions(selectedRegions);
    else if (selectedAiLabels.length > 0) {
      void searchAiRegions(aiRegions.filter((r) => selectedAiLabels.includes(r.label)));
    } else if (destination !== SIMILAR_KEY) {
      // A re-run of the same place, not a new pick — don't scroll, and don't
      // pin the destination against a later change to their location.
      void searchVenues(destination, { quiet: true });
    }
  };

  const destTitle = destination === SIMILAR_KEY ? t('Ligner jeres liste') : destination;

  /* Where the opened venue's panel goes: after the last card in its row, or
     after the last card of all when its row is short. */
  const openIndex = openId ? visibleResults.findIndex((r) => r.venue.id === openId) : -1;
  const openRow = openIndex >= 0 ? visibleResults[openIndex] : null;
  const panelAfter = panelSlot(openIndex, cols, visibleResults.length);


  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-6',
        embedded ? 'px-0 py-0' : 'px-6 py-8 sm:px-9 lg:px-12',
      )}
    >
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
          <ArrowLeft size={13} /> {t('Venues')}
        </button>
      )}

      {categoryBar}

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Globe */}
        <div data-tour="team-globe" className="relative h-[min(62vh,560px)] overflow-hidden rounded-[28px] border border-[#dcdfdb] bg-[#f8f9f8]">
          <DestinationGlobe
            selectedCountry={country}
            onCountryPick={pickCountry}
            focus={focus}
          />
        </div>

        {/* Destination panel, areas, cities, or write your own */}
        <div className="flex min-h-[320px] max-h-[min(62vh,560px)] flex-col overflow-hidden rounded-[28px] border border-[#dcdfdb] bg-[#ffffff]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e6e9e5] px-5 py-4">
            <div className="min-w-0">
              {/* Where you are, and every step back out. */}
              <nav aria-label={t('Destination')} className="flex flex-wrap items-center gap-1 text-[0.68rem] text-muted">
                <button
                  type="button"
                  onClick={() => { setOpenRegion(null); setLevel('earth'); setFocus({ lat: 35, lng: 10, altitude: 2.1 }); }}
                  className={cn('cursor-pointer transition-colors hover:text-[#24413a]', level === 'earth' && 'font-semibold text-[#24413a]')}
                >
                  {t('Jorden')}
                </button>
                {country && (
                  <>
                    <span aria-hidden className="opacity-50">/</span>
                    <button
                      type="button"
                      onClick={() => { setOpenRegion(null); setLevel('country'); setFocus(countryView(country) ?? null); }}
                      className={cn('cursor-pointer transition-colors hover:text-[#24413a]', level === 'country' && 'font-semibold text-[#24413a]')}
                    >
                      {country}
                    </button>
                  </>
                )}
                {level === 'region' && openRegionLabel && (
                  <>
                    <span aria-hidden className="opacity-50">/</span>
                    <span className="font-semibold text-[#24413a]">{openRegionLabel}</span>
                  </>
                )}
              </nav>
              <h3 className="truncate font-serif text-[1.2rem] leading-tight text-ink">
                {level === 'region' ? openRegionLabel : country ?? t('Vælg et sted')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setCustom((c) => !c)}
              aria-pressed={custom}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.72rem] font-semibold transition-colors cursor-pointer',
                custom
                  ? 'border-[#24413a] bg-[#e8f0ec] text-[#24413a]'
                  : 'border-[#dcdfdb] text-[#5f6b66] hover:border-[#24413a] hover:text-[#24413a]',
              )}
            >
              <PenLine size={13} /> {t('Skriv selv')}
            </button>
          </div>

          {/* Write-your-own location box */}
          <AnimatePresence initial={false}>
            {custom && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0 overflow-hidden border-b border-[#e6e9e5] bg-[#f8f9f8]"
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <input
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
                    placeholder={t('f.eks. Sydfyn · Toscana · jeres sommerhusby')}
                    className="h-9 min-w-0 flex-1 rounded-full border border-[#dcdfdb] bg-[#ffffff] px-4 text-[0.82rem] text-ink placeholder:text-[#9a9686] focus:border-[#24413a] focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={submitCustom}
                    disabled={!customValue.trim()}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#24413a] px-3.5 text-[0.72rem] font-semibold text-[#f8f9f8] transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    <Search size={13} /> {t('Søg')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Areas+cities ↔ wedding-destination toggle */}
          {level !== 'region' && !destLoading && !destFailed && country && (cities.length > 0 || weddings.length > 0) && (
            <div className="flex shrink-0 gap-0.5 border-b border-[#e6e9e5] px-3">
              {[
                { id: 'city' as const, label: t('Byer'), count: cities.length },
                { id: 'wedding' as const, label: t('Bryllupsdestinationer'), count: weddings.length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  disabled={count === 0}
                  onClick={() => setDestTab(id)}
                  className={cn(
                    'flex-1 border-b-2 px-2 py-2.5 text-center text-[0.64rem] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer',
                    destTab === id ? 'border-[#24413a] text-[#24413a]' : 'border-transparent text-muted hover:text-ink',
                    count === 0 && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {level === 'region' ? (
              /* Inside a region: its towns, each one a search and a heart. */
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#dcdfdb] px-3 py-1.5 text-[0.72rem] font-semibold text-[#5f6b66] transition-colors hover:border-[#24413a] hover:text-[#24413a] cursor-pointer"
                >
                  <ArrowLeft size={12} /> {t('Zoom ud')}
                </button>
                {openRegionTowns.length === 0 && (
                  <p className="px-1 py-6 text-center text-[0.85rem] text-ink-soft">
                    {t('Ingen byer her endnu.')}
                  </p>
                )}
                {openRegionTowns.map((tn) => (
                  <div
                    key={tn.id}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors',
                      destination === tn.id
                        ? 'border-[#24413a] bg-[#e8f0ec]'
                        : 'border-[#e6e9e5] bg-[#ffffff] hover:border-[#24413a]/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openTown(tn.id, tn.point)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <MapPin size={13} className="shrink-0 text-[#7d938a]" />
                      <span className="truncate text-[0.88rem] font-medium text-ink">{tn.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : !country ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#24413a]">
                  <GlobeIcon size={19} className="text-white" />
                </div>
                <p className="text-[0.88rem] leading-relaxed text-ink-soft">
                  {t('Tryk på et land på kloden, eller skriv selv et sted, for at se byer og bryllupsdestinationer.')}
                </p>
                {venueArea && (
                  <button
                    type="button"
                    onClick={() => void searchVenues(venueArea)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#24413a] px-4 py-2.5 text-[0.78rem] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    <MapPin size={13} />
                    {t('Søg venues nær {area}', { area: venueArea })}
                  </button>
                )}
              </div>
            ) : destLoading ? (
              <PanelSpinner label={t('Finder byer og destinationer i {country}…', { country: country! })} />
            ) : destFailed ? (
              <PanelError label={t('Kunne ikke hente destinationer.')} onRetry={() => void loadDestinations(country)} />
            ) : (
              <div className="flex flex-col gap-4">
                {regionChoices.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted">
                      {t('Områder')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {regionChoices.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => openRegionLevel(r.id)}
                          className="rounded-full border border-[#e6e9e5] bg-white px-3 py-1.5 text-[0.76rem] font-medium text-ink transition-colors hover:border-[#24413a] cursor-pointer"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {activeDest.map((s) => (
                    <DiscoverDestCard
                      key={`${s.kind}-${s.name}`}
                      s={s}
                      active={destination === `${s.name}, ${country}`}
                      onChoose={() => openTown(
                        `${s.name}, ${country}`,
                        s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
                      )}
                      onExpand={s.photo ? () => setLightbox({ photos: [s.photo!], index: 0, alt: s.name }) : undefined}
                    />
                  ))}
                  {activeDest.length === 0 && destTab === 'wedding' && (
                    <p className="px-1 py-6 text-center text-[0.85rem] text-ink-soft">{t('Ingen forslag i denne kategori.')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chosen place → real venues, listed & picture-rich (no swipe) ─── */}
      <div ref={resultsRef} className="scroll-mt-6">
        {destination && (
          <div className="flex flex-col gap-5">
            <div className="border-b border-[#e2e6e2] pb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Venues')}</p>
              <h2 className="mt-1 font-serif text-[clamp(1.5rem,3vw,2rem)] leading-tight text-[#24413a]">
                {destTitle}
              </h2>
              <p className="mt-1 text-[13px] text-[#5f6b66]">
                {t('Tryk på et venue for at se det hele, I behøver ikke gemme det først.')}
              </p>
            </div>

            <VenueFilterBar
              filters={filters}
              onChange={onFiltersChange}
              onGuestsCommit={onGuestsCommit}
              regions={regionOptions}
              activeRegionIds={activeRegionIds}
              onRegionToggle={toggleRegionById}
              sort={sort}
              onSortChange={setSort}
              counts={counts}
              hasDistances={notDismissed.some((v) => v.distance_km != null)}
              allocatedBudget={allocatedBudget}
              loading={searching}
              savedCount={savedCount}
              onOpenSaved={onViewList}
            />

            {searching && results.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[#e6e9e5] bg-[#ffffff]">
                    <div className="h-44 bg-[#eceeeb]" />
                    <div className="space-y-2 p-4">
                      <div className="h-4 w-1/2 rounded bg-[#eceeeb]" />
                      <div className="h-3 w-5/6 rounded bg-[#eceeeb]" />
                      <div className="h-3 w-2/3 rounded bg-[#eceeeb]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : resultsFailed ? (
              <div className="rounded-2xl border border-[#e6e9e5] bg-[#ffffff] p-8 text-center">
                <p className="text-[0.9rem] text-ink-soft">{t('Kunne ikke finde venues her.')}</p>
                {resultsError && (
                  <p className="mt-1.5 text-[0.75rem] text-[#9a9686]">{resultsError}</p>
                )}
                <button
                  type="button"
                  onClick={() => (selectedRegions.length > 0 ? void searchRegions(selectedRegions) : void searchVenues(destination))}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#24413a] px-4 py-2 text-[0.78rem] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                >
                  {t('Prøv igen')}
                </button>
              </div>
            ) : visibleResults.length === 0 ? (
              <div className="rounded-2xl border border-[#e6e9e5] bg-[#ffffff] p-8 text-center">
                <p className="text-[0.9rem] text-ink-soft">
                  {blockingRule === 'capacity' && filters.min_capacity
                    ? t('Ingen steder til {guests} gæster her, prøv et andet område, eller sænk antallet.', { guests: filters.min_capacity })
                    : blockingRule === 'budget'
                      ? t('Ingen steder inden for budgettet her, hæv budgettet, eller slå "kun inden for budget" fra.')
                      : blockingRule === 'catering'
                        ? t('Ingen steder med catering i huset her, slå kravet fra for at se resten.')
                        : blockingRule === 'accommodation'
                          ? t('Ingen steder med overnatning her, slå kravet fra for at se resten.')
                          : blockingRule === 'setting'
                            ? t('Ingen steder med den stemning her, vælg flere stemninger.')
                            : t('Ingen venues tilbage her, prøv et andet sted.')}
                </p>
                {rejected.length > 0 && (
                  <p className="mt-1.5 text-[0.75rem] text-[#9a9686]">
                    {t('{n} steder blev filtreret fra.', { n: rejected.length })}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleResults.map(({ venue: v, verdict }, i) => (
                    <Fragment key={v.id}>
                      <DiscoverVenueCard
                        v={v}
                        badges={verdict.badges}
                        saved={isSaved(v)}
                        saving={savingId === v.id}
                        open={openId === v.id}
                        onOpen={() => setOpenId((cur) => (cur === v.id ? null : v.id))}
                        onSave={() => void saveVenue(v)}
                        onDismiss={() => dismissVenue(v.id)}
                        onExpand={
                          v.photos.length || v.photo
                            ? () => setLightbox({ photos: v.photos.length ? v.photos : [v.photo!], index: 0, alt: v.name })
                            : undefined
                        }
                      />
                      {/* The open venue unfolds in full width after the last
                          card of its own row, so the grid is pushed down
                          rather than replaced. */}
                      {i === panelAfter && openRow && (
                        <VenuePanel
                          v={openRow.venue}
                          badges={openRow.verdict.badges}
                          saved={isSaved(openRow.venue)}
                          saving={savingId === openRow.venue.id}
                          onSave={() => void saveVenue(openRow.venue)}
                          onClose={() => setOpenId(null)}
                          onPhoto={(index) => setLightbox({
                            photos: openRow.venue.photos.length ? openRow.venue.photos : [openRow.venue.photo!],
                            index,
                            alt: openRow.venue.name,
                          })}
                        />
                      )}
                    </Fragment>
                  ))}
                  {/* A shard still in flight, the grid grows as areas land. */}
                  {searching && [0, 1, 2].map((i) => (
                    <div key={`shard-${i}`} className="animate-pulse overflow-hidden rounded-2xl border border-[#e6e9e5] bg-[#ffffff]">
                      <div className="h-44 bg-[#eceeeb]" />
                      <div className="space-y-2 p-4">
                        <div className="h-4 w-1/2 rounded bg-[#eceeeb]" />
                        <div className="h-3 w-5/6 rounded bg-[#eceeeb]" />
                      </div>
                    </div>
                  ))}
                </div>

                {!searching && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={loadingMore || destination === SIMILAR_KEY}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#dcdfdb] px-5 text-xs font-semibold text-[#5f6b66] transition-colors hover:border-[#24413a] hover:text-[#24413a] disabled:opacity-40 cursor-pointer"
                    >
                      {loadingMore ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {t('Vis flere')}
                    </button>
                  </div>
                )}
                {justSaved.size > 0 && onViewList && (
                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={onViewList}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#24413a] px-5 text-xs font-semibold text-[#f8f9f8] transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      {t('Se jeres liste ({n})', { n: justSaved.size })} <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {lightbox && lightbox.photos.length > 0 && (
        <Lightbox
          photos={lightbox.photos}
          index={Math.min(Math.max(lightbox.index, 0), lightbox.photos.length - 1)}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
          alt={lightbox.alt}
        />
      )}
    </motion.div>
  );
}

/* Photo-rich destination card — choosing it loads that place's venues below. */
function DiscoverDestCard({ s, active, onChoose, onExpand }: {
  s: DestinationSuggestion; active: boolean; onChoose: () => void; onExpand?: () => void;
}) {
  const { t } = useLang();
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl border transition-colors',
      active ? 'border-[#24413a] shadow-[0_6px_18px_rgba(18,51,43,0.12)]' : 'border-[#e6e9e5] hover:border-[#24413a]/40',
    )}>
      <button type="button" onClick={onChoose} className="block w-full text-left cursor-pointer">
        {s.photo ? (
          <div className="relative h-28 w-full overflow-hidden">
            <img src={s.photo} alt={s.name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-[#e8f0ec]">
            <MapPin size={18} className="text-[#24413a] opacity-40" />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <p className="truncate font-serif text-[0.98rem] text-[#24413a]">{s.name}</p>
            <span className="shrink-0 rounded-full bg-[#eceeeb] px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#24413a]">
              {s.kind === 'city' ? t('By') : t('Bryllup')}
            </span>
            {s.rating != null && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[0.7rem] text-ink-soft">
                <Star size={11} className="fill-[#e6a34e] text-[#e6a34e]" />{s.rating.toFixed(1)}
              </span>
            )}
          </div>
          {s.blurb && <p className="mt-1 line-clamp-2 text-[0.74rem] leading-snug text-[#5f6b66]">{s.blurb}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#24413a]">
            {active ? <><Check size={12} /> {t('Viser venues')}</> : <>{t('Se venues')} <ArrowRight size={12} /></>}
          </p>
        </div>
      </button>
      {onExpand && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          aria-label={t('Forstør billede')}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#ffffff]/90 text-ink-soft shadow-sm transition-colors hover:text-ink cursor-pointer"
        >
          <Expand size={14} />
        </button>
      )}
    </div>
  );
}

/* Picture-rich venue card for the discovery list — click the image to browse
   photos, or add it straight to the couple's list. No swipe. */
function DiscoverVenueCard({ v, badges, saved, saving, open, onOpen, onSave, onDismiss, onExpand }: {
  v: VenueSuggestion; badges: VenueBadge[]; saved: boolean; saving: boolean;
  open: boolean; onOpen: () => void;
  onSave: () => void; onDismiss: () => void; onExpand?: () => void;
}) {
  const { t } = useLang();
  return (
    <div className={cn(
      'group flex flex-col overflow-hidden rounded-2xl border bg-[#ffffff] transition-shadow',
      open ? 'border-[#24413a] shadow-[0_10px_28px_rgba(18,51,43,0.10)]' : 'border-[#e6e9e5] hover:shadow-[0_10px_28px_rgba(18,51,43,0.10)]',
    )}>
      {/* The picture opens the venue; the corner button opens the photos.
          Siblings, not nested, a button inside a button is invalid HTML and
          the inner one stops working. */}
      <div className="relative h-44 w-full overflow-hidden bg-[#e8f0ec]">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-label={t('Åbn {name}', { name: v.name })}
          className="block h-full w-full cursor-pointer"
        >
          {v.photo ? (
            <img src={v.photo} alt={v.name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin size={22} className="text-[#24413a] opacity-40" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </button>
        {v.rating != null && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm">
            <Star size={11} fill="currentColor" className="text-[#e6a34e]" />
            {v.rating.toFixed(1)}
            {v.review_count ? <span className="font-normal text-muted">({v.review_count})</span> : null}
          </span>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={t('Se billeder af {name}', { name: v.name })}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#141a13]/40 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Expand size={14} />
          </button>
        )}
        {v.photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] font-semibold text-white backdrop-blur-sm">
            {t('{n} billeder', { n: v.photos.length })}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-serif text-[1.05rem] leading-tight text-[#24413a] hover:underline underline-offset-4 cursor-pointer"
        >
          {v.name}
        </button>
        {v.address && (
          <p className="mt-1 flex items-start gap-1 text-[0.72rem] text-[#5f6b66]">
            <MapPin size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-1">{v.address}</span>
          </p>
        )}
        {v.why_fit && <p className="mt-2 line-clamp-2 text-[0.78rem] leading-snug text-ink-soft">{v.why_fit}</p>}
        {/* The facts the couple filtered on, stated plainly, including the
            ones we do not know, so a blank is never mistaken for a "no". */}
        {badges.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b.id}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[0.64rem] font-semibold',
                  b.tone === 'good' && 'bg-[#e8f0ec] text-[#24413a]',
                  b.tone === 'warn' && 'bg-[#f7ece0] text-[#8a5a22]',
                  b.tone === 'neutral' && 'bg-[#eceeeb] text-[#5f6b66]',
                )}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saved || saving}
            onClick={onSave}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[0.74rem] font-bold transition-colors',
              saved ? 'bg-[#e8f0ec] text-[#24413a] cursor-default' : 'bg-[#24413a] text-white hover:opacity-90 cursor-pointer',
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Plus size={13} />}
            {saved ? t('På listen') : t('Tilføj til liste')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('Afvis {name}', { name: v.name })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#5f6b66] transition-colors hover:bg-[#eceeeb] hover:text-[#24413a] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelSpinner({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 size={20} className="animate-spin text-muted" />
      <p className="max-w-[260px] text-[0.8rem] leading-relaxed text-ink-soft">{label}</p>
    </div>
  );
}

function PanelError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[0.85rem] text-ink-soft">{label}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-[#24413a]/20 px-4 py-2 text-[0.75rem] font-bold text-[#24413a] hover:bg-[#f8f9f8] transition-colors cursor-pointer"
      >
        {t('Prøv igen')}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PICKS VIEW, venue management
═══════════════════════════════════════════════════════════════════════ */
function PicksView({
  venues, couple, saved, sent, booked, stageOf, initialSelectedId, onToggleSave, onOutreach, onBook, onDiscover, onBack, onReview, onAva, onRefresh, embedded = false, categoryBar,
}: {
  venues: DisplayVenue[];
  couple: Couple;
  saved: Set<string>; sent: Set<string>; booked: string | null;
  stageOf: (id: string) => VenueStage;
  initialSelectedId?: string | null;
  onToggleSave: (id: string) => void; onOutreach: (id: string) => void;
  onBook: (id: string) => void; onDiscover: () => void; onAva: () => void;
  onBack?: () => void;
  onReview: () => void;
  onRefresh: () => Promise<void>;
  embedded?: boolean;
  categoryBar?: ReactNode;
}) {
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [comparing, setComparing] = useState(false);
  const venueCity = venueAreaLabel(couple.region);
  const savedVenues = venues.filter(v => saved.has(v.id));
  const selectedVenue = selectedId ? venues.find((v) => v.id === selectedId) ?? null : null;
  const padX = embedded ? 'px-0' : 'px-6 sm:px-9 lg:px-12';

  // Booked first, then saved, then the rest.
  const sortedVenues = [...venues].sort((a, b) => {
    const rank = (v: DisplayVenue) => (v.id === booked ? 0 : saved.has(v.id) ? 1 : 2);
    return rank(a) - rank(b);
  });

  if (comparing && savedVenues.length >= 2) {
    return (
      <ComparisonView
        venues={savedVenues}
        saved={saved}
        booked={booked}
        onBack={() => setComparing(false)}
        onToggleSave={onToggleSave}
        onBook={onBook}
      />
    );
  }

  if (selectedVenue) {
    return (
      <AnimatePresence mode="wait">
        <VenueDetail
          key={selectedVenue.id}
          venue={selectedVenue}
          allVenues={venues}
          saved={saved.has(selectedVenue.id)}
          sent={sent.has(selectedVenue.id)}
          isBooked={booked === selectedVenue.id}
          onBack={() => setSelectedId(null)}
          onSave={() => onToggleSave(selectedVenue.id)}
          onContact={() => { onOutreach(selectedVenue.id); setSelectedId(null); }}
          onBook={() => onBook(selectedVenue.id)}
          onSelectOther={(id) => setSelectedId(id)}
          onRefresh={onRefresh}
        />
      </AnimatePresence>
    );
  }

  // Nothing found yet — point to discovery.
  if (venues.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#24413a]">
          <MapPin size={22} className="text-white" />
        </div>
        <h2 className="display mt-5 text-[1.8rem] text-ink">{t('Ingen venues på listen endnu')}</h2>
        <p className="mt-2 max-w-sm text-[0.9rem] text-ink-soft">
          {venueCity
            ? t('Udforsk verdenskortet eller fortæl Ava mere om jeres drøm nær {area}, så researcher hun rigtige venues.', { area: venueCity })
            : t('Udforsk verdenskortet eller fortæl Ava mere om jeres drøm, så researcher hun rigtige venues.')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Pill arrow onClick={onDiscover}><GlobeIcon size={14} /> {t('Udforsk venues')}</Pill>
          <Pill arrow onClick={onAva}><MessageCircle size={14} /> {t('Tal med Ava')}</Pill>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="pb-24">

      {/* ── Back button ──────────────────────────────────────────────── */}
      {onBack && (
      <div className={cn(padX, 'pt-8')}>
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
          <ArrowLeft size={13} /> {t('Venues')}
        </button>
      </div>
      )}

      {/* ── List tools ──────────────────────────────────────────────── */}
      {savedVenues.length >= 2 && (
        <div className={cn(padX, 'pt-8 flex justify-end')}>
          <button onClick={() => setComparing(true)}
            className="rounded-full bg-ink px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-canvas hover:opacity-85 transition-opacity cursor-pointer">
            {t('Sammenlign ({n})', { n: savedVenues.length })}
          </button>
        </div>
      )}

      {/* ── Category filter (hub shortlist) ──────────────────────────── */}
      {categoryBar && <div className={cn(padX, 'pt-6')}>{categoryBar}</div>}

      {/* ── Outreach progress → review page ──────────────────────────── */}
      {savedVenues.length > 0 && (
        <div className={cn(padX, 'pt-8')}>
          <OutreachBanner
            notContacted={savedVenues.filter((v) => !sent.has(v.id)).length}
            contacted={savedVenues.filter((v) => sent.has(v.id)).length}
            onReview={onReview}
          />
        </div>
      )}

      {/* ── Venue grid ───────────────────────────────────────────────── */}
      <div className={cn(padX, 'pt-8')}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sortedVenues.map((venue, i) => (
            <VenueGridCard key={venue.id} venue={venue} index={i}
              saved={saved.has(venue.id)} sent={sent.has(venue.id)} isBooked={booked === venue.id}
              stage={stageOf(venue.id)}
              onToggleSave={() => onToggleSave(venue.id)}
              onChoose={() => onBook(venue.id)}
              onContact={() => onOutreach(venue.id)}
              onSelect={() => setSelectedId(venue.id)} />
          ))}

          {/* Discover-more card */}
          <button
            type="button"
            onClick={onDiscover}
            className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--color-line-strong)] p-6 text-center transition-colors hover:border-ink/40 hover:bg-card cursor-pointer"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#24413a]">
              <GlobeIcon size={18} className="text-white" />
            </div>
            <div>
              <p className="font-serif text-[1.15rem] text-ink">{t('Udforsk flere venues')}</p>
              <p className="mt-1 text-[0.8rem] text-muted">
                {t('Vælg land og by på kloden, Ava researcher rigtige venues.')}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Ask Ava ──────────────────────────────────────────────────── */}
      <div className={cn(padX, 'pt-12')}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rule rounded-2xl bg-card p-8 text-center">
          <Eyebrow className="text-center">{t('Spørg Ava')}</Eyebrow>
          <p className="mt-3 text-[0.95rem] text-ink-soft max-w-md mx-auto">
            {t('Ava kender jeres profil og kan sammenligne venues, tjekke datoer og skrive henvendelser for jer.')}
          </p>
          <div className="mt-6 flex justify-center">
            <Pill arrow onClick={onAva}><MessageCircle size={14} /> {t('Tal med Ava')}</Pill>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Outreach banner — progress + entry to the review page ────────────── */
function OutreachBanner({
  notContacted, contacted, onReview,
}: {
  notContacted: number; contacted: number; onReview: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#24413a] px-6 py-5 text-canvas">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12">
          <Send size={17} />
        </div>
        <div>
          <p className="font-serif text-[1.1rem] leading-snug">
            {notContacted > 0
              ? t('{n} på listen mangler kontakt', { n: notContacted })
              : t('Ava har kontaktet hele listen')}
          </p>
          <p className="mt-0.5 text-[0.78rem] text-canvas/70">
            {contacted > 0 ? t('{n} kontaktet · ', { n: contacted }) : ''}
            {notContacted > 0 ? t('Se hvad Ava vil sende, og godkend.') : t('Følg svarene under Henvendelser.')}
          </p>
        </div>
      </div>
      {notContacted > 0 && (
        <button
          onClick={onReview}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#24413a] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f8f9f8] hover:opacity-90 transition-opacity cursor-pointer"
        >
          {t('Lad Ava kontakte ({n})', { n: notContacted })} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

/* ── Venue management grid card ───────────────────────────────────────── */
function VenueGridCard({
  venue, index, saved, sent, isBooked, stage, onToggleSave, onChoose, onContact, onSelect,
}: {
  venue: DisplayVenue; index: number; saved: boolean; sent: boolean; isBooked: boolean;
  stage: VenueStage;
  onToggleSave: () => void; onChoose: () => void; onContact: () => void; onSelect: () => void;
}) {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-[#dcdfdb] bg-[#ffffff]">

      <button type="button" onClick={onSelect} className="relative block aspect-[4/3] overflow-hidden cursor-pointer text-left">
        <img src={imgSrc(venue.image)} alt={venue.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a221570] to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <RatingBadge rating={venue.rating} count={venue.reviewCount} />
          {isBooked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-canvas">
              <Check size={10} /> {t('Valgt')}
            </span>
          )}
        </div>
        {!isBooked && stage !== 'idle' && (
          <div className="absolute bottom-3 left-3">
            <StageChip stage={stage} className="shadow-sm" />
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-[1.15rem] leading-tight text-[#24413a]">{venue.name}</h3>
            {venue.location && <p className="mt-0.5 truncate text-[0.72rem] text-[#5f6b66]">{venue.location}</p>}
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onToggleSave} aria-label={saved ? t('Fjern fra listen') : t('Tilføj til liste')}
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e6e9e5] transition-all cursor-pointer',
              saved ? 'bg-[#e8f0ec] text-[#24413a]' : 'text-[#5f6b66] hover:text-[#24413a] hover:bg-[#f8f9f8]')}>
            {saved ? <Check size={14} /> : <Plus size={14} />}
          </motion.button>
        </div>

        {venue.quote && (
          <p className="mt-2 line-clamp-2 text-[0.78rem] leading-snug text-[#5f6b66]">{venue.quote}</p>
        )}

        <div className="mt-auto flex items-end gap-5 pt-4">
          <div>
            <p className="eyebrow !text-[#7d938a]">{t('Pris')}</p>
            <p className="mt-0.5 font-serif text-[0.95rem] leading-none text-[#24413a]">{venue.price}</p>
          </div>
          <div>
            <p className="eyebrow !text-[#7d938a]">{t('Kapacitet')}</p>
            <p className="mt-0.5 font-serif text-[0.95rem] leading-none text-[#24413a]">{venue.capacity}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={onSelect}
            className="flex h-8 flex-1 items-center justify-center rounded-full border border-[#e6e9e5] px-3 text-xs font-semibold text-[#24413a] hover:bg-[#f8f9f8] transition-colors cursor-pointer">
            {t('Se venue')}
          </button>
          {isBooked ? (
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-[#e8f0ec] px-3 text-xs font-semibold text-[#24413a]">
              <Check size={12} /> {t('Jeres venue')}
            </span>
          ) : (
            <button onClick={onChoose}
              className="flex h-8 items-center gap-1.5 rounded-full bg-[#24413a] px-3 text-xs font-semibold text-[#f8f9f8] hover:opacity-85 transition-opacity cursor-pointer">
              <Check size={12} /> {t('Vælg')}
            </button>
          )}
        </div>

        {sent ? (
          !isBooked && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-muted">
              <Check size={10} className="text-sage" /> {t('Ava har kontaktet venuet')}
            </p>
          )
        ) : (
          <button onClick={onContact}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-[#e6e9e5] bg-[#ffffff] px-3 text-xs font-semibold text-[#24413a] hover:bg-[#f8f9f8] transition-colors cursor-pointer">
            <Send size={12} /> {t('Kontakt via Ava')}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   VENUE COMPARISON VIEW
═══════════════════════════════════════════════════════════════════════ */
type ComparisonField = { label: string; value: string; wide?: boolean };

function buildComparisonFields(v: DisplayVenue): ComparisonField[] {
  const fields: ComparisonField[] = [
    { label: 'Pris', value: v.price || '-' },
    { label: 'Kapacitet', value: v.capacity || '-' },
    { label: 'Beliggenhed', value: v.location || '-' },
    {
      label: 'Vurdering',
      value: v.rating != null
        ? `${v.rating.toFixed(1)}${v.reviewCount ? ` · ${v.reviewCount} anm.` : ''}`
        : '-',
    },
  ];

  for (const item of v.research?.practical?.slice(0, 4) ?? []) {
    fields.push({ label: item.key, value: item.value });
  }

  const notes = v.description?.trim()
    || v.quote?.trim()
    || v.why.slice(0, 2).join(' · ')
    || '-';

  fields.push({ label: 'Noter', value: notes, wide: true });

  if (v.research?.highlights?.length) {
    fields.push({
      label: 'Højdepunkter',
      value: v.research.highlights.slice(0, 3).join(' · '),
      wide: true,
    });
  }

  return fields;
}

function ComparisonView({
  venues, saved, booked, onBack, onToggleSave, onBook,
}: {
  venues: DisplayVenue[]; saved: Set<string>; booked: string | null;
  onBack: () => void; onToggleSave: (id: string) => void; onBook: (id: string) => void;
}) {
  const { t } = useLang();
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <div className="px-6 pt-8 sm:px-9 lg:px-12">
        <button onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
          <ArrowLeft size={13} /> {t('Tilbage')}
        </button>
        <Eyebrow>{t('Sammenligning · {n} venues', { n: venues.length })}</Eyebrow>
        <h2 className="display mt-3 text-[clamp(2rem,4vw,3rem)] text-ink">
          {t('Side om')} <span className="italic">{t('side')}</span>
        </h2>
        <p className="mt-2 max-w-xl text-[0.9rem] text-ink-soft">
          {t('Sammenlign det der betyder noget, pris, kapacitet, noter og mere.')}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6 px-6 pb-16 sm:px-9 lg:px-12">
        {venues.map((v, i) => {
          const isBooked = booked === v.id;
          const isSaved = saved.has(v.id);
          const fields = buildComparisonFields(v);

          return (
            <motion.article
              key={v.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="rule overflow-hidden rounded-[22px] bg-card"
            >
              <div className="flex flex-col lg:flex-row">
                {/* Left, photo */}
                <div className="relative w-full shrink-0 lg:w-[300px] xl:w-[340px]">
                  <div className="aspect-[4/3] lg:min-h-full lg:aspect-auto lg:h-full">
                    <img
                      src={imgSrc(v.image)}
                      alt={v.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a221560] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-transparent" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <RatingBadge rating={v.rating} count={v.reviewCount} />
                    {isBooked && (
                      <span className="rounded-full bg-ink px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-canvas">
                        {t('Booket')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right, attribute grid */}
                <div className="flex min-w-0 flex-1 flex-col gap-5 p-6 lg:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-[1.45rem] leading-tight text-ink">{v.name}</h3>
                      {v.location && (
                        <p className="mt-1 text-[0.8rem] text-muted">{v.location}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSave(v.id)}
                        aria-label={isSaved ? t('Fjern fra listen') : t('Gem venue')}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full rule transition-all cursor-pointer',
                          isSaved ? 'bg-ink text-canvas' : 'hover:bg-shell',
                        )}
                      >
                        <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBook(v.id)}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer"
                      >
                        {isBooked ? <><Check size={12} /> {t('Booket')}</> : t('Vælg venue')}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div
                        key={`${v.id}-${field.label}`}
                        className={cn(
                          'rounded-[14px] border border-[var(--color-line)] bg-[#ffffff] px-4 py-3.5',
                          field.wide && 'sm:col-span-2',
                        )}
                      >
                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted">
                          {t(field.label)}
                        </p>
                        <p className={cn(
                          'mt-1.5 text-[0.88rem] leading-relaxed text-ink',
                          field.wide ? 'whitespace-pre-wrap' : 'font-medium',
                        )}>
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {v.why.length > 0 && !v.research?.highlights?.length && (
                    <ul className="space-y-2 border-t border-[var(--color-line)] pt-4">
                      {v.why.slice(0, 3).map((r) => (
                        <li key={r} className="flex items-start gap-2 text-[0.8rem] leading-snug text-ink-soft">
                          <Check size={11} className="mt-0.5 shrink-0 text-sage" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OUTREACH REVIEW, "here's what Ava will do & who she'll contact" → approve
═══════════════════════════════════════════════════════════════════════ */
function OutreachReview({
  recipients, onBack, onApproved, onAva,
}: {
  recipients: DisplayVenue[];
  onBack: () => void; onApproved: () => void; onAva: () => void;
}) {
  const { t } = useLang();
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPreparing(true);
      setPrepError(null);
      try {
        const res = await fetch('/api/venues/outreach/prepare', { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { draft?: EmailDraftRow; error?: string; message?: string };
        if (!alive) return;
        if (!res.ok || !data.draft) {
          setPrepError(data.message ?? t('Kunne ikke forberede henvendelsen lige nu.'));
        } else {
          setDraft(data.draft);
        }
      } catch {
        if (alive) setPrepError(t('Kunne ikke forberede henvendelsen lige nu.'));
      } finally {
        if (alive) setPreparing(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const approve = async () => {
    if (!draft) return;
    setApproving(true);
    setApproveMsg(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, { method: 'POST' });
      if (res.status === 503) {
        setApproveMsg(t('Forbind Kalas-postkassen (Gmail) i indstillinger for at sende henvendelserne.'));
      } else if (!res.ok) {
        setApproveMsg(t('Kunne ikke sende lige nu, prøv igen.'));
      } else {
        onApproved();
      }
    } catch {
      setApproveMsg(t('Kunne ikke sende lige nu, prøv igen.'));
    } finally {
      setApproving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl px-6 py-8 sm:px-9 lg:px-12"
    >
      <button type="button" onClick={onBack}
        className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
        <ArrowLeft size={13} /> {t('Tilbage til listen')}
      </button>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Trin 3 · Godkend')}</p>
      <h1 className="mt-1 font-serif text-[clamp(1.9rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-[#24413a]">
        {t(recipients.length === 1 ? 'Ava kontakter {n} venue' : 'Ava kontakter {n} venues', { n: recipients.length })}
      </h1>
      <p className="mt-2 text-[13px] text-[#5f6b66]">
        {t('Ava sender en personlig mail til hvert sted fra jeres Kalas-postkasse og samler alle svar under Henvendelser. I godkender her, intet sendes uden.')}
      </p>

      {/* Recipients */}
      <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-card p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Modtagere')}</p>
        {recipients.length === 0 ? (
          <p className="mt-3 text-[0.88rem] text-ink-soft">{t('Alle på listen er allerede kontaktet.')}</p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-[var(--color-line)]">
            {recipients.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2.5">
                <img src={imgSrc(v.image)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-bold text-ink">{v.name}</p>
                  {v.location && <p className="truncate text-[0.72rem] text-muted">{v.location}</p>}
                </div>
                <Send size={14} className="shrink-0 text-muted" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Draft preview */}
      <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Avas udkast')}</p>
          <button onClick={onAva} className="text-[0.72rem] font-semibold text-[#7d938a] hover:underline cursor-pointer">{t('Rediger med Ava')}</button>
        </div>
        {preparing ? (
          <div className="flex items-center gap-2.5 py-6 text-ink-soft">
            <Loader2 size={16} className="animate-spin" /> {t('Ava skriver udkastet…')}
          </div>
        ) : prepError ? (
          <p className="mt-3 rounded-xl bg-shell px-4 py-3 text-[0.85rem] text-ink-soft">{prepError}</p>
        ) : draft ? (
          <>
            <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Emne')}</p>
            <p className="mt-1 text-[0.95rem] font-semibold text-ink">{draft.subject}</p>
            <p className="mt-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Besked')}</p>
            <p className="mt-1 whitespace-pre-wrap text-[0.88rem] leading-relaxed text-ink-soft">{draft.body_template}</p>
            <p className="mt-3 text-[0.72rem] text-muted">{t('Ava tilpasser hver mail til det enkelte venue før afsendelse.')}</p>
          </>
        ) : null}
      </div>

      {approveMsg && (
        <p className="mt-4 rounded-xl bg-[var(--color-terracotta-tint)] px-4 py-3 text-[0.85rem] text-[var(--color-terracotta)]">{approveMsg}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void approve()}
          disabled={approving || preparing || !draft || recipients.length === 0}
          className="flex items-center gap-2 rounded-full bg-[#24413a] px-7 py-3.5 text-[0.85rem] font-bold text-canvas transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
        >
          {approving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {t('Godkend & lad Ava sende')}
        </button>
        <button onClick={onBack}
          className="rounded-full rule bg-canvas px-5 py-3.5 text-[0.85rem] font-medium text-ink hover:bg-card transition-colors cursor-pointer">
          {t('Annuller')}
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   VENUE DETAIL PAGE, real data only; Ava research fills the gaps
═══════════════════════════════════════════════════════════════════════ */
function VenueDetail({
  venue, allVenues, saved, sent, isBooked, onBack, onSave, onContact, onBook, onSelectOther, onRefresh,
}: {
  venue: DisplayVenue; allVenues: DisplayVenue[]; saved: boolean; sent: boolean; isBooked: boolean;
  onBack: () => void; onSave: () => void; onContact: () => void; onBook: () => void;
  onSelectOther: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useLang();
  const [notes, setNotes]         = useState('');
  const [activePackage, setPkg]   = useState<number | null>(null);
  // Start in the researching state when a shortlisted venue has nothing on file
  // yet — opening it kicks off research (below), so the couple never sees an
  // empty page. Non-shortlisted venues wait for a manual press.
  const [researching, setResearching] = useState(!venue.research && saved);
  const [researchError, setResearchError] = useState<string | null>(null);
  const realPhotos = venue.photos ?? [];
  const research = venue.research;
  const description = venue.description ?? venue.quote;
  const highlights = research?.highlights.length ? research.highlights : venue.why;
  const practical  = research?.practical ?? [];
  const packages   = research?.packages ?? [];
  const directions = research?.directions ?? null;

  async function runResearch() {
    setResearching(true);
    setResearchError(null);
    try {
      const res = await fetch(`/api/venues/${venue.id}/research`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Research failed');
      }
      await onRefresh();
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : t('Kunne ikke researche venue'));
    } finally {
      setResearching(false);
    }
  }

  // First time a shortlisted venue is opened, kick off research automatically so
  // the couple lands on filled-in info instead of an empty page. Only runs for
  // venues on their list and only when nothing has been researched yet; the
  // button remains for a manual refresh. The ref guards against re-firing on
  // re-render (the view is keyed by venue.id, so a different venue remounts and
  // gets its own auto-run).
  const autoResearchedRef = useRef(false);
  useEffect(() => {
    if (autoResearchedRef.current || venue.research || !saved) return;
    autoResearchedRef.current = true;
    void runResearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full bg-[#f4f5f3] pb-24">

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e2e6e2] bg-[#f4f5f3]/95 px-6 py-3 backdrop-blur-md sm:px-9 lg:px-12">
        <button type="button" onClick={onBack}
          className="flex h-8 cursor-pointer items-center gap-1.5 text-sm text-[#5f6b66] transition-colors hover:text-[#24413a]">
          <ArrowLeft size={15} /> {t('Tilbage')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runResearch()}
            disabled={researching}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all',
              researching
                ? 'border border-[#e6e9e5] bg-[#f8f9f8] text-[#9a9686]'
                : 'border border-[#e6e9e5] bg-[#ffffff] text-[#24413a] hover:bg-[#f8f9f8]',
            )}>
            {researching ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
            {researching ? t('Ava researcher…') : research ? t('Opdater research') : t('Research venue')}
          </button>
          <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={onSave}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all',
              saved
                ? 'bg-[#e8f0ec] text-[#24413a]'
                : 'border border-[#e6e9e5] bg-[#ffffff] text-[#24413a] hover:bg-[#f8f9f8]',
            )}>
            <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
            {saved ? t('Gemt') : t('Gem')}
          </motion.button>
        </div>
      </div>

      {/* ── Photos ────────────────────────────────────────────────── */}
      {realPhotos.length > 1 ? (
        <div className="grid h-[300px] gap-1 sm:h-[460px] sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-2">
          <div className="relative overflow-hidden sm:row-span-2">
            <img src={imgSrc(venue.image)} alt={venue.name}
              className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-[#dcdfdb] bg-[#ffffff]/95 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-[0.68rem] font-medium text-[#24413a]">{t('{n} billeder', { n: realPhotos.length })}</span>
            </div>
          </div>
          {realPhotos.slice(1, 5).map((url, i) => (
            <div key={i} className="relative hidden overflow-hidden sm:block">
              <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-[300px] overflow-hidden sm:h-[420px]">
          <img src={imgSrc(venue.image)} alt={venue.name}
            className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
      )}

      {/* ── Main info ─────────────────────────────────────────────── */}
      <div className="px-6 pt-8 sm:px-9 lg:px-12">

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#e8f0ec] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#24413a]">
            {t('Ava pick')}
          </span>
          {venue.rating != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e9e5] bg-[#f8f9f8] px-3 py-1 text-[0.72rem] font-medium text-[#24413a]">
              <Star size={12} fill="currentColor" className="text-[#8a7d5c]" />
              {venue.rating.toFixed(1)}
              {venue.reviewCount > 0 && <span className="text-[#5f6b66]">· {t('{n} anmeldelser', { n: venue.reviewCount })}</span>}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05] text-[#24413a]">
          {venue.name}
        </h1>
        <p className="mt-1 text-sm text-[#5f6b66]">{venue.location}</p>
        {directions && (
          <p className="mt-1 text-[0.8rem] text-[#7d938a]">{directions}</p>
        )}

        {researchError && (
          <p className="mt-4 rounded-[14px] border border-[#e8d5c8] bg-[#faf4ef] px-4 py-3 text-sm text-[#7b4032]">{researchError}</p>
        )}

        {research?.briefing?.length ? (
          <div className="mt-6 rounded-[18px] bg-[#24413a] p-6 text-[#f8f9f8]">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#a6b0aa]">{t('Avas briefing')}</p>
            <ul className="mt-4 space-y-2.5">
              {research.briefing.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[0.92rem] leading-snug">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#dbe5e0]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : researching ? (
          <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-[#e6e9e5] bg-[#ffffff] px-5 py-4">
            <Loader2 size={16} className="shrink-0 animate-spin text-[#24413a]" />
            <p className="text-sm leading-relaxed text-[#5f6b66]">
              {t('Ava researcher venueet, søger på nettet og udfylder kapacitet, priser og praktisk info fra stedets egne sider…')}
            </p>
          </div>
        ) : !research ? (
          <div className="mt-6 rounded-[18px] border border-dashed border-[#dcdfdb] bg-[#ffffff] px-5 py-4">
            <p className="text-sm leading-relaxed text-[#5f6b66]">
              {t('Ava kunne ikke hente info automatisk. Tryk')}{' '}
              <span className="font-medium text-[#24413a]">{t('Research venue')}</span>{' '}
              {t('for at prøve igen.')}
            </p>
          </div>
        ) : null}

        {description && (
          <p className="mt-7 max-w-2xl text-[1.02rem] leading-relaxed text-[#46574f]">{description}</p>
        )}

        {/* Stats strip */}
        <div className="mt-8 grid grid-cols-3 items-stretch gap-px overflow-hidden rounded-[18px] border border-[#dcdfdb] bg-[#dcdfdb]">
          <div className="flex min-h-[5.5rem] flex-col bg-[#ffffff] px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#5f6b66]">{t('Kapacitet')}</p>
            <p className="mt-2 text-[0.9rem] font-semibold leading-snug text-[#24413a]">{venue.capacity || '-'}</p>
          </div>
          <div className="flex min-h-[5.5rem] flex-col bg-[#e8f0ec] px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#5f6b66]">{t('Pris fra')}</p>
            <p className="mt-2 text-[0.9rem] font-semibold leading-snug text-[#24413a]">{venue.price || '-'}</p>
          </div>
          <div className="flex min-h-[5.5rem] flex-col bg-[#24413a] px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#c5ccc4]">{t('Bedømmelse')}</p>
            <p className="mt-2 font-serif text-[1.35rem] leading-none text-[#f8f9f8]">
              {venue.rating != null ? `★ ${venue.rating.toFixed(1)}` : '-'}
            </p>
          </div>
        </div>

        {practical.length > 0 && (
          <div className="mt-10 border-t border-[#e2e6e2] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Praktisk info')}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              {practical.map(({ key, value }) => (
                <div key={key}>
                  <dt className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#5f6b66]">{key}</dt>
                  <dd className="mt-1.5 text-[0.92rem] leading-snug text-[#24413a]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {highlights.length > 0 && (
          <div className="mt-10 border-t border-[#e2e6e2] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Faciliteter & fordele')}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-start gap-3">
                  <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[#5f7d70]" />
                  <span className="text-[0.92rem] leading-snug text-[#46574f]">{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {packages.length > 0 && (
          <div className="mt-10 border-t border-[#e2e6e2] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Priser & pakker')}</p>
            <p className="mt-1.5 text-[0.8rem] text-[#5f6b66]">{t('Fra venueets egne sider, bekræft altid pris og dato direkte.')}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {packages.map((pkg, i) => {
                const active = activePackage === i;
                return (
                  <button key={pkg.name} type="button" onClick={() => setPkg(active ? null : i)}
                    className={cn(
                      'group flex flex-col rounded-[18px] p-5 text-left transition-all cursor-pointer',
                      pkg.featured
                        ? 'bg-[#24413a] text-[#f8f9f8]'
                        : active
                          ? 'border-2 border-[#24413a] bg-[#ffffff]'
                          : 'border border-[#dcdfdb] bg-[#ffffff] hover:bg-[#f8f9f8]',
                    )}>
                    {pkg.featured && (
                      <span className="mb-2 text-[0.58rem] font-bold uppercase tracking-[0.22em] text-[#dbe5e0]">{t('Mest valgt')}</span>
                    )}
                    <span className={cn('font-serif text-[1.15rem]', pkg.featured ? 'text-[#f8f9f8]' : 'text-[#24413a]')}>
                      {pkg.name}
                    </span>
                    <span className={cn('mt-1 text-[0.76rem] leading-relaxed', pkg.featured ? 'text-[#a6b0aa]' : 'text-[#5f6b66]')}>
                      {pkg.desc}
                    </span>
                    <span className={cn('mt-4 font-serif text-[1.5rem] leading-none', pkg.featured ? 'text-[#f8f9f8]' : 'text-[#24413a]')}>
                      {pkg.price}
                    </span>
                    {active && !pkg.featured && (
                      <span className="mt-3 flex items-center gap-1 text-[0.72rem] text-[#5f7d70]">
                        <Check size={12} /> {t('Valgt')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(venue.quote || venue.why.length > 0) && (
          <div className="mt-10 border-t border-[#e2e6e2] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Derfor matcher det jer')}</p>
            <div className="mt-5 rounded-[18px] border border-[#dcdfdb] bg-[#ffffff] p-6">
              {venue.quote && (
                <blockquote className="font-serif text-[1.2rem] italic leading-relaxed text-[#24413a]">
                  &ldquo;{venue.quote}&rdquo;
                </blockquote>
              )}
              {venue.why.length > 0 && (
                <ul className={cn('space-y-3', venue.quote && 'mt-5 border-t border-[#e6e9e5] pt-5')}>
                  {venue.why.map((reason) => (
                    <li key={reason} className="flex items-start gap-3">
                      <Check size={13} className="mt-1 shrink-0 text-[#5f7d70]" />
                      <span className="text-[0.9rem] leading-relaxed text-[#46574f]">{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {allVenues.length > 1 && (
          <div className="mt-10 border-t border-[#e2e6e2] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Flere fra jeres liste')}</p>
            <div className="mt-5 flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {allVenues.filter((v) => v.id !== venue.id).slice(0, 4).map((v) => (
                <button key={v.id} type="button" onClick={() => onSelectOther(v.id)}
                  className="relative shrink-0 overflow-hidden rounded-[14px] text-left cursor-pointer"
                  style={{ width: 'min(180px, 45vw)', aspectRatio: '3/4' }}>
                  <img src={imgSrc(v.image)} alt={v.name}
                    className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#24413a]/90 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-serif text-[0.95rem] leading-tight text-[#f8f9f8]">{v.name}</p>
                    {v.rating != null && (
                      <p className="mt-0.5 text-[0.65rem] text-[#dbe5e0]">★ {v.rating.toFixed(1)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-[#e2e6e2] pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24413a]">{t('Jeres noter')}</p>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Skriv noter om dette venue, spørgsmål, mavefornemmelser, hvad I vil spørge om til visning…')}
            rows={4}
            className="mt-3 w-full resize-none rounded-[18px] border border-[#dcdfdb] bg-[#ffffff] px-5 py-4 text-[0.9rem] leading-relaxed text-[#24413a] placeholder:text-[#9a9686] focus:outline-none"
          />
        </div>

        <div className="mt-8 border-t border-[#e2e6e2] pt-8">
          <p className="mb-4 text-[0.8rem] text-[#5f6b66]">
            {t('Ava forbereder en personlig henvendelse og sender den på jeres vegne.')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {isBooked ? (
              <div className="flex h-8 items-center gap-1.5 rounded-full bg-[#e8f0ec] px-3 text-xs font-semibold text-[#24413a]">
                <Check size={13} /> {t('Jeres venue')}
              </div>
            ) : (
              <>
                <button type="button" onClick={onBook}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[#24413a] px-3 text-xs font-semibold text-[#f8f9f8] hover:opacity-85 transition-opacity">
                  <Check size={13} /> {t('Vælg som jeres venue')}
                </button>
                <button type="button" onClick={onContact} disabled={sent}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#e6e9e5] bg-[#ffffff] px-3 text-xs font-semibold text-[#24413a] hover:bg-[#f8f9f8] transition-colors disabled:cursor-default disabled:opacity-60 disabled:hover:bg-[#ffffff]">
                  {sent ? <><Check size={13} /> {t('Ava har kontaktet stedet')}</> : <><Send size={12} /> {t('Kontakt via Ava')}</>}
                </button>
              </>
            )}
            <button type="button" onClick={onSave}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
                saved
                  ? 'bg-[#e8f0ec] text-[#24413a]'
                  : 'border border-[#e6e9e5] bg-[#ffffff] text-[#24413a] hover:bg-[#f8f9f8]',
              )}>
              <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
              {saved ? t('Gemt') : t('Gem venue')}
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
