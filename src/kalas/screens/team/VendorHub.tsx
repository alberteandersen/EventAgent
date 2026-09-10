"use client";

import { useCallback, useMemo, useState } from 'react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import type { NavigateTarget } from '../../lib/hub-nav';
import type { VenueHubView } from '../Venues';
import HubTabBar from './HubTabBar';
import CategoryFilterBar from './CategoryFilterBar';
import ExplorePanel from './ExplorePanel';
import ShortlistPanel from './ShortlistPanel';
import BookedPanel from './BookedPanel';
import LocationChip from './LocationChip';
import { cn } from '../../ui';
import { effectiveLocation } from '../../lib/location';
import {
  hubBadges,
  readHubDeepLink,
  resolveDefaultTab,
  type HubCat,
  type HubTab,
} from './shared';

export default function VendorHub({ onNavigate }: { onNavigate?: (s: NavigateTarget) => void }) {
  const { venues, outbound, replies, event, loading } = useWedding();
  const { t } = useLang();

  const deepLink = useMemo(() => readHubDeepLink(), []);

  const [tab, setTab] = useState<HubTab>(() => {
    if (deepLink.tab) return deepLink.tab;
    return resolveDefaultTab(venues, outbound, replies, event?.chosen_venue_id);
  });
  const [cat, setCat] = useState<HubCat>(deepLink.cat ?? 'venue');
  const [venueView, setVenueView] = useState<VenueHubView>(
    deepLink.tab === 'shortlist' ? 'list' : 'discover',
  );
  const badges = useMemo(
    () => hubBadges(venues, outbound, replies, event?.chosen_venue_id),
    [venues, outbound, replies, event?.chosen_venue_id],
  );

  // Non-venue categories unlock once the couple has a location — from the venue
  // they chose, or the one they set by hand on the venue page. Vendors are all
  // local to that spot, so the location is what gates finding them.
  const vendorsLocked = useMemo(
    () => !effectiveLocation(event, venues),
    [event, venues],
  );

  const onSwitchTab = useCallback((next: HubTab, nextCat?: HubCat) => {
    setTab(next);
    if (nextCat) setCat(nextCat);
    if (next === 'explore') setVenueView('discover');
    if (next === 'shortlist') setVenueView('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onTabChange = useCallback((next: HubTab) => {
    onSwitchTab(next, cat);
  }, [cat, onSwitchTab]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 sm:px-9 lg:px-12">
      {/* Header, same pattern as Honeymoon: title first, tabs underneath. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Planlægning')}</p>
          <h1 className="mt-1 font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-[#24413a]">
            {t('Venue & leverandører')}
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-[#5f6b66]">
            {t('Find jeres venue og leverandører, gem favoritter, og hold styr på hvem I har booket.')}
          </p>
        </div>
        <LocationChip className="shrink-0" />
      </div>

      <HubTabBar tab={tab} badges={badges} onChange={onTabChange} />

      {/* Category chips live on the page chrome (under tabs), not under panel titles. */}
      {tab !== 'booked' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <CategoryFilterBar cat={cat} onCatChange={setCat} vendorsLocked={vendorsLocked} />
          </div>

        </div>
      )}

      <div>
        {tab === 'explore' && (
          <ExplorePanel
            cat={cat}
            venueView={venueView}
            onVenueViewChange={setVenueView}
            onNavigate={onNavigate}
            onSwitchTab={onSwitchTab}
          />
        )}
        {tab === 'shortlist' && (
          <ShortlistPanel
            cat={cat}
            venueView={venueView}
            onVenueViewChange={setVenueView}
            onNavigate={onNavigate}
            onSwitchTab={onSwitchTab}
            vendorsLocked={vendorsLocked}
          />
        )}
        {tab === 'booked' && <BookedPanel onSwitchTab={onSwitchTab} />}
      </div>
    </div>
  );
}
