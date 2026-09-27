"use client";

/* Interactive destination picker: a Kalas-styled three.js globe (ivory sphere,
   sage dot-matrix continents) where whole countries are the click targets.
   Spin it, zoom it, tap a country, the pick zooms in and the parent opens a
   panel of cities & wedding destinations for it. Country shapes are bundled
   Natural Earth data (countries-110m), no runtime fetches.

   It does not draw place markers. Ten Danish regions sat on top of each other
   as a clump of dots that read as damage on the map, and the panel beside the
   globe already lists the same regions and towns with more room and a
   breadcrumb. Countries are picked here, everything below that is picked
   there. `focus` still flies the camera to whatever the panel selects, so the
   two stay in step. It drills at
   the level the parent is on, and `focus` flies the camera there; the parent
   owns the level and the breadcrumb. Both are optional,
   so Onboarding, which only wants a country picker, passes neither and
   gets exactly what it had. */

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import countriesTopo from './countries-110m.json';
import { useLang } from '../i18n';

type CountryFeature = {
  properties: { name: string };
};

/** A marker on the globe: a region to open, or a town to search. */
export interface GlobePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: 'region' | 'city' | 'wedding';
}

/** Where the camera should be looking. */
export interface GlobeFocus {
  lat: number;
  lng: number;
  altitude: number;
}

// Bundled TopoJSON → GeoJSON features (typed loosely; the shape is Natural Earth's).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = countriesTopo as any;
const LAND = (feature(topo, topo.objects.countries) as unknown as { features: CountryFeature[] }).features
  // Antarctica is a giant click target with no wedding cities — leave it as dots only.
  .filter((f) => f.properties.name !== 'Antarctica');

const SAGE = '#A9B380';

const countryName = (f: object) => (f as CountryFeature).properties.name;

export default function DestinationGlobe({
  selectedCountry,
  onCountryPick,
  focus,
}: {
  selectedCountry: string | null;
  onCountryPick: (country: string, coords: { lat: number; lng: number }) => void;
  /** Controlled camera. The globe flies whenever this changes. */
  focus?: GlobeFocus | null;
}) {
  const { t } = useLang();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  /* The camera can only be moved once globe.gl has built itself, and the
     order in which that happens relative to React's refs is not something to
     bet on, so the fly-to effect waits for this rather than firing blind. */
  const [ready, setReady] = useState(false);

  // Fill the container; the globe needs explicit pixel dimensions.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const globeMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#EFE8D8' }),
    []
  );

  const stopSpin = () => {
    const g = globeRef.current;
    if (g) g.controls().autoRotate = false;
  };

  /* Latest-value ref, so the fly-to effect reads the current focus instead of
     the one that existed when it was made. */
  const focusRef = useRef(focus);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  const onReady = () => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = !focusRef.current;
    controls.autoRotateSpeed = 0.55;
    // Pinch/scroll zoom, bounded so you can't fly through the surface or
    // shrink the globe to a marble. Globe radius is 100 scene units, so
    // distance 108 is altitude 0.08 — close enough to read one town.
    controls.enableZoom = true;
    controls.minDistance = 108;
    controls.maxDistance = 420;
    controls.zoomSpeed = 0.6;
    // Wake up over Europe — most couples start close to home. A parent that
    // drives `focus` moves on from here in the effect below.
    if (!focusRef.current) g.pointOfView({ lat: 48, lng: 10, altitude: 1.85 }, 0);
    setReady(true);
  };

  /* Fly on demand. Keyed on the values rather than object identity, so a
     parent that rebuilds the object every render does not re-fly. */
  const focusKey = focus ? `${focus.lat},${focus.lng},${focus.altitude}` : '';
  const flownTo = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !focusKey || flownTo.current === focusKey) return;
    const g = globeRef.current;
    if (!g) return;
    // The very first move is a jump, not a flight — nobody asked to watch the
    // camera travel to where the page was always going to open.
    const first = flownTo.current === null;
    flownTo.current = focusKey;
    stopSpin();
    const [lat, lng, altitude] = focusKey.split(',').map(Number);
    g.pointOfView({ lat, lng, altitude }, first ? 0 : 900);
  }, [ready, focusKey]);

  const pick = (f: object, coords: { lat: number; lng: number }) => {
    const name = countryName(f);
    stopSpin();
    // A parent that drives `focus` decides where to fly; without one, keep the
    // old behaviour and zoom to the point that was clicked.
    if (!focusRef.current) {
      globeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.1 }, 700);
    }
    onCountryPick(name, coords);
  };

  // Country caps are nearly invisible — the sage dot-matrix stays the visual —
  // but they are the raycast targets, and they tint on hover / selection.
  const capColor = (f: object) => {
    const name = countryName(f);
    if (name === selectedCountry) return 'rgba(193,123,92,0.5)';
    if (name === hovered) return 'rgba(169,179,128,0.55)';
    return 'rgba(169,179,128,0.22)';
  };


  return (
    <div
      ref={wrapRef}
      onPointerDown={stopSpin}
      className="relative h-full w-full cursor-grab active:cursor-grabbing"
      aria-label={t('Drej på kloden, zoom ind og tryk på et land')}
    >
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor={SAGE}
          atmosphereAltitude={0.13}
          hexPolygonsData={LAND}
          hexPolygonResolution={3}
          hexPolygonMargin={0.62}
          hexPolygonColor={() => SAGE}
          polygonsData={LAND}
          polygonAltitude={0.012}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(59,67,42,0.28)'}
          polygonsTransitionDuration={0}
          onPolygonClick={(f, _e, coords) => pick(f as object, coords)}
          onPolygonHover={(f) => {
            setHovered(f ? countryName(f as object) : null);
            if (wrapRef.current) wrapRef.current.style.cursor = f ? 'pointer' : 'grab';
          }}
          onGlobeReady={onReady}
        />
      )}

      {hovered && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#12332b]/90 px-4 py-1.5 text-[0.8rem] font-medium text-[#fffdf7]">
          {hovered}
        </div>
      )}
    </div>
  );
}
