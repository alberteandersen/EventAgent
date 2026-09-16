"use client";

/* The public guest hub against a fixture config. Its lookups call the real
   routes, which answer 404 for a site that does not exist; the layout is what
   this page is for. */

import { LanguageProvider } from '@/kalas/i18n';
import { GuestHub } from '@/app/w/[slug]/GuestHub';
import { parseConfig, INIT_SECTIONS } from '@/kalas/site/config';
import { QrBlock } from '@/kalas/screens/website/HubPanels';

const config = parseConfig({
  sections: INIT_SECTIONS.map((s) => (['contact', 'seat', 'guestbook'].includes(s.id) ? { ...s, enabled: true } : s)),
  contact: { name: 'Mads Holm', role: 'Toastmaster', phone: '+45 20 11 22 33', email: 'mads@eksempel.dk' },
});

export default function DevGuestHubPage() {
  return (
    <LanguageProvider initialLang="da" lock>
      <div className="theme-kalas min-h-screen bg-canvas">
        <GuestHub slug="dev-site" config={config} rsvpToken={null} />
        {/* The builder's QR block, which needs no wedding to draw. */}
        <div className="flex justify-center pb-10">
          <QrBlock url="http://localhost:3000/w/dev-site/del" caption="Del jeres billeder med os" />
        </div>
      </div>
    </LanguageProvider>
  );
}
