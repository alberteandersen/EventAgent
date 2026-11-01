"use client";

/* The real Inbox screen against a fixture wedding: two vendors Juno wrote to,
   one of which has answered with a quote and a proposed reply waiting.
     ?empty=1     nobody contacted yet */

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import type { EmailReplyRow, OutboundEmailRow, ReplyProposalRow, VenueRow } from '@/lib/db/types';
import { FixtureWedding } from '../_fixture/wedding';

const Inbox = dynamic(() => import('@/kalas/screens/Inbox'), { ssr: false });

const sent = '2026-09-20T10:00:00.000Z';
const answered = '2026-09-21T14:30:00.000Z';

const vendor = (id: string, name: string, category: string) => ({
  id, event_id: 'dev', user_id: 'dev', name, category, address: 'Fyn', booked_at: null,
  photo_urls: [], reviews: [], image_url: null,
} as unknown as VenueRow);

const MORE = ['Dalum Kloster', 'Broholm Slot', 'Egeskov', 'Fjelsted Skov Kro', 'Tved Kro', 'Hotel Svendborg', 'Falsled Kro', 'Steensgaard'];
const VENUES = [
  vendor('v1', 'Hindsgavl Slot', 'venue'), vendor('v2', 'Blomsterbinderiet', 'florist'),
  ...MORE.map((name, i) => vendor(`m${i}`, name, 'venue')),
];

const outreach = (id: string, venueId: string, status: OutboundEmailRow['status']): OutboundEmailRow => ({
  id, event_id: 'dev', venue_id: venueId, draft_id: null, user_id: 'dev', to_email: 'kontakt@eksempel.dk',
  subject: 'Forespørgsel om bryllup den 11. september 2027',
  body: 'Kære {venue}\n\nVi planlægger vores bryllup for 80 gæster den 11. september 2027. Har I ledigt, og kan I sende os jeres priser?\n\nVenlig hilsen\nJuno, på vegne af parret',
  gmail_message_id: null, gmail_thread_id: null, status, error: null, sent_at: sent, kind: 'outreach',
  in_reply_to_reply_id: null, created_at: sent,
});

const OUTBOUND: OutboundEmailRow[] = [
  outreach('o1', 'v1', 'replied'), outreach('o2', 'v2', 'sent'),
  ...MORE.map((_, i) => outreach(`om${i}`, `m${i}`, 'sent')),
  // An earlier exchange in Hindsgavl's thread, so it runs long enough to scroll.
  { ...outreach('o3', 'v1', 'sent'), kind: 'reply', sent_at: '2026-09-21T09:00:00.000Z', created_at: '2026-09-21T09:00:00.000Z',
    body: 'Kære Hindsgavl Slot\n\nTak for svaret. Kan I fortælle, om vielsen kan holdes i parken, og hvad der sker ved regnvejr?\n\nVenlig hilsen\nJuno' },
];

const earlier: EmailReplyRow = {
  id: 'r0', outbound_email_id: 'o1', venue_id: 'v1', event_id: 'dev', user_id: 'dev', gmail_message_id: 'm0',
  from_email: 'kontakt@eksempel.dk', snippet: null,
  body: 'Kære Juno\n\nTak for jeres henvendelse. Vi vender tilbage med ledighed og priser i morgen.\n\nVenlig hilsen\nHindsgavl Slot',
  received_at: '2026-09-20T16:00:00.000Z', quote: null, quote_status: 'unclear', rfc822_message_id: null,
  read_at: '2026-09-20T17:00:00.000Z', matched_via: 'thread', created_at: '2026-09-20T16:00:00.000Z',
};

const REPLIES: EmailReplyRow[] = [earlier, {
  id: 'r1', outbound_email_id: 'o1', venue_id: 'v1', event_id: 'dev', user_id: 'dev', gmail_message_id: 'm1',
  from_email: 'kontakt@eksempel.dk', snippet: null,
  body: 'Kære Juno\n\nVi har ledigt lørdag den 11. september 2027 og holder datoen i 14 dage. Vores bryllupspakke til 80 gæster koster 155.000 kr. inkl. moms.\n\nVenlig hilsen\nHindsgavl Slot',
  received_at: answered,
  quote: {
    has_quote: true, price_amount: 155000, currency: 'DKK', price_basis: 'total', availability: 'available',
    conditions: 'Depositum på 25 % ved bekræftelse.', summary: 'Ledigt på datoen, 155.000 kr. for 80 gæster.',
  },
  quote_status: 'quoted', rfc822_message_id: null, read_at: null, matched_via: 'thread', created_at: answered,
}];

const PROPOSALS: ReplyProposalRow[] = [{
  id: 'p1', email_reply_id: 'r1', outbound_email_id: 'o1', venue_id: 'v1', event_id: 'dev', user_id: 'dev',
  body: 'Kære Hindsgavl Slot\n\nMange tak for jeres svar. Vi vil meget gerne komme på en fremvisning.\n\nVenlig hilsen\nJuno',
  status: 'proposed', sent_outbound_id: null, created_at: answered,
}];

function Harness() {
  const params = useSearchParams();
  const empty = params.get('empty') === '1';
  const [navigated, setNavigated] = useState<string | null>(null);

  return (
    <FixtureWedding
      venues={empty ? [] : VENUES}
      outbound={empty ? [] : OUTBOUND}
      replies={empty ? [] : REPLIES}
      proposals={empty ? [] : PROPOSALS}
    >
      <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
        {navigated && (
          <p data-testid="navigated" className="px-6 pt-4 text-xs text-muted">→ {navigated}</p>
        )}
        <Inbox onNavigate={(s) => setNavigated(String(s))} />
      </div>
    </FixtureWedding>
  );
}

export default function DevInboxPage() {
  return (
    <LanguageProvider initialLang="da">
      <Suspense><Harness /></Suspense>
    </LanguageProvider>
  );
}
