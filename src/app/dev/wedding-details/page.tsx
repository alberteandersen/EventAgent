"use client";

/* Harness for the Settings "Bryllupet" section. The real page needs a signed-in
   couple with an event; the section itself takes plain props. Saving from here
   calls the real routes and fails without a session, which shows the error. */

import { WeddingDetailsSetting } from '@/components/settings/WeddingDetailsSetting';

export default function DevWeddingDetailsPage() {
  return (
    <main className="theme-kalas min-h-screen w-full bg-canvas font-sans text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <WeddingDetailsSetting
          lang="da"
          initial={{
            eventId: 'dev', name: 'Emma Holm', partner: 'Frederik', eventDate: '2027-09-11',
            datePrecision: 'exact', dateHint: null, location: 'Svendborg', guestCount: 80, budget: '225000',
          }}
        />
      </div>
    </main>
  );
}
