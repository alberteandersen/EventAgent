import * as React from 'react';
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { HeartHandshake, Images, Share2, Mail } from 'lucide-react';
import WeddingRings from '../icons/WeddingRings';
import { useWedding } from '../useWedding';
import { Page, PageHeader, Tabs } from '../ui';
import { useLang } from '../i18n';
import type { ScreenId } from '../Shell';
import TakkelisteTab from './nygift/TakkelisteTab';
import TakkekortTab from './nygift/TakkekortTab';
import AlbumTab from './nygift/AlbumTab';
import DelTab from './nygift/DelTab';
import { daysMarried, readNygiftTab, writeNygiftTab, type NygiftTab } from './nygift/shared';
import { buildThankList, thankProgress } from './nygift/thanks';

/* Nygift — the phase after the wedding day. The rest of the app stops at the
   date; this is where the couple thanks people, collects the photos guests
   took, and looks back.

   The menu shows it from a week before an exact date (nygiftInMenu); before
   that it is only reachable when Juno or a link opens it. Each tab carries its
   own empty state. */
export default function Nygift({ onNavigate }: { onNavigate?: (s: ScreenId) => void }) {
  const { t, tn } = useLang();
  const { couple, event, guests, registryClaims, registryItems, thankYous } = useWedding();
  const [tab, setTab] = useState<NygiftTab>(() => readNygiftTab());

  const { done, total } = thankProgress(
    buildThankList(guests, registryClaims, registryItems, thankYous)
  );

  /* Juno or a link can open it before the day, so it cannot assume the day
     has been. Once it has, say how long ago: it is the one number here that is only
     theirs, and it quietly dates the to-do list underneath it. */
  const days = daysMarried(event?.event_date ?? couple.dateISO);
  const married =
    days == null ? null
    : days === 0 ? t('Gift i dag')
    : days === 1 ? t('Gift i går')
    : days < 365 ? t('Gift for {n} dage siden', { n: days })
    : tn(Math.floor(days / 365), 'Gift for et år siden', 'Gift for {n} år siden');

  function selectTab(next: NygiftTab) {
    setTab(next);
    writeNygiftTab(next);
  }


  return (
    <Page>
      <PageHeader
        title={t('Nygift')}
        subtitle={t('Tiden efter dagen, sig tak, saml billederne, og se tilbage på det hele.')}
        actions={married && (
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-wash px-3.5 py-1.5 text-xs font-semibold text-ink">
            <WeddingRings size={14} aria-hidden />
            {married}
          </p>
        )}
      >
        <Tabs
          label={t('Nygift')}
          value={tab}
          onChange={selectTab}
          items={[
            { id: 'takkeliste', label: t('Takkeliste'), icon: HeartHandshake, badge: total - done },
            { id: 'takkekort', label: t('Takkekort'), icon: Mail },
            { id: 'album', label: t('Album'), icon: Images },
            { id: 'del', label: t('Del'), icon: Share2 },
          ]}
        />
      </PageHeader>

      <AnimatePresence mode="wait">
        {tab === 'takkeliste' && <TakkelisteTab key="takkeliste" />}
        {tab === 'takkekort' && <TakkekortTab key="takkekort" />}
        {tab === 'album' && <AlbumTab key="album" onNavigate={onNavigate} />}
        {tab === 'del' && <DelTab key="del" onNavigate={onNavigate} />}
      </AnimatePresence>
    </Page>
  );
}
