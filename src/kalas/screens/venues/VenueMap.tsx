"use client";

/* The venues on a real map. The globe that used to sit on this page answered
   "which country", which is the right question for onboarding and the wrong
   one here: venues are chosen ten or fifty kilometres apart, at a scale where
   a globe has no coast, no towns and no roads to tell them apart by. */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useLang } from '../../i18n';
import type { MapBounds } from '@/lib/venue/mapArea';
import { loadGoogleMaps, MAP_STYLES, type GMap, type GMarker, type GoogleMaps } from './googleMaps';

export interface MapVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  saved: boolean;
}

const INK = '#24413a';
const TERRACOTTA = '#b34e37';
/** SymbolPath.CIRCLE. Spelled as its value so the icon needs no loaded API. */
const CIRCLE = 0;

const pin = (saved: boolean, active: boolean) => ({
  path: CIRCLE,
  scale: active ? 11 : 7,
  fillColor: saved ? TERRACOTTA : INK,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: active ? 3 : 2,
});

export default function VenueMap({
  apiKey, venues, hoveredId, onHover, onOpen, onSearchArea, searching, fitKey,
}: {
  apiKey: string;
  venues: MapVenue[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  /** Search the piece of map on screen. Omitted hides the button. */
  onSearchArea?: (bounds: MapBounds) => void;
  searching: boolean;
  /** Changes when the search does. Until then the couple's own panning and
   *  zooming is left alone, results arriving must not yank the map away. */
  fitKey: string;
}) {
  const { t } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMaps | null>(null);
  const map = useRef<GMap | null>(null);
  const markers = useRef(new Map<string, { marker: GMarker; saved: boolean }>());
  /* Until when a zoom is ours. Fitting the map to its pins changes the zoom
     like a person would, and waiting for the map to say it has settled does
     not work: a fit to where it already is never says so. */
  const ownZoomUntil = useRef(0);
  /* Which search they last moved the map during. While it is still the
     current one, the map is theirs: nothing here fits it to the pins. */
  const movedDuring = useRef<string | null>(null);
  const currentFit = useRef(fitKey);
  useEffect(() => { currentFit.current = fitKey; }, [fitKey]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  /** The same, as state: the search whose map view has an unsearched move. */
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const canSearchHere = offerFor === fitKey;

  // Latest callbacks, for listeners that are attached once.
  const handlers = useRef({ onHover, onOpen });
  useEffect(() => { handlers.current = { onHover, onOpen }; }, [onHover, onOpen]);

  useEffect(() => {
    let cancelled = false;
    const live = markers.current;
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !holder.current) return;
        api.current = maps;
        const m = new maps.Map(holder.current, {
          center: { lat: 50, lng: 10 },
          zoom: 4,
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          // The page scrolls, and so does the map: over the map, the wheel is the map's.
          gestureHandling: 'greedy',
          maxZoom: 16,
        });
        map.current = m;
        const byThem = () => {
          movedDuring.current = currentFit.current;
          setOfferFor(currentFit.current);
        };
        // Only a person drags. A zoom can be either.
        m.addListener('dragend', byThem);
        m.addListener('zoom_changed', () => { if (Date.now() > ownZoomUntil.current) byThem(); });
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('failed'); });
    return () => {
      cancelled = true;
      for (const { marker } of live.values()) marker.setMap(null);
      live.clear();
    };
  }, [apiKey]);

  // Pins follow the list: whatever the filters leave is what is on the map.
  useEffect(() => {
    const maps = api.current;
    const m = map.current;
    if (state !== 'ready' || !maps || !m) return;
    const live = markers.current;
    const wanted = new Set(venues.map((v) => v.id));
    for (const [id, { marker }] of live) {
      if (!wanted.has(id)) { marker.setMap(null); live.delete(id); }
    }
    for (const v of venues) {
      const existing = live.get(v.id);
      if (existing) {
        if (existing.saved !== v.saved) { existing.saved = v.saved; existing.marker.setIcon(pin(v.saved, false)); }
        continue;
      }
      const marker = new maps.Marker({
        map: m,
        position: { lat: v.lat, lng: v.lng },
        title: v.name,
        icon: pin(v.saved, false),
        optimized: true,
      });
      marker.addListener('click', () => handlers.current.onOpen(v.id));
      marker.addListener('mouseover', () => handlers.current.onHover(v.id));
      marker.addListener('mouseout', () => handlers.current.onHover(null));
      live.set(v.id, { marker, saved: v.saved });
    }

    if (movedDuring.current === fitKey || venues.length === 0) return;
    ownZoomUntil.current = Date.now() + 1000;
    if (venues.length === 1) {
      m.setCenter({ lat: venues[0].lat, lng: venues[0].lng });
      m.setZoom(11);
      return;
    }
    const lats = venues.map((v) => v.lat);
    const lngs = venues.map((v) => v.lng);
    m.fitBounds({
      south: Math.min(...lats), north: Math.max(...lats),
      west: Math.min(...lngs), east: Math.max(...lngs),
    }, 56);
  }, [venues, state, fitKey]);

  // The card under the pointer, picked out on the map.
  const lit = useRef<string | null>(null);
  useEffect(() => {
    const live = markers.current;
    const before = lit.current ? live.get(lit.current) : null;
    if (before) { before.marker.setIcon(pin(before.saved, false)); before.marker.setZIndex(1); }
    const now = hoveredId ? live.get(hoveredId) : null;
    if (now) { now.marker.setIcon(pin(now.saved, true)); now.marker.setZIndex(1000); }
    lit.current = now ? hoveredId : null;
  }, [hoveredId, venues, state]);

  const searchHere = () => {
    const bounds = map.current?.getBounds()?.toJSON();
    if (!bounds || !onSearchArea) return;
    setOfferFor(null);
    onSearchArea(bounds);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-line bg-shell">
      <div ref={holder} className="h-full w-full" role="application" aria-label={t('Kort over venues')} />

      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-muted" />
        </div>
      )}
      {state === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <p className="text-[0.85rem] leading-relaxed text-ink-soft">
            {t('Kortet kunne ikke hentes. Listen virker stadig.')}
          </p>
        </div>
      )}

      {state === 'ready' && onSearchArea && (canSearchHere || searching) && (
        <button
          type="button"
          onClick={searchHere}
          disabled={searching}
          className="absolute left-1/2 top-3 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 text-[0.78rem] font-semibold text-ink shadow-[0_6px_18px_rgba(18,51,43,0.14)] transition-colors hover:border-ink disabled:cursor-default cursor-pointer"
        >
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {searching ? t('Søger…') : t('Søg i dette område')}
        </button>
      )}
    </div>
  );
}
