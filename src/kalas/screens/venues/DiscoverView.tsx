"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, List, Loader2, Map as MapIcon, Plus } from 'lucide-react';
import { Lightbox } from '../../onboarding/Lightbox';
import { useWedding, type Couple } from '../../useWedding';
import { venueBudget } from '../budget/estimate';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import type { VenueSuggestion } from '@/lib/venue/search';
import { applyFilters, type VenueFilters, type VenueSort } from '@/lib/venue/filter';
import type { VenueSetting } from '@/lib/venue/facts';
import { regionsForCountry } from '@/lib/venue/regions';
import {
  placeCountry, placeFromText, placeKey, placesTitle, planShards, type SearchPlace, type ShardBody,
} from '@/lib/venue/searchPlan';
import { boundsCentre, localityOf, type MapBounds } from '@/lib/venue/mapArea';
import { distanceKm } from '@/lib/venue/distance';
import VenueFilterBar, { type VenueFilterCounts } from './VenueFilterBar';
import VenuePanel from './VenuePanel';
import VenueBrief from './VenueBrief';
import AreaExplorer from './AreaExplorer';
import MoodRow from './MoodRow';
import VenueCard from './VenueCard';
import type { MapVenue } from './VenueMap';
import { venueAreaLabel } from './shared';

const VenueMap = dynamic(() => import('./VenueMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-line bg-shell">
      <Loader2 size={22} className="animate-spin text-muted" />
    </div>
  ),
});

/* ═══════════════════════════════════════════════════════════════════════
   DISCOVER VIEW, where and what → real venues, as a list and on a map
═══════════════════════════════════════════════════════════════════════ */

/* A browser key for the Maps JavaScript API. Without one there is no map and
   the page is the list alone, which is the whole of it for most couples. */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** Remembered per browser: a couple who opened the map once wants it next time. */
const MAP_PREF = 'kalas.venues.map';

/** How many places a search starts from when the wedding supplies them. */
const SEED_PLACES = 4;
/** A mood with fewer matches than this goes looking for more of its own. */
const THIN_MOOD = 4;
/** How many areas that extra look is spread over. */
const MOOD_SHARDS = 4;

/**
 * Where the search starts: what the couple said in onboarding. Their place
 * first, then the others they were choosing between.
 */
function seedPlaces(area: string, named: string[]): SearchPlace[] {
  const places: SearchPlace[] = [];
  const seen = new Set<string>();
  for (const text of [area, ...named]) {
    const place = placeFromText(text);
    if (!place || seen.has(placeKey(place))) continue;
    seen.add(placeKey(place));
    places.push(place);
    if (places.length === SEED_PLACES) break;
  }
  return places;
}

export function DiscoverView({
  couple, savedPlaceIds, similarNames, onSaved, onBack, onViewList, savedCount = 0,
  embedded = false, categoryBar, mapsKey = MAPS_KEY,
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
  /** The Maps key. A prop so a /dev harness can show the map without one. */
  mapsKey?: string;
}) {
  const { lang, t, tn } = useLang();
  const { updateEvent, budgetItems, event } = useWedding();
  const venueArea = venueAreaLabel(couple.region);

  /* Onboarding lets a couple name several countries. The first is the
     wedding's location; the rest ride along here. */
  const namedRaw = event?.requirements?.loved_destinations;
  const named = useMemo(
    () => (Array.isArray(namedRaw) ? namedRaw.filter((v): v is string => typeof v === 'string') : []),
    [namedRaw],
  );
  const seedKey = [venueArea, ...named].join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seed = useMemo(() => seedPlaces(venueArea, named), [seedKey]);

  /* ── What is being searched ─────────────────────────────────────────── */
  const [places, setPlaces] = useState<SearchPlace[]>([]);
  /** Their own description, as the current results were searched with it. */
  const [wish, setWish] = useState('');
  /** "Find flere som disse": the names on their list, steering the search. */
  const [similar, setSimilar] = useState<string[] | null>(null);
  /* The same three, readable from a search that outlives the render that
     started it. Written where the state is, never anywhere else. */
  const placesRef = useRef<SearchPlace[]>([]);
  const wishRef = useRef('');
  const similarRef = useRef<string[] | null>(null);

  const [results, setResults] = useState<VenueSuggestion[]>([]);
  const resultsRef = useRef<VenueSuggestion[]>([]);
  useEffect(() => { resultsRef.current = results; }, [results]);
  const [resultsFailed, setResultsFailed] = useState(false);
  /** Why the search failed, when we know. A silent generic message made a
   *  function timeout indistinguishable from "this town has no venues". */
  const [resultsError, setResultsError] = useState<string | null>(null);
  /* Shards still in flight. A search is several parallel requests, so results
     stream in and the grid grows rather than blocking on the slowest area. */
  const [pending, setPending] = useState(0);
  /* Venues the server dropped for being too small, so the count line can say
     so instead of the list quietly being short. */
  const [hiddenCapacity, setHiddenCapacity] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<VenueSort>('relevance');
  /* Every search gets a number. Answers to an older one are dropped: a slow
     shard for Fyn must not land in a list that is now Tuscany. */
  const searchSeq = useRef(0);
  /** Bumped when a search should be allowed to move the map. */
  const [fitKey, setFitKey] = useState(0);
  /** Moods already given their extra look in the current search. */
  const moodFetched = useRef(new Set<string>());

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
  /* A search started in the same click as a filter change has to send the
     new filters, and state has not updated yet at that point. */
  const filtersRef = useRef(filters);

  /* The venue allocation arrives from Supabase after the first render, so the
     seed above starts from the benchmark share and is corrected here once the
     real line lands, but never after the couple has moved the slider
     themselves. Their choice outranks their budget. */
  const budgetTouched = useRef(false);
  const allocatedBudget = venueBudget(budgetItems, couple.budgetTotal);
  useEffect(() => {
    if (budgetTouched.current) return;
    setFilters((f) => {
      const next = f.budget_max === allocatedBudget ? f : { ...f, budget_max: allocatedBudget };
      filtersRef.current = next;
      return next;
    });
  }, [allocatedBudget]);

  const onFiltersChange = (next: VenueFilters) => {
    if (next.budget_max !== filtersRef.current.budget_max) budgetTouched.current = true;
    filtersRef.current = next;
    setFilters(next);
  };

  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fullscreen photo viewer for destinations and venues.
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; alt: string } | null>(null);
  /* The venue open in the modal. Deliberately built from the suggestion
     rather than a saved row: opening a venue must not put it on the list. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** The venue under the pointer, on the card or on its pin. */
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /* Once they change the search themselves, their choice outranks the
     wedding's location, which arrives late and can change under the page. */
  const pickedRef = useRef(false);

  /* ── Destinations: what a country is known for ──────────────────────── */
  const [destByCountry, setDestByCountry] = useState<Record<string, DestinationSuggestion[]>>({});
  const destRef = useRef<Record<string, DestinationSuggestion[]>>({});
  const destPending = useRef<Record<string, Promise<DestinationSuggestion[]>>>({});
  const [destLoading, setDestLoading] = useState<string | null>(null);
  const [destFailed, setDestFailed] = useState<string | null>(null);

  /** A country's destinations, fetched once. Resolves to [] when it fails. */
  const ensureDestinations = (country: string): Promise<DestinationSuggestion[]> => {
    const have = destRef.current[country];
    if (have) return Promise.resolve(have);
    destPending.current[country] ??= (async () => {
      setDestLoading(country);
      setDestFailed((f) => (f === country ? null : f));
      try {
        const res = await fetch(`/api/onboarding/destinations?country=${encodeURIComponent(country)}&lang=${lang}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { suggestions?: DestinationSuggestion[] };
        const list = data.suggestions ?? [];
        if (list.length === 0) throw new Error('empty');
        destRef.current = { ...destRef.current, [country]: list };
        setDestByCountry(destRef.current);
        return list;
      } catch {
        setDestFailed(country);
        delete destPending.current[country];
        return [];
      } finally {
        setDestLoading((c) => (c === country ? null : c));
      }
    })();
    return destPending.current[country];
  };

  /* ── Searching ──────────────────────────────────────────────────────── */

  /* What every request sends. The requirements steer the prompt — asking the
     model for venues that seat 70 with rooms on site beats asking for
     anything and discarding most of it. */
  const searchBody = (shard: ShardBody, extra: Record<string, unknown> = {}) => {
    const f = filtersRef.current;
    return {
      // Where the couple actually is, so every venue can carry a distance.
      origin: venueArea || couple.region || undefined,
      guest_count: f.min_capacity ?? undefined,
      budget: f.budget_max ? String(f.budget_max) : undefined,
      lang,
      filters: { catering: f.catering, accommodation: f.accommodation, settings: f.settings },
      wish: wishRef.current || undefined,
      loved_destinations: similarRef.current ?? undefined,
      ...shard,
      ...extra,
    };
  };

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

  /** Run a set of requests in parallel, streaming each one in as it lands.
   *  Never throws: one failed area must not empty the rest. */
  const runShards = async (shards: ShardBody[], seq: number, opts: { append: boolean; extra?: Record<string, unknown> }) => {
    setPending(shards.length);
    let got = 0;
    await Promise.all(
      shards.map(async (shard) => {
        let data: ShardResponse | null = null;
        let failure: string | null = null;
        try {
          const res = await fetch('/api/onboarding/venues', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchBody(shard, opts.extra)),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = (await res.json()) as ShardResponse;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
        }
        if (seq !== searchSeq.current) return;
        if (failure) setResultsError(failure);
        if (data?.venues?.length) {
          got += data.venues.length;
          setResults((prev) => mergeVenues(prev, data.venues!));
        }
        if (data?.hidden?.capacity) setHiddenCapacity((h) => h + data.hidden!.capacity!);
        setPending((n) => Math.max(0, n - 1));
      })
    );
    if (seq === searchSeq.current && !opts.append && got === 0) setResultsFailed(true);
  };

  /**
   * Search these places. Everything that changes what is searched comes
   * through here: the wedding's own location, a typed place, a region chip,
   * a destination card, the map's "search this area", a new description.
   */
  const runSearch = async (
    next: SearchPlace[],
    opts: { wish?: string; similar?: string[] | null } = {},
  ) => {
    const seq = ++searchSeq.current;
    placesRef.current = next;
    setPlaces(next);
    if (opts.wish !== undefined) { wishRef.current = opts.wish; setWish(opts.wish); }
    if (opts.similar !== undefined) { similarRef.current = opts.similar; setSimilar(opts.similar); }
    // A map rectangle was found by moving the map. Fitting it to the answers
    // would move it again, away from what they asked to see.
    if (!next.some((p) => p.kind === 'map')) setFitKey((k) => k + 1);
    moodFetched.current.clear();

    setResultsFailed(false);
    setResultsError(null);
    setResults([]);
    setHiddenCapacity(0);
    if (next.length === 0) { setPending(0); return; }

    // A country with no regions of ours is searched through its destinations,
    // so those have to be known before the search can be planned.
    setPending(1);
    await Promise.all(next.map((p) =>
      p.kind === 'country' && regionsForCountry(p.country).length === 0 ? ensureDestinations(p.country) : null
    ));
    if (seq !== searchSeq.current) return;
    await runShards(planShards(next, destRef.current), seq, { append: false });
  };

  /* "Vis flere": the same search again, told what is already on screen. */
  const loadMore = async (limit?: number) => {
    const current = placesRef.current;
    if (current.length === 0) return;
    setLoadingMore(true);
    const seq = searchSeq.current;
    const shown = resultsRef.current;
    const page = {
      exclude: shown.map((v) => v.name),
      exclude_place_ids: shown.map((v) => v.place_id).filter((id): id is string => Boolean(id)),
    };
    try {
      const shards = planShards(current, destRef.current);
      await runShards(limit ? shards.slice(0, limit) : shards, seq, { append: true, extra: page });
    } finally {
      setLoadingMore(false);
    }
  };

  /* The wedding's own place is already known, so search it. Making a couple
     find Denmark on a globe and click "Odense" to tell us "Odense" was the
     whole friction of the page this replaced. */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (pickedRef.current || seededFor.current === seedKey) return;
    // "Find flere som disse" owns the first search when it is armed.
    if (similarNames && similarNames.length > 0) return;
    seededFor.current = seedKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- searching the wedding's own place is what this effect is for
    if (seed.length > 0) void runSearch(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  /* "Find flere som disse": recommendations seeded by what is already on the
     list, reusing the same search with the liked names as the vibe. */
  const similarStarted = useRef(false);
  useEffect(() => {
    if (similarStarted.current || !similarNames || similarNames.length === 0) return;
    similarStarted.current = true;
    seededFor.current = seedKey;
    const around = seed.length > 0
      ? seed.slice(0, 1)
      : [{ kind: 'text' as const, query: venueArea || couple.region || 'jeres område' }];
    void runSearch(around, { similar: similarNames.slice(0, 8) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [similarNames]);

  /* ── Changing the places ────────────────────────────────────────────── */

  const has = (place: SearchPlace) => places.some((p) => placeKey(p) === placeKey(place));

  const addPlace = (place: SearchPlace) => {
    pickedRef.current = true;
    const current = placesRef.current;
    if (current.some((p) => placeKey(p) === placeKey(place))) return;
    const country = placeCountry(place);
    const kept = current.filter((p) => {
      // A map rectangle is a search of its own, not one more place in a list.
      if (p.kind === 'map' || place.kind === 'map') return false;
      // Narrowing a country replaces it: "Italy" next to "Tuscany" would
      // spend most of the search outside the place they just pointed at.
      if (place.kind !== 'country' && p.kind === 'country' && p.country === country) return false;
      return true;
    });
    void runSearch([...kept, place], { similar: null });
  };

  const removePlace = (key: string) => {
    const current = placesRef.current;
    const next = current.filter((p) => placeKey(p) !== key);
    /* Clearing a place they added falls back to where the wedding is, so the
       page is not left blank. Clearing the wedding's own place does not: a
       chip that comes straight back when removed reads as broken. */
    const wasTheirs = !seed.some((p) => placeKey(p) === key);
    if (next.length === 0 && wasTheirs && seed.length > 0) {
      pickedRef.current = false;
      void runSearch(seed, { similar: null });
      return;
    }
    pickedRef.current = true;
    void runSearch(next, { similar: null });
  };

  const addTyped = (text: string) => {
    const place = placeFromText(text);
    if (!place) return;
    if (place.kind === 'country') setExploreCountry(place.country);
    addPlace(place);
  };

  const onWish = (next: string) => {
    if (placesRef.current.length === 0) { wishRef.current = next; setWish(next); return; }
    void runSearch(placesRef.current, { wish: next });
  };

  /* "Søg i dette område". A rectangle has no name, and the search looks
     venues up by one, so it borrows the town of the nearest venue it knows. */
  const searchMapArea = (bounds: MapBounds) => {
    const centre = boundsCentre(bounds);
    let near: string | null = null;
    let nearest = Infinity;
    for (const v of resultsRef.current) {
      if (v.lat == null || v.lng == null) continue;
      const d = distanceKm(centre, { lat: v.lat, lng: v.lng });
      if (d < nearest) { nearest = d; near = localityOf(v.address); }
    }
    addPlace({ kind: 'map', bounds, near });
  };

  /* Guest count steers the prompt, so changing it re-runs the search, and it
     belongs to the wedding, not just this screen. */
  const onGuestsCommit = (guests: number | null) => {
    if (guests && guests !== couple.guests) void updateEvent({ guest_count: guests });
    if (placesRef.current.length > 0) void runSearch(placesRef.current);
  };

  /* ── Exploring: where in the country ────────────────────────────────── */

  const [exploreCountry, setExploreCountry] = useState<string | null>(null);
  /** null until they use the button: open by itself while the search is only
   *  as narrow as a country, or has nowhere to look at all. */
  const [exploreOpen, setExploreOpen] = useState<boolean | null>(null);

  const placeCountries = places.map(placeCountry).filter((c): c is string => Boolean(c));
  const namedCountries = seed.map(placeCountry).filter((c): c is string => Boolean(c));
  const contextCountry =
    exploreCountry ?? placeCountries[0] ?? namedCountries[0] ?? (lang === 'da' ? 'Denmark' : null);
  const exploreCountries = [...new Set([...placeCountries, ...namedCountries, ...(contextCountry ? [contextCountry] : [])])];
  const exploring = exploreOpen ?? (places.length === 0 || places.every((p) => p.kind === 'country'));
  const contextRegions = contextCountry ? regionsForCountry(contextCountry) : [];

  useEffect(() => {
    if (!exploring || !contextCountry || contextRegions.length > 0) return;
    void ensureDestinations(contextCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploring, contextCountry]);

  const togglePlace = (place: SearchPlace) => {
    /* They are choosing here, so the panel stays while they do, and stays on
       this country: its default is the first place's country, which the very
       pick they are making can change. */
    setExploreOpen(true);
    setExploreCountry(contextCountry);
    if (has(place)) removePlace(placeKey(place)); else addPlace(place);
  };

  /* ── Saving ─────────────────────────────────────────────────────────── */

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

  /* ── What is on screen ──────────────────────────────────────────────── */

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

  /* ── Moods ──────────────────────────────────────────────────────────── */

  const moods = filters.settings ?? [];
  /* Picking a mood is a requirement, not a preference: a couple who taps
     "Slot" and still sees every barn, only lower down, has been ignored.
     Venues whose kind we do not know stay, as with every other filter. */
  const toggleMood = (setting: VenueSetting) => {
    const current = filtersRef.current;
    const next = (current.settings ?? []).includes(setting)
      ? (current.settings ?? []).filter((s) => s !== setting)
      : [...(current.settings ?? []), setting];
    const require = (current.require ?? []).filter((r) => r !== 'setting');
    onFiltersChange({ ...current, settings: next, require: next.length > 0 ? [...require, 'setting'] : require });
  };

  /* The first search was not told about the mood, so it may hold two castles
     or none. When it is that thin, look again with the mood in the brief,
     once per mood per search. */
  const moodKey = [...moods].sort().join(',');
  const moodMatches = notDismissed.filter((v) => v.facts.setting != null && moods.includes(v.facts.setting)).length;
  useEffect(() => {
    if (!moodKey || searching || loadingMore || places.length === 0 || results.length === 0) return;
    if (moodMatches >= THIN_MOOD || moodFetched.current.has(moodKey)) return;
    moodFetched.current.add(moodKey);
    void loadMore(MOOD_SHARDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodKey, searching, loadingMore, moodMatches]);

  /* ── The map ────────────────────────────────────────────────────────── */

  const hasMap = Boolean(mapsKey);
  const [mapOn, setMapOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    try { setMapOn(window.localStorage.getItem(MAP_PREF) === '1'); } catch { /* private window */ }
  }, []);
  const showMap = (on: boolean) => {
    setMapOn(on);
    try { window.localStorage.setItem(MAP_PREF, on ? '1' : '0'); } catch { /* private window */ }
  };
  const split = hasMap && mapOn;

  const savedKey = [...justSaved, ...savedPlaceIds].join('|');
  const mapVenues: MapVenue[] = useMemo(
    () => visibleResults.flatMap(({ venue: v }) => (v.lat != null && v.lng != null
      ? [{ id: v.id, name: v.name, lat: v.lat, lng: v.lng, saved: isSaved(v) }]
      : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleResults, savedKey],
  );

  const title = similar ? t('Ligner jeres liste') : placesTitle(places, lang);
  const openRow = openId ? visibleResults.find((r) => r.venue.id === openId) ?? null : null;

  const skeleton = (key: string | number) => (
    <div key={key} className="animate-pulse overflow-hidden rounded-2xl border border-line-soft bg-white">
      <div className="h-44 bg-shell" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-1/2 rounded bg-shell" />
        <div className="h-3 w-5/6 rounded bg-shell" />
        <div className="h-3 w-2/3 rounded bg-shell" />
      </div>
    </div>
  );
  const gridCls = cn('grid gap-4 sm:grid-cols-2', !split && 'xl:grid-cols-3');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-5',
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

      <VenueBrief
        places={places}
        onAdd={addTyped}
        onRemove={removePlace}
        wish={wish}
        onWish={onWish}
        exploring={exploring}
        onToggleExplore={() => setExploreOpen(!exploring)}
        searching={searching}
      />

      {exploring && (
        <AreaExplorer
          countries={exploreCountries}
          country={contextCountry}
          onCountry={setExploreCountry}
          regions={contextRegions}
          destinations={contextCountry ? destByCountry[contextCountry] ?? [] : []}
          loading={destLoading === contextCountry}
          failed={destFailed === contextCountry}
          onRetry={() => { if (contextCountry) void ensureDestinations(contextCountry); }}
          isActive={has}
          onToggle={togglePlace}
          onPhoto={(photo, name) => setLightbox({ photos: [photo], index: 0, alt: name })}
        />
      )}

      {places.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sage-strong">{t('Venues')}</p>
              <h2 className="mt-1 font-serif text-[clamp(1.5rem,3vw,2rem)] leading-tight text-ink">{title}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {t('Tryk på et venue for at se det hele, I behøver ikke gemme det først.')}
              </p>
            </div>
            {hasMap && (
              <div className="flex shrink-0 rounded-full border border-line bg-shell p-1" role="group" aria-label={t('Visning')}>
                {[
                  { on: false, label: t('Liste'), Icon: List },
                  { on: true, label: t('Kort'), Icon: MapIcon },
                ].map(({ on, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={mapOn === on}
                    onClick={() => showMap(on)}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[0.78rem] font-semibold transition-colors cursor-pointer',
                      mapOn === on ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                    )}
                  >
                    <Icon size={14} aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {results.length > 0 && <MoodRow venues={notDismissed} selected={moods} onToggle={toggleMood} />}

          <VenueFilterBar
            filters={filters}
            onChange={onFiltersChange}
            onGuestsCommit={onGuestsCommit}
            /* Where is the search bar's job now, and what kind is the row of
               pictures above, so neither is repeated as a pill. */
            regions={[]}
            activeRegionIds={[]}
            onRegionToggle={() => {}}
            showSettings={false}
            sort={sort}
            onSortChange={setSort}
            counts={counts}
            hasDistances={notDismissed.some((v) => v.distance_km != null)}
            allocatedBudget={allocatedBudget}
            loading={searching}
            savedCount={savedCount}
            onOpenSaved={onViewList}
          />

          <div className={cn(split && 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] xl:items-start xl:gap-5')}>
            {split && (
              /* Above the list on a phone, beside it and following the scroll
                 on a wide screen. */
              <div className="mb-4 h-[46vh] xl:order-last xl:mb-0 xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)]">
                <VenueMap
                  apiKey={mapsKey}
                  venues={mapVenues}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onOpen={setOpenId}
                  onSearchArea={searchMapArea}
                  searching={searching}
                  fitKey={String(fitKey)}
                />
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-5">
              {searching && visibleResults.length === 0 ? (
                <div className={gridCls}>{[0, 1, 2, 3, 4, 5].map(skeleton)}</div>
              ) : resultsFailed ? (
                <div className="rounded-2xl border border-line-soft bg-white p-8 text-center">
                  <p className="text-[0.9rem] text-ink-soft">{t('Kunne ikke finde venues her.')}</p>
                  {resultsError && (
                    <p className="mt-1.5 text-[0.75rem] text-muted">{resultsError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void runSearch(placesRef.current)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.78rem] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    {t('Prøv igen')}
                  </button>
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="rounded-2xl border border-line-soft bg-white p-8 text-center">
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
                    <p className="mt-1.5 text-[0.75rem] text-muted">
                      {tn(rejected.length, 'Ét sted blev filtreret fra.', '{n} steder blev filtreret fra.')}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className={gridCls}>
                    {visibleResults.map(({ venue: v, verdict }) => (
                      <VenueCard
                        key={v.id}
                        v={v}
                        badges={verdict.badges}
                        saved={isSaved(v)}
                        saving={savingId === v.id}
                        highlighted={hoveredId === v.id}
                        onHover={split ? (over) => setHoveredId(over ? v.id : null) : undefined}
                        onOpen={() => setOpenId(v.id)}
                        onSave={() => void saveVenue(v)}
                        onDismiss={() => dismissVenue(v.id)}
                        onExpand={
                          v.photos.length || v.photo
                            ? () => setLightbox({ photos: v.photos.length ? v.photos : [v.photo!], index: 0, alt: v.name })
                            : undefined
                        }
                      />
                    ))}
                    {/* A request still in flight, the grid grows as areas land. */}
                    {searching && [0, 1, 2].map((i) => skeleton(`shard-${i}`))}
                  </div>

                  {!searching && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-5 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40 cursor-pointer"
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
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-5 text-xs font-semibold text-paper transition-opacity hover:opacity-90 cursor-pointer"
                      >
                        {t('Se jeres liste ({n})', { n: justSaved.size })} <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The photo viewer opens on top of the modal; Escape and the backdrop
          then belong to the viewer, so the modal stays put until it is gone. */}
      <VenuePanel
        v={openRow?.venue ?? null}
        badges={openRow?.verdict.badges ?? []}
        saved={openRow ? isSaved(openRow.venue) : false}
        saving={openRow ? savingId === openRow.venue.id : false}
        onSave={() => { if (openRow) void saveVenue(openRow.venue); }}
        onClose={() => { if (!lightbox) setOpenId(null); }}
        onPhoto={(index) => {
          if (!openRow) return;
          setLightbox({
            photos: openRow.venue.photos.length ? openRow.venue.photos : [openRow.venue.photo!],
            index,
            alt: openRow.venue.name,
          });
        }}
      />

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
