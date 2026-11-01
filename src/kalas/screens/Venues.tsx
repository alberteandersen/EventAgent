"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import OutreachDialog from '../OutreachDialog';
import { useWedding } from '../useWedding';
import { apiWrite, showNotice } from '../notice';
import type { NavigateTarget } from '../lib/hub-nav';
import { useLang } from '../i18n';
import type { HubCat, HubTab } from './team/shared';
import { DiscoverView } from './venues/DiscoverView';
import { OutreachReview } from './venues/OutreachReview';
import { PicksView } from './venues/PicksView';
import { type VenueStage, toDisplay } from './venues/shared';

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT, venue discovery & management
══════════════════════════════════════════════════════════════════════ */

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
  /** The vendor hub owns which view is showing; Venues always renders inside it. */
  hub: VenueHubConfig;
}) {
  const { t } = useLang();
  const { couple, event, venues: allVenues, outbound, replies, refresh } = useWedding();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Real venues for this wedding (never vendors).
  const venues = allVenues.filter((v) => v.category === 'venue');
  const displayVenues = venues.map(toDisplay);

  const hasRealVenues = displayVenues.length > 0;
  const vview = hub.view;
  const setView = hub.onViewChange;

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
    await apiWrite(`/api/venues/${id}/swipe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: next }),
    }, t);
    await refresh();
  };
  // Contacting one venue: Juno composes, the couple approves in the dialog.
  const [contacting, setContacting] = useState<{ id: string; name: string } | null>(null);
  const openOutreach = (id: string) => {
    const name = displayVenues.find((v) => v.id === id)?.name ?? 'venue';
    setContacting({ id, name });
  };
  const bookVenue = async (id: string) => {
    const alreadyChosen = booked === id;
    const res = await apiWrite(`/api/venues/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booked: true }),
    }, t);
    await refresh();
    if (!res) return;
    // Confirm the moment a venue becomes "jeres venue".
    if (!alreadyChosen) {
      const name = displayVenues.find((v) => v.id === id)?.name ?? null;
      showNotice(
        name ? t('{name} er nu jeres venue', { name }) : t('Venue valgt'),
        t('Alt om stedet samles nu på jeres oversigt.'),
      );
    }
  };

  // Open the list, optionally straight into a venue's detail.
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const goList = (id: string | null = null) => { setPendingSelect(id); setView('list'); };

  // "Find flere som disse" seeds discovery with the names already on the list.
  const [similarSeed, setSimilarSeed] = useState(false);
  const likedNames = displayVenues.filter((v) => saved.has(v.id)).map((v) => v.name);
  const goDiscover = (similar = false) => { setSimilarSeed(similar); setView('discover'); };

  const likedNotContacted = displayVenues.filter((v) => saved.has(v.id) && !sent.has(v.id));

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {vview === 'discover' && (
          <DiscoverView
            key="discover"
            couple={couple}
            savedPlaceIds={savedPlaceIds}
            similarNames={similarSeed ? likedNames : null}
            onSaved={refresh}
            /* The heart in the filter row. In the hub it switches to the
               Favoritter tab; standalone it opens the list view. Both routes
               already existed, hub.onSwitchTab had simply never been called. */
            onViewList={
              hub.onSwitchTab
                ? () => hub.onSwitchTab!('shortlist', hub.category ?? 'venue')
                : hasRealVenues ? () => goList() : undefined
            }
            savedCount={saved.size}
            embedded
            categoryBar={hub.categoryBar}
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
            onDiscover={() => goDiscover(false)}
            onReview={() => setView('review')}
            onJuno={() => onNavigate?.('juno')}
            onRefresh={refresh}
            embedded
            categoryBar={hub.categoryBar} />
        )}
        {vview === 'review' && (
          <OutreachReview key="review"
            recipients={likedNotContacted}
            onBack={() => setView('list')}
            onApproved={() => { void refresh(); goInbox(); }}
            onJuno={() => onNavigate?.('juno')}
          />
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
