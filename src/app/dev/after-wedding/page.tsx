"use client";

/* Harness for Nygift, the screen for after the wedding, rendered for real
   against an in-memory wedding. It is behind login and reads the album
   bucket, so the album calls are answered here with fixed data instead.

   &tab= picks the tab it opens on (written to sessionStorage, where the
   screen reads it). &empty=1 renders the wedding with nothing thanked or
   uploaded yet.

   Client-only, like KalasRoot at /home: the screens read their tab from
   sessionStorage on first render, which a server render cannot match. */

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Nygift from '@/kalas/screens/Nygift';
import { IMAGES } from '@/kalas/images';
import { FixtureWedding, guest } from '../_fixture/wedding';
import type {
  AlbumPhotoRow, RegistryClaimRow, RegistryItemRow, ThankYouRow, VenueRow,
} from '@/lib/db/types';

const now = new Date().toISOString();

/* ── What the APIs would have said ─────────────────────────────────────── */

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
    if (url.includes('/api/album?')) {
      const photos = empty ? [] : ALBUM_PHOTOS;
      return json({ photos, total: photos.length, hasMore: false });
    }
    if (url.includes('/api/album/')) return json({ ok: true });
    return real(input, init);
  };
}

/* ── The wedding ───────────────────────────────────────────────────────── */

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


function Harness() {
  const params = useSearchParams();
  const empty = params.get('empty') === '1';
  // Written before the screen mounts, since it reads its tab on first render.
  useState(() => {
    patchFetch(empty);
    const tab = params.get('tab');
    if (tab && typeof window !== 'undefined') sessionStorage.setItem('kalas_nygift_tab', tab);
    return null;
  });

  return (
    <FixtureWedding
      guests={empty ? [] : GUESTS}
      venues={empty ? [] : VENDORS}
      thankYous={empty ? [] : THANKS}
      registryItems={empty ? [] : ITEMS}
      registryClaims={empty ? [] : CLAIMS}
      weddingSite={SITE}
      couple={{ dateISO: '2026-09-12', dateLabel: '12. september 2026' }}
      event={{ event_date: '2026-09-12' }}
    >
      <div className="theme-kalas min-h-screen bg-canvas text-ink">
        <Nygift />
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
