"use client";

import { MessageSquare } from 'lucide-react';
import type { ChatThreadRow } from '@/lib/db/types';
import { cn } from '../ui';
import { useLang, type Lang } from '../i18n';

/** "14:05" today, "i går", then "12. sep.", with the year once it is not this one. */
export function threadWhen(iso: string, lang: Lang, now = new Date()): { key: 'today' | 'yesterday' | 'date'; text: string } {
  const d = new Date(iso);
  const locale = lang === 'en' ? 'en-GB' : 'da-DK';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return { key: 'today', text: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) };
  if (diff === 1) return { key: 'yesterday', text: '' };
  return {
    key: 'date',
    text: d.toLocaleDateString(locale, {
      day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    }),
  };
}

export default function ThreadList({
  threads,
  loading,
  activeId,
  onOpen,
}: {
  threads: ChatThreadRow[];
  loading: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const { t, lang } = useLang();

  if (!loading && threads.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-[0.85rem] text-muted">
        {t('Ingen samtaler endnu. Skriv til Juno, så dukker de op her.')}
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 py-2">
      {threads.map((th) => {
        const when = threadWhen(th.updated_at, lang);
        const active = th.id === activeId;
        return (
          <li key={th.id}>
            <button
              type="button"
              onClick={() => onOpen(th.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer',
                active ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.04]',
              )}
            >
              <MessageSquare size={15} strokeWidth={1.6} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink">
                {th.title || t('Samtale uden titel')}
              </span>
              <span className="shrink-0 text-[0.72rem] tabular-nums text-muted">
                {when.key === 'yesterday' ? t('i går') : when.text}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
