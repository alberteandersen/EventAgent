"use client";

import { motion } from 'motion/react';
import { Globe as GlobeIcon, Heart, CalendarCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { HUB_TABS, type HubTab } from './shared';

const TAB_ICON: Record<HubTab, LucideIcon> = {
  explore: GlobeIcon,
  shortlist: Heart,
  booked: CalendarCheck,
};

export default function HubTabBar({
  tab,
  badges,
  onChange,
}: {
  tab: HubTab;
  badges: Partial<Record<HubTab, number>>;
  onChange: (tab: HubTab) => void;
}) {
  const { t } = useLang();

  const labels: Record<HubTab, string> = {
    explore: t('Explore'),
    shortlist: t('Favoritter'),
    booked: t('Booked'),
  };

  return (
    <div className="flex gap-1 overflow-x-auto hide-scrollbar border-b border-line-soft">
      {HUB_TABS.map(({ id }) => {
        const active = tab === id;
        const count = badges[id];
        const Icon = TAB_ICON[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[0.82rem] font-semibold transition-colors cursor-pointer',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            <Icon size={15} strokeWidth={2} />
            {labels[id]}
            {count ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sage-wash px-1 text-[0.6rem] font-bold text-ink">
                {count}
              </span>
            ) : null}
            {active && (
              <motion.span
                layoutId="hub-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
