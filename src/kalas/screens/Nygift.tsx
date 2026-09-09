import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartHandshake, Images, Star, Share2, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWedding } from '../useWedding';
import { cn } from '../ui';
import { useLang } from '../i18n';
import type { ScreenId } from '../Shell';
import TakkelisteTab from './nygift/TakkelisteTab';
import TakkekortTab from './nygift/TakkekortTab';
import AlbumTab from './nygift/AlbumTab';
import AnmeldelserTab from './nygift/AnmeldelserTab';
import DelTab from './nygift/DelTab';
import { readNygiftTab, writeNygiftTab, type NygiftTab } from './nygift/shared';
import { buildThankList, thankProgress } from './nygift/thanks';

/* Nygift — the phase after the wedding day. The rest of the app stops at the
   date; this is where the couple thanks people, collects the photos guests
   took, and looks back.

   Deliberately always visible: events.event_date is nullable and date_hint is
   free text, so a nav item conditional on "the wedding has happened" would be
   wrong for a large share of couples. Each tab carries its own empty state. */
export default function Nygift({ onNavigate }: { onNavigate?: (s: ScreenId) => void }) {
  const { t } = useLang();
  const { guests, registryClaims, registryItems, thankYous } = useWedding();
  const [tab, setTab] = useState<NygiftTab>(() => readNygiftTab());

  const { done, total } = thankProgress(
    buildThankList(guests, registryClaims, registryItems, thankYous)
  );

  function selectTab(next: NygiftTab) {
    setTab(next);
    writeNygiftTab(next);
  }

  const TABS: { id: NygiftTab; label: string; Icon: LucideIcon; open: number }[] = [
    { id: 'takkeliste', label: 'Takkeliste', Icon: HeartHandshake, open: total - done },
    { id: 'takkekort', label: 'Takkekort', Icon: Mail, open: 0 },
    { id: 'album', label: 'Album', Icon: Images, open: 0 },
    { id: 'anmeldelser', label: 'Anmeldelser', Icon: Star, open: 0 },
    { id: 'del', label: 'Del', Icon: Share2, open: 0 },
  ];

  return (
    <div className="flex min-h-full flex-col gap-6 bg-[#f4f5f3] px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d938a]">{t('Planlægning')}</p>
        <h1 className="mt-1 font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-[#24413a]">
          {t('Nygift')}
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#5f6b66]">
          {t('Tiden efter dagen, sig tak, saml billederne, og se tilbage på det hele.')}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#e2e6e2]">
        {TABS.map(({ id, label, Icon, open }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[0.82rem] font-semibold transition-colors cursor-pointer',
                active ? 'text-[#24413a]' : 'text-muted hover:text-ink',
              )}
            >
              <Icon size={15} strokeWidth={2} />
              {t(label)}
              {open > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8f0ec] px-1 text-[0.6rem] font-bold text-[#24413a]">
                  {open}
                </span>
              )}
              {active && (
                <motion.span layoutId="nygift-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#24413a]" />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'takkeliste' && <TakkelisteTab key="takkeliste" />}
        {tab === 'takkekort' && <TakkekortTab key="takkekort" />}
        {tab === 'album' && <AlbumTab key="album" onNavigate={onNavigate} />}
        {tab === 'anmeldelser' && <AnmeldelserTab key="anmeldelser" />}
        {tab === 'del' && <DelTab key="del" onNavigate={onNavigate} />}
      </AnimatePresence>
    </div>
  );
}
