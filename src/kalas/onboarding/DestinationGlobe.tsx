"use client";

/* Interactive country picker: a Kalas-styled three.js globe (ivory sphere,
   sage dot-matrix continents) where whole countries are the click targets.
   Spin it, zoom it, tap a country. Country shapes are bundled Natural Earth
   data (countries-110m), no runtime fetches.

   It answers one question, which country, and that is why it lives in
   onboarding and no longer in Venues: venues are chosen tens of kilometres
   apart, at a scale where a globe has no towns or coast to tell them apart
   by, and that page has a real map now (venues/VenueMap.tsx).

   `focus` flies the camera to whatever the parent selects, so a search box
   beside the globe and the globe itself stay in step. It is optional; a
   parent that passes none gets a globe that zooms to whatever is tapped. */

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import countriesTopo from './countries-110m.json';
import { useLang } from '../i18n';

type Ring = [number, number][];
type CountryFeature = {
  properties: { name: string };
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
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

/* The 110m data squashes one North Korean islet to four copies of the same
   point. H3 throws on a polygon with no area, and the throw stopped the
   dot-matrix where it stood: every country after North Korea in the file
   came out bare. */
const hasArea = ([outer]: Ring[]) => new Set(outer.map(([lng, lat]) => `${lng},${lat}`)).size >= 3;
const polygonsOf = ({ geometry }: CountryFeature) =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).filter(hasArea);

/* The dot-matrix is one colour everywhere, so all land goes in as a single
   shape: one mesh and one draw call, where a feature per country was 176. */
const DOTS = [{ geometry: { type: 'MultiPolygon', coordinates: LAND.flatMap(polygonsOf) } }];

const SAGE = '#A9B380';

/* Country caps are nearly invisible, the sage dot-matrix stays the visual,
   but they are the raycast targets, and they tint on hover / selection.

   Two things here are for speed, and both were costing far more than they
   look like. Three materials are shared by every country, where globe.gl
   makes one per polygon. And forceSinglePass: three.js draws a transparent
   double-sided material in two passes and marks it changed before each, so
   it re-derived the shader program for every polygon, twice, on every frame.
   That was a third of a CPU core for as long as the globe was on screen, and
   most of a second of frozen page before it first showed. */
const capMaterial = (color: string, opacity: number) =>
  new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, side: THREE.DoubleSide, forceSinglePass: true,
  });
const CAP = capMaterial(SAGE, 0.22);
const CAP_HOVERED = capMaterial(SAGE, 0.55);
const CAP_SELECTED = capMaterial('#C17B5C', 0.5);
const CAP_ALTITUDE = 0.012;

/* The borders, as one object. globe.gl's own polygon stroke is a line object
   and a material per polygon, some 290 of them, set up and drawn one by one;
   this is the same lines in a single draw call. Points follow the great
   circle between vertices, as the caps do, so a long straight border (the
   49th parallel) stays on the surface instead of cutting under it. */
const GLOBE_RADIUS = 100; // globe.gl's, in scene units
const RAD = Math.PI / 180;
const BORDER_STEP = 5 * RAD;
function borderLines() {
  const r = GLOBE_RADIUS * (1 + CAP_ALTITUDE + 1e-4); // a hair above the caps
  const onSphere = ([lng, lat]: [number, number]) =>
    new THREE.Vector3().setFromSphericalCoords(1, (90 - lat) * RAD, lng * RAD);
  const points: number[] = [];
  for (const country of LAND) {
    for (const ring of polygonsOf(country).flat()) {
      let from = onSphere(ring[0]);
      for (let i = 1; i < ring.length; i++) {
        const to = onSphere(ring[i]);
        const steps = Math.max(1, Math.ceil(from.angleTo(to) / BORDER_STEP));
        let a = from;
        for (let s = 1; s <= steps; s++) {
          const b = s === steps ? to : new THREE.Vector3().lerpVectors(from, to, s / steps).normalize();
          points.push(a.x * r, a.y * r, a.z * r, b.x * r, b.y * r, b.z * r);
          a = b;
        }
        from = to;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: '#3B432A', opacity: 0.28, transparent: true })
  );
  // Decoration only: the caps underneath are what hover and clicks should hit.
  lines.raycast = () => {};
  return lines;
}
// Stable identities, so globe.gl builds the borders once rather than per render.
const BORDERS = [{}];
const keepBorders = () => {};

const countryName = (f: object) => (f as CountryFeature).properties.name;

export default function DestinationGlobe({
  selectedCountries,
  onCountryPick,
  focus,
}: {
  /** The globe's own country names. Onboarding lets a couple pick several. */
  selectedCountries: readonly string[];
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

  const capFor = (f: object) => {
    const name = countryName(f);
    if (selectedCountries.includes(name)) return CAP_SELECTED;
    if (name === hovered) return CAP_HOVERED;
    return CAP;
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
          hexPolygonsData={DOTS}
          hexPolygonResolution={3}
          hexPolygonMargin={0.62}
          hexPolygonColor={() => SAGE}
          polygonsData={LAND}
          polygonAltitude={CAP_ALTITUDE}
          polygonCapMaterial={capFor}
          // No sides: at this height they were never visible, only built and drawn.
          polygonSideColor={() => ''}
          customLayerData={BORDERS}
          customThreeObject={borderLines}
          customThreeObjectUpdate={keepBorders}
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
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-deep/90 px-4 py-1.5 text-[0.8rem] font-medium text-paper">
          {hovered}
        </div>
      )}
    </div>
  );
}
