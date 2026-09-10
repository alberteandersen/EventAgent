"use client";

/* Harness for the honeymoon cards. The real screen is behind login and its
   content comes from Gemini + Places, so this renders the two cards against
   fixed data — the point being the layout: a honeymoon is chosen on the
   picture, and these used to be search-result strips. */

import { LanguageProvider } from '@/kalas/i18n';
import { DestCard, HotelCard } from '@/kalas/screens/Honeymoon';

const PHOTO =
  'https://cdn.wonder.so/images/019d9110-e1f2-74f3-85e8-c89f82be5a63/9c6724b9dd201927b422364b58caeef1463b9c321cb5eaca024140a917889110.jpg';

const DESTS = [
  { name: 'Santorini', region: 'Kykladerne', kind: 'beach' as const, rating: 4.8, lat: null, lng: null, photo: PHOTO,
    blurb: 'Hvidkalkede huse ned ad kraterranden, og en solnedgang der er værd at planlægge dagen omkring. Kom uden for højsæsonen, så har I stierne for jer selv.' },
  { name: 'Amalfikysten', region: 'Campania', kind: 'nature' as const, rating: 4.6, lat: null, lng: null, photo: null,
    blurb: 'Citronlunde, stejle trapper og en kystvej der er lige så meget attraktion som transport.' },
];

const HOTEL = {
  id: 'h1', name: 'Katikies Santorini', description: null,
  why_fit: 'Hængende over caldeaen med egen pool til hvert værelse — det er stedet, aftenen bliver husket fra.',
  address: 'Oia, Santorini', price_hint: 'fra 4.800 kr/nat', photo: PHOTO, photos: [PHOTO],
  rating: 4.9, review_count: 812, place_id: null,
};

export default function DevHoneymoonPage() {
  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas px-8 py-12 text-ink">
        <p className="eyebrow mb-4">Dev · Destinationer</p>
        <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
          {DESTS.map((d) => (
            <DestCard key={d.name} s={d} active={false} saved={false} onChoose={() => {}} onToggleSave={() => {}} />
          ))}
        </div>

        <p className="eyebrow mb-4 mt-12">Dev · Hotel (feature)</p>
        <div className="max-w-4xl">
          <HotelCard h={HOTEL} feature saved={false} destination="Santorini, Grækenland" lang="da" onToggleSave={() => {}} />
        </div>
      </div>
    </LanguageProvider>
  );
}
