"use client";

import { Star, Users, Route, Wallet, Heart, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../../ui';
import { useLang } from '../../i18n';
import { capacityOf } from '@/lib/venue/facts';
import type { VenueBadge } from '@/lib/venue/filter';
import type { VenueSuggestion } from '@/lib/venue/search';
import VenueModal, { type VenueFact } from './VenueModal';

/* A venue opened from the search results. `v` is null while nothing is open.
 *
 * Built from the SUGGESTION, never from a saved row. VenueDetail needs a
 * database id — for its research pass and its outreach — so reaching it from
 * discovery meant saving the venue first, and "let me look at this one" is not
 * the same sentence as "put this on our list". Everything below is already in
 * the search result; opening a venue writes nothing. */
export default function VenuePanel({ v, badges, saved, saving, onSave, onClose, onPhoto }: {
  v: VenueSuggestion | null;
  badges: VenueBadge[];
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onPhoto: (index: number) => void;
}) {
  const { t } = useLang();

  const facts: VenueFact[] = [];
  if (v) {
    const seats = capacityOf(v.facts);
    if (v.rating != null) {
      facts.push({
        icon: <Star size={12} fill="currentColor" className="text-amber" />,
        label: t('Bedømmelse'),
        value: `${v.rating.toFixed(1)}${v.review_count ? ` (${v.review_count})` : ''}`,
      });
    }
    if (seats || v.capacity) {
      facts.push({ icon: <Users size={12} />, label: t('Kapacitet'), value: seats ? t('{n} gæster', { n: seats }) : v.capacity! });
    }
    if (v.price_hint) facts.push({ icon: <Wallet size={12} />, label: t('Pris'), value: v.price_hint });
    if (v.distance_km != null) {
      facts.push({ icon: <Route size={12} />, label: t('Afstand'), value: t('{n} km fra jer', { n: v.distance_km }) });
    }
  }

  return (
    <VenueModal
      open={v !== null}
      onClose={onClose}
      name={v?.name ?? ''}
      address={v?.address}
      photos={v ? (v.photos.length ? v.photos : v.photo ? [v.photo] : []) : []}
      onPhoto={onPhoto}
      facts={facts}
      note={v?.why_fit}
      description={v?.description}
      badges={badges}
      footer={v && (
        <>
          {v.website && (
            <Button variant="secondary" href={v.website} target="_blank" rel="noopener noreferrer" icon={ExternalLink}>
              {t('Deres hjemmeside')}
            </Button>
          )}
          {saved ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sage-wash px-4 text-meta font-semibold text-ink">
              <Check size={14} /> {t('På listen')}
            </span>
          ) : (
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />}
              {t('Gem på listen')}
            </Button>
          )}
        </>
      )}
    />
  );
}
