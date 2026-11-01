"use client";

/* The real Invitationer screen against a fixture wedding. ?vibe=akvarel starts
   with that vibe picked (its sample painting), and &format=7x5 on the
   landscape card; without a vibe it opens on the vibe gallery. Juno's build and the saves need a signed-in wedding, so
   this is for the look of the builder, not its round trips. */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import Invites from '@/kalas/screens/Invites';
import { FixtureWedding } from '../_fixture/wedding';
import { CARD_VIBES, starterSpec } from '@/kalas/invitations/card/vibes';
import { findFormat } from '@/kalas/invitations/card/formats';
import type { InvitationDesignRow } from '@/lib/db/types';

function Screen() {
  const params = useSearchParams();
  const vibe = CARD_VIBES.find((v) => v.id === params.get('vibe'));
  const designs: InvitationDesignRow[] = vibe ? [{
    id: 'dev-card', event_id: 'dev', user_id: 'dev', active: true, html: null,
    created_at: new Date().toISOString(),
    brief: { vibe: vibe.id, mode: 'card' },
    design: starterSpec(vibe, findFormat(params.get('format')), 'da') as unknown as Record<string, unknown>,
  }] : [];
  return (
    <FixtureWedding
      couple={{ a: 'Samira', b: 'Rufus', dateISO: '2027-06-12' }}
      invitationDesigns={designs}
    >
      <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
        <Invites />
      </div>
    </FixtureWedding>
  );
}

export default function DevInvitesPage() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense>
        <Screen />
      </Suspense>
    </LanguageProvider>
  );
}
