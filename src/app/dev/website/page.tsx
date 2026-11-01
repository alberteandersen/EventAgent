"use client";

/* The real Hjemmeside screen against a fixture wedding: a chosen venue and a
   Bryllupsdagen to fill the content from, and a new site (no saved config),
   so the builder starts where a couple would. `?built=1` adds a built site
   with text slots and opens on Design: rewording under Indhold shows in its
   preview at once, and three versions sit under it to look at and switch
   between. `&stale=1` makes the live build's shape older than the content,
   which puts the "Juno needs to add this" notice up. The button in the
   corner writes to the saved site the way Juno in the chat does. */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Website from '@/kalas/screens/Website';
import { useWedding } from '@/kalas/useWedding';
import { findPreset } from '@/kalas/site/presets';
import { builderStart } from '@/kalas/site/builderStart';
import { parseConfig } from '@/kalas/site/config';
import { buildStamp } from '@/lib/website/slots';
import { FixtureWedding } from '../_fixture/wedding';
import type { DayProgramItemRow, VenueRow, WebsiteDesignRow } from '@/lib/db/types';

const now = new Date().toISOString();

const VENUE = {
  id: 'v1', event_id: 'dev', user_id: 'dev', name: 'Hindsgavl Slot', address: 'Hindsgavl Allé 7, 5500 Middelfart',
  photo_urls: [], image_url: null,
} as unknown as VenueRow;

const DAY: DayProgramItemRow[] = [
  ['15:00', 'Vielse', 'Slotskapellet'],
  ['14:15', 'Gæsterne ankommer', 'Gårdspladsen'],
  ['16:00', 'Champagne i haven', null],
  ['18:30', 'Middag', 'Riddersalen'],
  ['22:00', 'Første dans', null],
].map(([time, title, subtitle], i) => ({
  id: `d${i}`, event_id: 'dev', user_id: 'dev', time: time as string, title: title as string,
  subtitle: subtitle as string | null, duration_min: 0, owner: null, notes: null, sort: i, created_at: now,
}));

/** A built site's markup in one of two looks, with every text in its slot. */
function siteHtml(dark: boolean, program: { id: string; time: string; label: string; sublabel: string }[]): string {
  const [bg, fg] = dark ? ['#1f2a27', '#eef1ec'] : ['#f6efe6', '#2b2622'];
  const rows = program.map((p) =>
    `<li><time data-kalas="text:program:${p.id}:time">${p.time}</time> <span data-kalas="text:program:${p.id}:label">${p.label}</span> <small data-kalas="text:program:${p.id}:sublabel">${p.sublabel}</small></li>`).join('');
  return `<style>#kalas-site{background:${bg};color:${fg}}#kalas-site .s{padding:64px 48px;font-family:Georgia,serif;text-align:center}#kalas-site h1{font-size:64px;margin:0}#kalas-site .story{white-space:pre-line;max-width:34em;margin:0 auto}#kalas-site ol{list-style:none;padding:0;line-height:2}</style>`
    + '<section class="s"><h1>Emma &amp; Frederik</h1><p>11. september 2027</p><p data-kalas="text:heroTagline">Kom og fejr dagen med os</p></section>'
    + '<section class="s"><h2>Vores historie</h2><p class="story" data-kalas="text:storyText"></p></section>'
    + `<section class="s"><h2>Program</h2><ol>${rows}</ol></section>`;
}

/** Newest first, as the app loads them: new words, a change, the first build. */
function built(stale: boolean): WebsiteDesignRow[] {
  const tokens = (findPreset('nordisk')?.design ?? {}) as unknown as Record<string, unknown>;
  // Stamped with the content the builder starts from, as a real build is.
  const start = builderStart({ site: null, venue: VENUE, dayProgram: DAY });
  const stamp = buildStamp(parseConfig(start as unknown as Record<string, unknown>));
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const row = (id: string, h: number, dark: boolean, brief: Record<string, unknown>, active = false): WebsiteDesignRow => ({
    id, event_id: 'dev', user_id: 'dev', active, created_at: at(h), design: tokens, html: siteHtml(dark, start.program),
    brief: { preset: 'nordisk', mode: 'html', imageAliases: {}, ...stamp, ...brief },
  });
  return [
    row('d-text', 1, true, { contentSync: true, ...(stale ? { structureKey: 'older' } : {}) }, true),
    row('d-dark', 5, true, { instruction: 'Mørkere og mere stemningsfuld' }),
    row('d-first', 26, false, { styleDirection: 'Varme farver, store billeder af os' }),
  ];
}

/* Stands in for Juno in the chat: writes new words to the saved site, the
   way update_website_content does, while the builder is open. */
function ChatStandIn() {
  const { weddingSite, saveSite } = useWedding();
  return (
    <button type="button"
      onClick={() => void saveSite({ config: { ...(weddingSite?.config ?? {}), storyText: 'Skrevet af Juno i chatten.' } })}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-line bg-card px-4 py-2 text-[0.75rem] shadow cursor-pointer">
      Simulér Juno i chatten
    </button>
  );
}

function Screen() {
  const params = useSearchParams();
  const isBuilt = Boolean(params.get('built'));
  const [designs, setDesigns] = useState<WebsiteDesignRow[]>(() => (isBuilt ? built(Boolean(params.get('stale'))) : []));

  // The screen switches versions through the API; here that is local state.
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).includes('/api/website/design/activate')) {
        const { designId } = JSON.parse(String(init?.body ?? '{}')) as { designId?: string };
        setDesigns((rows) => rows.map((r) => ({ ...r, active: r.id === designId })));
        return new Response('{"ok":true}', { status: 200 });
      }
      return real(input, init);
    };
    return () => { window.fetch = real; };
  }, []);

  return (
    <FixtureWedding
      event={{ chosen_venue_id: 'v1' }}
      venues={[VENUE]}
      dayProgram={DAY}
      websiteDesigns={designs}
    >
      <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
        <Website />
        <ChatStandIn />
      </div>
    </FixtureWedding>
  );
}

export default function DevWebsitePage() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense><Screen /></Suspense>
    </LanguageProvider>
  );
}
