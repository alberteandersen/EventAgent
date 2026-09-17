'use client';

import { BookOpen } from 'lucide-react';
import type { ScreenId } from '../../Shell';
import { useLang } from '../../i18n';
import { SCREEN_GUIDE, openGuide } from './links';

/** "Guide: …" under a page's heading, opening the guide for that page. */
export function GuideLink({ screen, className = '' }: { screen: ScreenId; className?: string }) {
  const { t } = useLang();
  const link = SCREEN_GUIDE[screen];
  if (!link) return null;
  return (
    <button
      type="button"
      onClick={() => openGuide(link.slug)}
      className={`group mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#5f7d70] transition-colors hover:text-[#24413a] ${className}`}
    >
      <BookOpen size={14} strokeWidth={2} aria-hidden />
      <span>
        {t('Guide')}: <span className="underline decoration-[#7d938a]/40 underline-offset-4 group-hover:decoration-[#24413a]">{link.title}</span>
      </span>
    </button>
  );
}
