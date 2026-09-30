'use client';

/* The Guides screen inside the real app Shell, without a signed-in wedding.
   Query string: ?screen=budget|guides (start page), ?guide=<slug>|faq (a
   pending guide, as a header link leaves it), ?lang=en. Pages other than
   Guides are stand-ins carrying the same header and guide link as the app. */

import { useEffect, useState } from 'react';
import Shell, { NAV, type ScreenId } from '@/kalas/Shell';
import { LanguageProvider, type Lang } from '@/kalas/i18n';
import Guides from '@/kalas/screens/Guides';
import { Page, PageHeader } from '@/kalas/ui';
import { OPEN_GUIDE_EVENT } from '@/kalas/screens/guides/links';
import { FixtureWedding } from '../_fixture/wedding';

export default function Harness() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [screen, setScreen] = useState<ScreenId>(() => {
    const guide = params.get('guide');
    if (guide) sessionStorage.setItem('kalas_guide', guide);
    return (params.get('screen') as ScreenId | null) ?? 'budget';
  });
  const [log, setLog] = useState('');

  // KalasRoot's listener, so a header link switches to Guides as in the app.
  useEffect(() => {
    const onOpen = () => setScreen('guides');
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, []);

  return (
    <LanguageProvider initialLang={(params.get('lang') as Lang | null) ?? 'da'} lock>
      <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
        <FixtureWedding>
        <Shell current={screen} onNavigate={setScreen}>
          {screen === 'guides' ? (
            <Guides onNavigate={(target) => setLog(`navigate: ${target}`)} />
          ) : (
            <Page>
              <PageHeader title={NAV.find((n) => n.id === screen)?.label} subtitle="Stand-in for the page." guide={screen} />
            </Page>
          )}
        </Shell>
        </FixtureWedding>
        {log && (
          <p data-testid="log" className="fixed right-4 bottom-4 z-50 rounded-full bg-ink px-4 py-2 text-xs text-canvas">{log}</p>
        )}
      </div>
    </LanguageProvider>
  );
}
