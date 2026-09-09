"use client";

/* DestinationGlobe's drill-down against the real Danish geography — the globe
   in the app sits behind a login, a wedding and a loaded destination list, so
   this is the only place it can be spun while it is being changed. It exercises
   the component's whole new surface: markers per level, the controlled camera,
   and marker picks. Sibling of /dev/venue-filters. */
import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { GlobeFocus, GlobePlace } from '@/kalas/onboarding/DestinationGlobe';
import { DK_REGIONS, findRegion, regionShortLabel } from '@/lib/venue/regions';
import { areaPoint, countryView, regionView, TOWN_ALTITUDE } from '@/lib/venue/geo';

const DestinationGlobe = dynamic(() => import('@/kalas/onboarding/DestinationGlobe'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f0ede5]" />,
});

type Level = 'earth' | 'country' | 'region';

export default function DevGlobePage() {
  const [level, setLevel] = useState<Level>('country');
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [focus, setFocus] = useState<GlobeFocus | null>(countryView('Denmark'));
  const [picked, setPicked] = useState<string>('-');

  const places: GlobePlace[] =
    level === 'earth'
      ? []
      : level === 'country'
        ? DK_REGIONS.flatMap((r) => {
            const view = regionView(r.slug);
            return view
              ? [{ id: r.slug, name: regionShortLabel(r, 'da'), lat: view.lat, lng: view.lng, kind: 'region' as const }]
              : [];
          })
        : (findRegion(openRegion)?.areas ?? []).flatMap((a) => {
            const pt = areaPoint(a);
            return pt
              ? [{ id: a, name: a, lat: pt.lat, lng: pt.lng, kind: 'city' as const }]
              : [];
          });

  const onPick = (p: GlobePlace) => {
    setPicked(`${p.kind}: ${p.name}`);
    if (p.kind === 'region') {
      setOpenRegion(p.id);
      setLevel('region');
      const view = regionView(p.id);
      if (view) setFocus(view);
      return;
    }
    setFocus({ lat: p.lat, lng: p.lng, altitude: TOWN_ALTITUDE });
  };

  const zoomOut = () => {
    if (level === 'region') {
      setOpenRegion(null);
      setLevel('country');
      setFocus(countryView('Denmark'));
      return;
    }
    setLevel('earth');
    setFocus({ lat: 35, lng: 10, altitude: 2.1 });
  };

  return (
    <div className="theme-kalas min-h-screen bg-canvas p-10 font-sans text-ink">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[0.8rem] text-muted">
          <span className="font-semibold text-ink">
            {level === 'region' ? `Jorden / Danmark / ${openRegion}` : level === 'country' ? 'Jorden / Danmark' : 'Jorden'}
          </span>
          <button
            type="button"
            onClick={zoomOut}
            className="rounded-full border border-line px-3 py-1.5 font-semibold hover:border-ink hover:text-ink cursor-pointer"
          >
            Zoom ud
          </button>
          <button
            type="button"
            onClick={() => { setLevel('country'); setOpenRegion(null); setFocus(countryView('Denmark')); }}
            className="rounded-full border border-line px-3 py-1.5 font-semibold hover:border-ink hover:text-ink cursor-pointer"
          >
            Til Danmark
          </button>
          <span>valgt: {picked}</span>
        </div>

        {/* The globe no longer carries place markers, so the harness drives it
            the way the real screen does: from the list beside it. */}
        <div className="mb-4 flex flex-wrap gap-2">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="rounded-full border border-line px-3 py-1.5 text-[0.8rem] font-semibold text-ink-soft hover:border-ink hover:text-ink cursor-pointer"
            >
              {p.name}
            </button>
          ))}
          {places.length === 0 && <span className="text-[0.8rem] text-muted">ingen steder på dette niveau</span>}
        </div>

        <div className="relative h-[min(62vh,560px)] overflow-hidden rounded-[28px] border border-line bg-[#f7f5ef]">
          <DestinationGlobe
            selectedCountry="Denmark"
            onCountryPick={(c) => setPicked(`country: ${c}`)}
            focus={focus}
          />
        </div>
      </div>
    </div>
  );
}
