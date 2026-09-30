"use client";

import { useCallback, useMemo, useState } from 'react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { CalendarCheck, Globe, Heart } from 'lucide-react';
import { Page, PageHeader, PageLoader, Tabs } from '../../ui';
import type { NavigateTarget } from '../../lib/hub-nav';
import type { VenueHubView } from '../Venues';
import CategoryFilterBar from './CategoryFilterBar';
import ExplorePanel from './ExplorePanel';
import ShortlistPanel from './ShortlistPanel';
import BookedPanel from './BookedPanel';
import LocationChip from './LocationChip';
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
    document.getElementById('kalas-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onTabChange = useCallback((next: HubTab) => {
    onSwitchTab(next, cat);
  }, [cat, onSwitchTab]);

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        title={t('Venue & leverandører')}
        subtitle={t('Find jeres venue og leverandører, gem favoritter, og hold styr på hvem I har booket.')}
        guide="team"
        actions={<LocationChip />}
      >
        <Tabs
          label={t('Venue & leverandører')}
          value={tab}
          onChange={onTabChange}
          items={[
            { id: 'explore', label: t('Udforsk'), icon: Globe, badge: badges.explore },
            { id: 'shortlist', label: t('Favoritter'), icon: Heart, badge: badges.shortlist },
            { id: 'booked', label: t('Booket'), icon: CalendarCheck, badge: badges.booked },
          ]}
        />
      </PageHeader>

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
    </Page>
  );
}
