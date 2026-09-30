"use client";

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Heart, MessageCircle, Send, Lock } from 'lucide-react';
import VenueDiscovery, { type VenueHubView } from '../Venues';
import OutreachDialog from '../../OutreachDialog';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { Eyebrow, cn } from '../../ui';
import type { NavigateTarget } from '../../lib/hub-nav';
import type { HubCat, HubTab } from './shared';
import { matchesHubCat } from './shared';
import type { VenueRow } from '@/lib/db/types';

const CAT_LABEL: Record<string, string> = {
  venue: 'Venue',
  photographer: 'Foto',
  florist: 'Blomster',
  caterer: 'Catering',
  musician: 'Musik',
  planner: 'Planlægger',
  other: 'Andet',
};

export default function ShortlistPanel({
  cat,
  venueView,
  onVenueViewChange,
  onNavigate,
  onSwitchTab,
  vendorsLocked = false,
}: {
  cat: HubCat;
  venueView: VenueHubView;
  onVenueViewChange: (view: VenueHubView) => void;
  onNavigate?: (s: NavigateTarget) => void;
  onSwitchTab: (tab: HubTab, cat?: HubCat) => void;
  vendorsLocked?: boolean;
}) {
  const { venues, outbound } = useWedding();
  const { t } = useLang();
  const sentIds = useMemo(() => new Set(outbound.map((o) => o.venue_id)), [outbound]);

  const liked = useMemo(
    () => venues.filter((v) => v.swipe_status === 'liked' && matchesHubCat(v, cat)),
    [venues, cat],
  );

  const likedVenues = liked.filter((v) => v.category === 'venue');
  const likedVendors = liked.filter((v) => v.category !== 'venue');
  const showVenueList = cat === 'venue';
  const showVendorList = cat !== 'venue';

  if (venueView === 'review' && showVenueList) {
    return (
      <VenueDiscovery
        onNavigate={onNavigate}
        hub={{
          view: 'review',
          onViewChange: onVenueViewChange,
          onSwitchTab: onSwitchTab,
          category: cat,
          showHint: false,
        }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {vendorsLocked && showVenueList && likedVenues.length > 0 && (
        <div className="flex items-start gap-3 rounded-[18px] border border-line bg-shell px-5 py-4">
          <Lock size={14} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[0.82rem] text-ink">
            Lås jeres lokation ved at vælge et venue herunder, så åbner vi de øvrige
            leverandører, og Ava kan begynde at finde og kontakte dem.
          </p>
        </div>
      )}

      {showVenueList && likedVenues.length > 0 && (
        <VenueDiscovery
          onNavigate={onNavigate}
          hub={{
            view: 'list',
            onViewChange: onVenueViewChange,
            onSwitchTab: onSwitchTab,
              category: cat,
            showHint: false,
          }}
        />
      )}

      {showVendorList && (
        <VendorShortlist
          items={likedVendors}
          contacted={sentIds}
          locked={vendorsLocked}
          exploreCat={cat}
          onExplore={(c) => onSwitchTab('explore', c)}
        />
      )}

      {liked.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-[1.3rem] italic text-ink-soft">{t('Ingen favoritter endnu')}</p>
          <button
            type="button"
            onClick={() => onSwitchTab('explore', cat)}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper hover:opacity-90 transition-colors cursor-pointer"
          >
            {cat === 'venue' ? t('Udforsk venues') : t('Udforsk leverandører')}
          </button>
        </div>
      ) : null}

      {showVenueList && likedVenues.length === 0 && showVendorList && likedVendors.length > 0 && null}
    </div>
  );
}

function VendorShortlist({
  items,
  contacted,
  locked = false,
  exploreCat,
  onExplore,
}: {
  items: VenueRow[];
  contacted: Set<string>;
  locked?: boolean;
  exploreCat: HubCat;
  onExplore: (cat: HubCat) => void;
}) {
  const { refresh } = useWedding();
  const { t } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [contacting, setContacting] = useState<VenueRow | null>(null);

  const toggle = async (id: string, liked: boolean) => {
    setBusy(id);
    try {
      await fetch(`/api/venues/${id}/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: liked ? 'rejected' : 'liked' }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const book = async (id: string, booked: boolean) => {
    setBusy(id);
    try {
      await fetch(`/api/venues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booked: !booked }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <section>
      <Eyebrow className="!text-sage">{t('Gemte favoritter')} · {items.length}</Eyebrow>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => {
          const isContacted = contacted.has(v.id);
          return (
            <motion.div
              key={v.id}
              layout
              className="flex flex-col rounded-[18px] border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
                    {t(CAT_LABEL[v.category] ?? v.category)}
                  </p>
                  <h3 className="mt-1 font-serif text-[1.05rem] text-ink">{v.name}</h3>
                  {v.price_hint && <p className="mt-1 font-serif text-[0.95rem] text-ink">{v.price_hint}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void toggle(v.id, true)}
                  disabled={busy === v.id}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-wash text-ink cursor-pointer"
                  aria-label={t('Fjern fra favoritter')}
                >
                  <Heart size={14} fill="currentColor" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isContacted ? (
                  <span className="inline-flex h-8 items-center rounded-full bg-shell px-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">
                    {t('Kontaktet')}
                  </span>
                ) : locked ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-shell px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">
                    <Lock size={10} /> {t('Vælg venue først')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setContacting(v)}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper hover:opacity-85 transition-opacity cursor-pointer"
                  >
                    <Send size={12} /> {t('Kontakt')}
                  </button>
                )}
                {v.booked_at ? (
                  <button
                    type="button"
                    onClick={() => void book(v.id, true)}
                    disabled={busy === v.id}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-sage-wash px-3 text-xs font-semibold text-ink cursor-pointer disabled:opacity-50"
                  >
                    <Check size={12} /> {t('Booket')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void book(v.id, false)}
                    disabled={busy === v.id}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-line-soft bg-white px-3 text-xs font-semibold text-ink hover:bg-paper transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check size={12} /> {t('Book')}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onExplore(exploreCat)}
        className={cn(
          'mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[18px] border border-line bg-white px-5',
          'text-sm text-ink hover:bg-paper transition-colors cursor-pointer',
        )}
      >
        <MessageCircle size={16} className="text-muted" />
        {t('Find flere leverandører')}
      </button>

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
    </section>
  );
}
