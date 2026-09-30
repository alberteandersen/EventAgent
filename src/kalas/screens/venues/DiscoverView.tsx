"use client";

import { Fragment, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, MapPin, Star, Loader2, Globe as GlobeIcon, Plus, X, ArrowRight, Expand, Search, PenLine } from 'lucide-react';
import { Lightbox } from '../../onboarding/Lightbox';
import { useWedding, type Couple } from '../../useWedding';
import { venueBudget } from '../budget/estimate';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { DestinationSuggestion } from '@/app/api/onboarding/destinations/route';
import type { VenueSuggestion } from '@/lib/venue/search';
import { applyFilters, type VenueBadge, type VenueFilters, type VenueSort } from '@/lib/venue/filter';
import { regionsForCountry, regionShortLabel, regionsLabel, groupByRegion, findRegion, curatedCountryFromLocation, shardsFor, MAX_SHARDS, type VenueRegion } from '@/lib/venue/regions';
import VenueFilterBar, { type VenueFilterCounts, type RegionOption } from './VenueFilterBar';
import VenuePanel from './VenuePanel';
import { countryView, regionView, areaPoint, centroid, TOWN_ALTITUDE, type GeoPoint } from '@/lib/venue/geo';
import type { GlobeFocus, GlobePlace } from '../../onboarding/DestinationGlobe';
import { countryFocus, countryFromLocation } from '../../onboarding/countries';
import { panelSlot } from './grid';
import { venueAreaLabel } from './shared';

const DestinationGlobe = dynamic(() => import('../../onboarding/DestinationGlobe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 size={22} className="animate-spin text-muted" />
    </div>
  ),
});

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
export function DiscoverView({
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
  const { lang, t, tn } = useLang();
  const { updateEvent, budgetItems } = useWedding();
  const venueArea = venueAreaLabel(couple.region);

  /* Seeded, not null. The globe was a mandatory first step before a Danish
     couple could even see "Nordsjælland", but we usually already know where
     they are, and Danish is the app's own language. The globe still works;
     it is just no longer a toll gate.

     The country is the one they chose in onboarding, whichever it is. This
     used to read only countries with curated regions, which is Denmark, so a
     couple who picked France still opened on Denmark. Denmark is only the
     fallback for a Danish couple whose location names no country at all. */
  const seededCountry =
    curatedCountryFromLocation(couple.region)
    ?? countryFromLocation(couple.region)
    ?? (lang === 'da' ? 'Denmark' : null);
  const [country, setCountry] = useState<string | null>(seededCountry);
  /* Earth → land → område → by. The globe draws the markers for whichever
     level this is on; the panel beside it draws the same level as a list. */
  const [level, setLevel] = useState<GlobeLevel>(seededCountry ? 'country' : 'earth');
  /** The region opened at level 'region' — a curated slug or an AI label. */
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [focus, setFocus] = useState<GlobeFocus | null>(
    () => countryView(seededCountry) ?? countryFocus(seededCountry),
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
    setFocus(countryView(c) ?? countryFocus(c) ?? (coords ? { ...coords, altitude: 0.9 } : null));
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
      setFocus(countryView(country) ?? countryFocus(country));
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
        <div className="relative h-[min(62vh,560px)] overflow-hidden rounded-[28px] border border-line bg-paper">
          <DestinationGlobe
            selectedCountry={country}
            onCountryPick={pickCountry}
            focus={focus}
          />
        </div>

        {/* Destination panel, areas, cities, or write your own */}
        <div className="flex min-h-[320px] max-h-[min(62vh,560px)] flex-col overflow-hidden rounded-[28px] border border-line bg-white">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div className="min-w-0">
              {/* Where you are, and every step back out. */}
              <nav aria-label={t('Destination')} className="flex flex-wrap items-center gap-1 text-[0.68rem] text-muted">
                <button
                  type="button"
                  onClick={() => { setOpenRegion(null); setLevel('earth'); setFocus({ lat: 35, lng: 10, altitude: 2.1 }); }}
                  className={cn('cursor-pointer transition-colors hover:text-ink', level === 'earth' && 'font-semibold text-ink')}
                >
                  {t('Jorden')}
                </button>
                {country && (
                  <>
                    <span aria-hidden className="opacity-50">/</span>
                    <button
                      type="button"
                      onClick={() => { setOpenRegion(null); setLevel('country'); setFocus(countryView(country) ?? countryFocus(country)); }}
                      className={cn('cursor-pointer transition-colors hover:text-ink', level === 'country' && 'font-semibold text-ink')}
                    >
                      {country}
                    </button>
                  </>
                )}
                {level === 'region' && openRegionLabel && (
                  <>
                    <span aria-hidden className="opacity-50">/</span>
                    <span className="font-semibold text-ink">{openRegionLabel}</span>
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
                  ? 'border-ink bg-sage-wash text-ink'
                  : 'border-line text-muted hover:border-ink hover:text-ink',
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
                className="shrink-0 overflow-hidden border-b border-line-soft bg-paper"
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <input
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
                    placeholder={t('f.eks. Sydfyn · Toscana · jeres sommerhusby')}
                    className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[0.82rem] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={submitCustom}
                    disabled={!customValue.trim()}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[0.72rem] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    <Search size={13} /> {t('Søg')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Areas+cities ↔ wedding-destination toggle */}
          {level !== 'region' && !destLoading && !destFailed && country && (cities.length > 0 || weddings.length > 0) && (
            <div className="flex shrink-0 gap-0.5 border-b border-line-soft px-3">
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
                    destTab === id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
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
                  className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.72rem] font-semibold text-muted transition-colors hover:border-ink hover:text-ink cursor-pointer"
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
                        ? 'border-ink bg-sage-wash'
                        : 'border-line-soft bg-white hover:border-ink/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openTown(tn.id, tn.point)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <MapPin size={13} className="shrink-0 text-sage" />
                      <span className="truncate text-[0.88rem] font-medium text-ink">{tn.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : !country ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink">
                  <GlobeIcon size={19} className="text-white" />
                </div>
                <p className="text-[0.88rem] leading-relaxed text-ink-soft">
                  {t('Tryk på et land på kloden, eller skriv selv et sted, for at se byer og bryllupsdestinationer.')}
                </p>
                {venueArea && (
                  <button
                    type="button"
                    onClick={() => void searchVenues(venueArea)}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[0.78rem] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
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
                          className="rounded-full border border-line-soft bg-white px-3 py-1.5 text-[0.76rem] font-medium text-ink transition-colors hover:border-ink cursor-pointer"
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
            <div className="border-b border-line-soft pb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sage-strong">{t('Venues')}</p>
              <h2 className="mt-1 font-serif text-[clamp(1.5rem,3vw,2rem)] leading-tight text-ink">
                {destTitle}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
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
                  <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-line-soft bg-white">
                    <div className="h-44 bg-shell" />
                    <div className="space-y-2 p-4">
                      <div className="h-4 w-1/2 rounded bg-shell" />
                      <div className="h-3 w-5/6 rounded bg-shell" />
                      <div className="h-3 w-2/3 rounded bg-shell" />
                    </div>
                  </div>
                ))}
              </div>
            ) : resultsFailed ? (
              <div className="rounded-2xl border border-line-soft bg-white p-8 text-center">
                <p className="text-[0.9rem] text-ink-soft">{t('Kunne ikke finde venues her.')}</p>
                {resultsError && (
                  <p className="mt-1.5 text-[0.75rem] text-muted">{resultsError}</p>
                )}
                <button
                  type="button"
                  onClick={() => (selectedRegions.length > 0 ? void searchRegions(selectedRegions) : void searchVenues(destination))}
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
                    <div key={`shard-${i}`} className="animate-pulse overflow-hidden rounded-2xl border border-line-soft bg-white">
                      <div className="h-44 bg-shell" />
                      <div className="space-y-2 p-4">
                        <div className="h-4 w-1/2 rounded bg-shell" />
                        <div className="h-3 w-5/6 rounded bg-shell" />
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
      active ? 'border-ink shadow-[0_6px_18px_rgba(18,51,43,0.12)]' : 'border-line-soft hover:border-ink/40',
    )}>
      <button type="button" onClick={onChoose} className="block w-full text-left cursor-pointer">
        {s.photo ? (
          <div className="relative h-28 w-full overflow-hidden">
            <img src={s.photo} alt={s.name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-sage-wash">
            <MapPin size={18} className="text-ink opacity-40" />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <p className="truncate font-serif text-[0.98rem] text-ink">{s.name}</p>
            <span className="shrink-0 rounded-full bg-shell px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-ink">
              {s.kind === 'city' ? t('By') : t('Bryllup')}
            </span>
            {s.rating != null && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[0.7rem] text-ink-soft">
                <Star size={11} className="fill-amber text-amber" />{s.rating.toFixed(1)}
              </span>
            )}
          </div>
          {s.blurb && <p className="mt-1 line-clamp-2 text-[0.74rem] leading-snug text-muted">{s.blurb}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink">
            {active ? <><Check size={12} /> {t('Viser venues')}</> : <>{t('Se venues')} <ArrowRight size={12} /></>}
          </p>
        </div>
      </button>
      {onExpand && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          aria-label={t('Forstør billede')}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-sm transition-colors hover:text-ink cursor-pointer"
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
  const { t, tn } = useLang();
  return (
    <div className={cn(
      'group flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow',
      open ? 'border-ink shadow-[0_10px_28px_rgba(18,51,43,0.10)]' : 'border-line-soft hover:shadow-[0_10px_28px_rgba(18,51,43,0.10)]',
    )}>
      {/* The picture opens the venue; the corner button opens the photos.
          Siblings, not nested, a button inside a button is invalid HTML and
          the inner one stops working. */}
      <div className="relative h-44 w-full overflow-hidden bg-sage-wash">
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
              <MapPin size={22} className="text-ink opacity-40" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </button>
        {v.rating != null && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.68rem] font-semibold text-ink backdrop-blur-sm">
            <Star size={11} fill="currentColor" className="text-amber" />
            {v.rating.toFixed(1)}
            {v.review_count ? <span className="font-normal text-muted">({v.review_count})</span> : null}
          </span>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={t('Se billeder af {name}', { name: v.name })}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink-deep/40 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Expand size={14} />
          </button>
        )}
        {v.photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] font-semibold text-white backdrop-blur-sm">
            {tn(v.photos.length, '{n} billede', '{n} billeder')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-serif text-[1.05rem] leading-tight text-ink hover:underline underline-offset-4 cursor-pointer"
        >
          {v.name}
        </button>
        {v.address && (
          <p className="mt-1 flex items-start gap-1 text-[0.72rem] text-muted">
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
                  b.tone === 'good' && 'bg-sage-wash text-ink',
                  b.tone === 'warn' && 'bg-clay-tint text-clay-ink',
                  b.tone === 'neutral' && 'bg-shell text-muted',
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
              saved ? 'bg-sage-wash text-ink cursor-default' : 'bg-ink text-white hover:opacity-90 cursor-pointer',
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Plus size={13} />}
            {saved ? t('På listen') : t('Tilføj til liste')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('Afvis {name}', { name: v.name })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
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
        className="rounded-full border border-ink/20 px-4 py-2 text-[0.75rem] font-bold text-ink hover:bg-paper transition-colors cursor-pointer"
      >
        {t('Prøv igen')}
      </button>
    </div>
  );
}
