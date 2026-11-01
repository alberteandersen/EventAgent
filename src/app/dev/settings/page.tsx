'use client';

/* Settings as a couple sees it, without a session: the same screen the
   server page renders, fed fixture props. ?admin=1 adds the mailbox card,
   ?lang=en the English copy. */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

function Harness() {
  const params = useSearchParams();
  return (
    <SettingsScreen
      lang={params.get('lang') === 'en' ? 'en' : 'da'}
      email="emma@eksempel.dk"
      notifications
      wedding={{
        eventId: 'dev', name: 'Emma', partner: 'Frederik', eventDate: '2027-09-11', datePrecision: 'exact',
        dateHint: null, location: 'Fyn', guestCount: 80, budget: '225000',
      }}
      members={[{ name: 'Emma', you: true }]}
      pendingEmail="frederik@eksempel.dk"
      platform={params.get('admin') === '1' ? { connected: true, email: 'juno@kalas-weddings.com' } : null}
      flash={{}}
    />
  );
}

export default function DevSettingsPage() {
  return <Suspense><Harness /></Suspense>;
}
