"use client";

import { Star, Send, Mail, Clock } from 'lucide-react';
import { IMAGES } from '../../images';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VenueRow } from '@/lib/db/types';
import type { VenueResearchProfile } from '@/lib/venue/research';

/* Real venue row → the display shape the discovery views render. */
export interface DisplayVenue {
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

export function toDisplay(v: VenueRow): DisplayVenue {
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
export const imgSrc = (src: string) =>
  src.startsWith('http') ? src : IMAGES[src as keyof typeof IMAGES] ?? IMAGES.orangeri;

export function venueAreaLabel(region: string): string {
  return region.trim().replace(/\bnær\s+/gi, '').trim();
}

/* Outreach progress a couple can see on their list. */
export type VenueStage = 'idle' | 'contacted' | 'replied' | 'quoted';
const STAGE_META: Record<VenueStage, { label: string; cls: string; Icon: typeof Mail }> = {
  idle:      { label: 'Ikke kontaktet', cls: 'bg-shell text-muted',                 Icon: Clock },
  contacted: { label: 'Kontaktet',      cls: 'bg-[#e9edf2] text-[#3f5b6b]',          Icon: Send },
  replied:   { label: 'Svar modtaget',  cls: 'bg-[#e5ead8] text-ink-soft',          Icon: Mail },
  quoted:    { label: 'Tilbud',         cls: 'bg-[#f3d8cf] text-[#7b4032]',          Icon: Mail },
};

export function StageChip({ stage, className }: { stage: VenueStage; className?: string }) {
  const { t } = useLang();
  const { label, cls, Icon } = STAGE_META[stage];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em]', cls, className)}>
      <Icon size={11} /> {t(label)}
    </span>
  );
}

export function RatingBadge({ rating, count, className }: { rating: number | null; count?: number; className?: string }) {
  if (rating == null) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm', className)}>
      <Star size={11} fill="currentColor" className="text-amber" />
      {rating.toFixed(1)}
      {count ? <span className="font-normal text-muted">({count})</span> : null}
    </span>
  );
}
