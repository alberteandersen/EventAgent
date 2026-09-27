"use client";

/* Harness for the two screens that come after the planning: Bryllupsrejse and
   Nygift, rendered for real against an in-memory wedding. Both are behind
   login and fetch from Gemini, Places and the album bucket, so the API calls
   they make are answered here with fixed data instead.

   ?screen=honeymoon|nygift picks the screen and &tab= the tab it opens on
   (written to sessionStorage, where the screens read it). &empty=1 renders
   the wedding with nothing saved, thanked or uploaded yet.

   Client-only, like KalasRoot at /home: the screens read their tab from
   sessionStorage on first render, which a server render cannot match. */

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Honeymoon from '@/kalas/screens/Honeymoon';
import Nygift from '@/kalas/screens/Nygift';
import { IMAGES } from '@/kalas/data';
import { FixtureWedding, guest } from '../_fixture/wedding';
import type {
  AlbumPhotoRow, HoneymoonSaveRow, RegistryClaimRow, RegistryItemRow, ThankYouRow, VenueRow,
} from '@/lib/db/types';

const PHOTO =
  'https://cdn.wonder.so/images/019d9110-e1f2-74f3-85e8-c89f82be5a63/9c6724b9dd201927b422364b58caeef1463b9c321cb5eaca024140a917889110.jpg';
const now = new Date().toISOString();

/* ── What the APIs would have said ─────────────────────────────────────── */

const DESTINATIONS = {
  suggestions: [
    { name: 'Santorini', region: 'Kykladerne', kind: 'beach', rating: 4.8, lat: null, lng: null, photo: PHOTO,
      blurb: 'Hvidkalkede huse ned ad kraterranden, og en solnedgang der er værd at planlægge dagen omkring.' },
    { name: 'Milos', region: 'Kykladerne', kind: 'nature', rating: 4.7, lat: null, lng: null, photo: IMAGES.olive,
      blurb: 'Stille bugter og månelandskab, uden krydstogtskibene.' },
    { name: 'Athen', region: 'Attika', kind: 'city', rating: 4.5, lat: null, lng: null, photo: IMAGES.candles,
      blurb: 'Tagterrasser med udsigt til Akropolis, og aftensmad der starter klokken ti.' },
    { name: 'Kreta', region: null, kind: 'adventure', rating: 4.6, lat: null, lng: null, photo: null,
      blurb: 'Kløfter at vandre i om formiddagen og strande om eftermiddagen.' },
  ],
};

const hotel = (i: number, name: string, photo: string | null, price: string) => ({
  id: `h${i}`, name, description: null, address: 'Oia, Santorini', price_hint: price, photo,
  photos: photo ? [photo, IMAGES.florals, IMAGES.candles] : [], rating: 4.9 - i / 10, review_count: 400, place_id: `p${i}`,
  why_fit: 'Hængende over calderaen med egen pool til hvert værelse, det er stedet aftenen bliver husket fra.',
});

const HOTELS = {
  hotels: [
    hotel(1, 'Katikies Santorini', PHOTO, 'fra 4.800 kr/nat'),
    hotel(2, 'Canaves Oia Epitome', IMAGES.orangeri, 'fra 6.200 kr/nat'),
    hotel(3, 'Grace Hotel', IMAGES.olive, 'fra 3.900 kr/nat'),
    hotel(4, 'Andronis Luxury Suites', null, 'fra 5.100 kr/nat'),
  ],
};

const INSPIRATION = {
  themes: [
    { id: 'beach', title: 'Strand', blurb: 'Hvidt sand og ingen planer', photo: PHOTO },
    { id: 'adventure', title: 'Eventyr', blurb: 'Vandreture, safari og nattehimmel', photo: IMAGES.barn },
    { id: 'minimoon', title: 'Minimoon', blurb: 'Fire dage, tæt på, lige efter festen', photo: IMAGES.lavender },
  ],
  spotlights: [
    { name: 'Amalfikysten', country: 'Italien', blurb: 'Citronlunde og en kystvej, der er en oplevelse i sig selv.', photo: IMAGES.olive, rating: 4.7 },
    { name: 'Kyoto', country: 'Japan', blurb: 'Templer om morgenen, ryokan og varme kilder om aftenen.', photo: IMAGES.candles, rating: 4.8 },
  ],
  ideas: [
    { kind: 'route', title: 'Øhop i Kykladerne', location: 'Grækenland', blurb: 'Naxos, Paros og Milos med færge, tre nætter hvert sted.', photo: PHOTO },
    { kind: 'hotel', title: 'Ryokan med privat onsen', location: 'Hakone, Japan', blurb: 'Kimono til middag, og bad under åben himmel.', photo: IMAGES.candles },
    { kind: 'trip', title: 'Roadtrip gennem Toscana', location: null, blurb: 'Vinmarker, cypresalléer og et nyt agriturismo hver aften.', photo: null },
  ],
};

const ALBUM_PHOTOS = [IMAGES.ceremony, IMAGES.portrait, IMAGES.rings, IMAGES.cake, IMAGES.longTable, IMAGES.florals, IMAGES.arch]
  .map((url, i): AlbumPhotoRow & { url: string } => ({
    id: `a${i}`, event_id: 'dev', user_id: 'dev', storage_path: `dev/${i}.jpg`,
    uploader_name: ['Mette', 'Jonas', 'Farmor', null, 'Sofie', 'Anders', 'Mette'][i], guest_id: null, caption: null,
    status: 'approved' as AlbumPhotoRow['status'], favorite: i === 1 || i === 4, bytes: null, width: null, height: null,
    uploader_hash: null, created_at: now, url,
  } as AlbumPhotoRow & { url: string }));

let fetchPatched = false;
/** Answers the screens' API calls from the fixtures above; the rest pass through. */
function patchFetch(empty: boolean) {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const real = window.fetch.bind(window);
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  }));
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/honeymoon/destinations')) return json(DESTINATIONS);
    if (url.includes('/api/honeymoon/hotels')) return json(HOTELS);
    if (url.includes('/api/honeymoon/inspiration')) return json(INSPIRATION);
    if (url.includes('/api/album?')) {
      const photos = empty ? [] : ALBUM_PHOTOS;
      return json({ photos, total: photos.length, hasMore: false });
    }
    if (url.includes('/api/album/')) return json({ ok: true });
    return real(input, init);
  };
}

/* ── The wedding ───────────────────────────────────────────────────────── */

const save = (patch: Partial<HoneymoonSaveRow> & Pick<HoneymoonSaveRow, 'id' | 'kind' | 'name'>): HoneymoonSaveRow => ({
  event_id: 'dev', user_id: 'dev', location: null, blurb: null, image_url: null, place_id: null,
  rating: null, meta: {}, created_at: now, ...patch,
});

const SAVES: HoneymoonSaveRow[] = [
  save({ id: 's1', kind: 'hotel', name: 'Katikies Santorini', location: 'Oia, Santorini', image_url: PHOTO, rating: 4.9,
    blurb: 'Egen pool til hvert værelse, over calderaen.', place_id: 'p1', meta: { booked: true, price_hint: 'fra 4.800 kr/nat' } }),
  save({ id: 's2', kind: 'destination', name: 'Santorini', location: 'Kykladerne, Grækenland', image_url: IMAGES.olive, rating: 4.8,
    blurb: 'Hvidkalkede huse ned ad kraterranden.', meta: { booked: true } }),
  save({ id: 's3', kind: 'destination', name: 'Amalfikysten', location: 'Italien', image_url: IMAGES.lavender, rating: 4.7,
    blurb: 'Citronlunde og en kystvej, der er en oplevelse i sig selv.' }),
  save({ id: 's4', kind: 'hotel', name: 'Grace Hotel', location: 'Imerovigli, Santorini', image_url: IMAGES.orangeri, rating: 4.8,
    blurb: 'Den stille nabo til Oia, med den samme udsigt.', place_id: 'p3' }),
  save({ id: 's5', kind: 'idea', name: 'Øhop i Kykladerne', location: 'Grækenland', image_url: null,
    blurb: 'Naxos, Paros og Milos med færge, tre nætter hvert sted.', meta: { idea_kind: 'route' } }),
];

const GUESTS = [
  guest('Mette Holm', { email: 'mette@eksempel.dk' }),
  guest('Jonas Krag'),
  guest('Sofie Lund'),
  guest('Anders Bech', { email: 'anders@eksempel.dk' }),
  guest('Farmor Inge'),
  guest('Nour El-Sayed', { rsvp: 'nej' }),
  guest('Karen Møller'),
  guest('Peter Møller'),
];

const ITEMS: RegistryItemRow[] = [
  { id: 'r1', event_id: 'dev', user_id: 'dev', title: 'Stelton kande', description: null, image_url: null, product_url: null,
    store_name: null, price_cents: 50000, currency: 'DKK', quantity: 2, sort: 0, created_at: now },
  { id: 'r2', event_id: 'dev', user_id: 'dev', title: 'Bidrag til bryllupsrejsen', description: null, image_url: null,
    product_url: null, store_name: null, price_cents: null, currency: 'DKK', quantity: 10, sort: 1, created_at: now },
];

const claim = (id: string, item_id: string, guest_name: string, message: string | null): RegistryClaimRow => ({
  id, item_id, event_id: 'dev', user_id: 'dev', guest_name, guest_email: null, message, quantity: 1, created_at: now,
});

const CLAIMS = [
  claim('c1', 'r1', 'Mette Holm', 'Til morgenkaffen på terrassen. Knus!'),
  claim('c2', 'r2', 'Nour El-Sayed', 'Ærgerligt vi ikke kunne komme. God tur!'),
  claim('c3', 'r2', 'Onkel Bent', null),
];

const THANKS: ThankYouRow[] = [
  { id: 't1', event_id: 'dev', user_id: 'dev', subject_key: `guest:${GUESTS[1].id}`, label: 'Jonas Krag', gift: null,
    thanked_at: now, method: 'besked', note: null, created_at: now },
  { id: 't2', event_id: 'dev', user_id: 'dev', subject_key: `guest:${GUESTS[4].id}`, label: 'Farmor Inge', gift: null,
    thanked_at: now, method: 'ringet', note: null, created_at: now },
];

const vendor = (id: string, name: string, category: string, patch: Partial<VenueRow> = {}) => ({
  id, event_id: 'dev', user_id: 'dev', name, category, address: 'Fyn', booked_at: now,
  own_rating: null, own_review: null, own_recommend: null, ...patch,
} as unknown as VenueRow);

const VENDORS = [
  vendor('v1', 'Broholm Slot', 'venue', { own_rating: 5, own_recommend: true }),
  vendor('v2', 'Lys & Linse Foto', 'photographer'),
  vendor('v3', 'Blomsterhuset', 'florist'),
];

const SITE = {
  id: 'site', event_id: 'dev', user_id: 'dev', domain: 'emma-frederik', published: true,
  config: { albumOpen: true, recap: { headline: '', message: '' } }, updated_at: now,
};

const TAB_KEYS = { honeymoon: 'kalas_honeymoon_tab', nygift: 'kalas_nygift_tab' } as const;

function Harness() {
  const params = useSearchParams();
  const screen = params.get('screen') === 'nygift' ? 'nygift' : 'honeymoon';
  const empty = params.get('empty') === '1';
  // Written before the screen mounts, since it reads its tab on first render.
  useState(() => {
    patchFetch(empty);
    const tab = params.get('tab');
    if (tab && typeof window !== 'undefined') sessionStorage.setItem(TAB_KEYS[screen], tab);
    return null;
  });

  return (
    <FixtureWedding
      guests={empty ? [] : GUESTS}
      venues={empty ? [] : VENDORS}
      honeymoonSaves={empty ? [] : SAVES}
      thankYous={empty ? [] : THANKS}
      registryItems={empty ? [] : ITEMS}
      registryClaims={empty ? [] : CLAIMS}
      weddingSite={SITE}
      couple={{ dateISO: '2026-09-12', dateLabel: '12. september 2026' }}
      event={{ event_date: '2026-09-12' }}
    >
      <div className="theme-kalas min-h-screen bg-canvas text-ink">
        {screen === 'honeymoon' ? <Honeymoon /> : <Nygift />}
      </div>
    </FixtureWedding>
  );
}

function Page() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense>
        <Harness />
      </Suspense>
    </LanguageProvider>
  );
}

export default dynamic(() => Promise.resolve(Page), { ssr: false });
