'use client';

import { BookOpen } from 'lucide-react';
import type { ScreenId } from '../../Shell';
import { useLang } from '../../i18n';
import { SCREEN_GUIDE, guideHref } from './links';

/** "Guide: …" under a page's heading, opening that page's guide on the website. */
export function GuideLink({ screen, className = '' }: { screen: ScreenId; className?: string }) {
  const { t } = useLang();
  const link = SCREEN_GUIDE[screen];
  if (!link) return null;
  return (
    <a
      href={guideHref(link.slug)}
      target="_blank"
      rel="noopener"
      className={`group mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-sage-strong transition-colors hover:text-ink ${className}`}
    >
      <BookOpen size={14} strokeWidth={2} aria-hidden />
      <span>
        {t('Guide')}: <span className="underline decoration-sage/40 underline-offset-4 group-hover:decoration-ink">{link.title}</span>
      </span>
    </a>
  );
}
