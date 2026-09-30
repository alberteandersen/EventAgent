"use client";

import {
  Lock, Building2, BedDouble, Camera, Video, Flower2,
  UtensilsCrossed, Martini, Cake, Music, Scissors, type LucideIcon,
} from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import { HUB_CATS, type HubCat } from './shared';

const CAT_ICONS: Record<HubCat, LucideIcon> = {
  venue: Building2,
  overnatning: BedDouble,
  fotografi: Camera,
  video: Video,
  blomster: Flower2,
  catering: UtensilsCrossed,
  bar: Martini,
  kage: Cake,
  musik: Music,
  beauty: Scissors,
};

export default function CategoryFilterBar({
  cat,
  onCatChange,
  vendorsLocked = false,
}: {
  cat: HubCat;
  onCatChange: (cat: HubCat) => void;
  vendorsLocked?: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
      {HUB_CATS.map((c) => {
        const active = cat === c.id;
        const locked = vendorsLocked && c.id !== 'venue';
        const Icon = CAT_ICONS[c.id];
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onCatChange(c.id)}
            aria-pressed={active}
            title={locked ? t('Vælg jeres lokation først') : undefined}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
              active
                ? 'bg-[var(--color-sage-tint)] text-ink border-[0.5px] border-[var(--color-sage-strong)] pl-3 pr-2.5'
                : 'border border-line-soft bg-paper text-muted hover:text-ink hover:bg-shell px-3',
              locked && !active && 'opacity-70',
            )}
          >
            {locked
              ? <Lock size={13} className="shrink-0 opacity-70" aria-hidden />
              : <Icon size={14} className="shrink-0" aria-hidden />}
            {t(c.label)}
            {active && <span className="h-1 w-1 rounded-full bg-ink" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
