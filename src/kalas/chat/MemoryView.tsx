"use client";

/* What Ava keeps about the couple between conversations, where they can see
   it and take things out. She writes these herself with her remember tool;
   this view only reads and deletes. */

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MEMORY_CATEGORIES, type AvaMemoryRow, type MemoryCategory } from '@/lib/db/types';
import { useLang } from '../i18n';

const HEADINGS: Record<MemoryCategory, string> = {
  preference: 'Ønsker og smag',
  decision: 'Beslutninger',
  fact: 'Godt at vide',
  followup: 'Skal følges op',
};

export default function MemoryView({ eventId }: { eventId: string }) {
  const { t } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [memories, setMemories] = useState<AvaMemoryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('ava_memories')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setMemories((data ?? []) as AvaMemoryRow[]); });
    return () => { cancelled = true; };
  }, [supabase, eventId]);

  const remove = async (id: string) => {
    const before = memories;
    setMemories((m) => m?.filter((x) => x.id !== id) ?? m);
    const { error } = await supabase.from('ava_memories').delete().eq('id', id);
    if (error) setMemories(before);
  };

  if (memories === null) return null;

  if (memories.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-[0.85rem] leading-relaxed text-muted">
        {t('Ava har ikke gemt noget endnu. Når I fortæller om jeres ønsker og beslutninger, husker hun dem her, også i nye samtaler.')}
      </p>
    );
  }

  return (
    <div className="space-y-5 py-3">
      <p className="px-1 text-[0.8rem] leading-relaxed text-muted">
        {t('Det her ved Ava om jer i alle samtaler. Fjern det, der ikke passer længere.')}
      </p>
      {MEMORY_CATEGORIES.map((c) => {
        const rows = memories.filter((m) => m.category === c);
        if (rows.length === 0) return null;
        return (
          <section key={c}>
            <h3 className="px-1 pb-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {t(HEADINGS[c])}
            </h3>
            <ul className="divide-y divide-line-soft rounded-xl border border-line-soft bg-card">
              {rows.map((m) => (
                <li key={m.id} className="group flex items-start gap-2 py-2.5 pl-3 pr-1.5">
                  <span className="min-w-0 flex-1 text-[0.86rem] leading-snug text-ink">{m.content}</span>
                  <button
                    type="button"
                    onClick={() => void remove(m.id)}
                    aria-label={t('Glem')}
                    title={t('Glem')}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted opacity-60 transition-[opacity,background-color] hover:bg-ink/[0.05] hover:text-ink hover:opacity-100 group-hover:opacity-100 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
