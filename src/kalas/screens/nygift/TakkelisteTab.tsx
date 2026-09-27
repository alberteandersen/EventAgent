import * as React from 'react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Plus, Gift, Mail, ChevronDown, Quote } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { cn, TaskCheckbox, taskRowTone, doneLabelClass } from '../../ui';
import { useLang } from '../../i18n';
import {
  buildThankList, thankProgress, subjectKey, THANK_METHODS, methodLabel,
  type ThankEntry,
} from './thanks';
import type { ThankMethod } from '@/lib/db/types';

type Filter = 'alle' | 'mangler' | 'takket';

const FILTER_LABELS: Record<Filter, string> = {
  alle: 'Alle',
  mangler: 'Mangler',
  takket: 'Takket',
};

export default function TakkelisteTab() {
  const { t } = useLang();
  const { guests, registryClaims, registryItems, thankYous, saveThankYou } = useWedding();
  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  const entries = buildThankList(guests, registryClaims, registryItems, thankYous);
  const { done, total } = thankProgress(entries);

  const counts: Record<Filter, number> = {
    alle: total,
    mangler: total - done,
    takket: done,
  };

  const q = query.trim().toLowerCase();
  const visible = entries.filter((e) => {
    if (filter === 'mangler' && e.thankedAt) return false;
    if (filter === 'takket' && !e.thankedAt) return false;
    if (q && !e.name.toLowerCase().includes(q) && !(e.gift ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
  /* The list is already sorted outstanding-first. Under "Alle" the line
     between the two is drawn, so the done ones read as done rather than as
     the bottom of a long list. */
  const groups = [
    { id: 'mangler', label: 'Mangler en tak', rows: visible.filter((e) => !e.thankedAt) },
    { id: 'takket', label: 'Takket', rows: visible.filter((e) => e.thankedAt) },
  ].filter((g) => g.rows.length > 0);

  function toggle(entry: ThankEntry) {
    void saveThankYou(entry.key, {
      label: entry.name,
      gift: entry.gift,
      thanked_at: entry.thankedAt ? null : new Date().toISOString(),
      method: entry.thankedAt ? null : entry.method,
      note: entry.note,
    });
  }

  function setMethod(entry: ThankEntry, method: ThankMethod) {
    void saveThankYou(entry.key, {
      label: entry.name,
      gift: entry.gift,
      // Picking a method is itself a statement that they have been thanked.
      thanked_at: entry.thankedAt ?? new Date().toISOString(),
      method: entry.method === method ? null : method,
      note: entry.note,
    });
  }

  function setNote(entry: ThankEntry, note: string) {
    void saveThankYou(entry.key, {
      label: entry.name,
      gift: entry.gift,
      thanked_at: entry.thankedAt,
      method: entry.method,
      note: note.trim() || null,
    });
  }

  function openAdd() {
    setAdding(true);
    setNewName('');
    setTimeout(() => newInputRef.current?.focus(), 60);
  }

  function commitAdd() {
    const label = newName.trim();
    if (!label) { setAdding(false); return; }
    void saveThankYou(subjectKey('manual', crypto.randomUUID()), { label });
    setAdding(false);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[28px] border border-line bg-white p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-md text-sm text-muted">
          {t('Alle der kom, og alle der gav noget, samlet ét sted, så ingen bliver glemt.')}
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink-deep px-3 text-xs font-semibold text-white cursor-pointer"
        >
          <Plus size={13} />
          {t('Tilføj person')}
        </button>
      </div>

      {total > 0 && <ThankProgress done={done} total={total} />}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 w-full items-center gap-2.5 rounded-[14px] border border-line-soft bg-paper px-4 sm:w-[260px]">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Søg efter navn eller gave')}
            aria-label={t('Søg efter navn eller gave')}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Ryd søgning')}
              className="text-faint hover:text-ink cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
        {(['alle', 'mangler', 'takket'] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer',
                active
                  ? 'bg-ink text-paper'
                  : 'border border-line-soft bg-paper text-muted hover:text-ink',
              )}
            >
              {t(FILTER_LABELS[f])}
              <span className={active ? 'text-sage-tint' : 'text-faint'}>{counts[f]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <div className="rounded-[18px] border border-line-soft bg-paper px-5 py-10 text-center">
            <p className="font-serif text-lg text-ink">
              {total === 0
                ? t('Listen fylder sig selv ud, når gæsterne svarer og reserverer gaver.')
                : filter === 'takket' ? t('I har ikke takket nogen endnu.')
                : filter === 'mangler' ? t('Alle er takket. Flot klaret.')
                : t('Ingen matcher din søgning.')}
            </p>
          </div>
        )}

        <AnimatePresence>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#d3dcc4] bg-sage-wash px-5 py-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line-strong">
                  <Plus size={14} className="text-ink" />
                </span>
                <input
                  ref={newInputRef} value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAdding(false); }}
                  placeholder={t('Hvem mangler på listen?')}
                  aria-label={t('Hvem mangler på listen?')}
                  className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink placeholder:text-faint focus:outline-none"
                />
                <button type="button" onClick={commitAdd}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper cursor-pointer">
                  {t('Gem')}
                </button>
                <button type="button" onClick={() => setAdding(false)}
                  className="text-sm font-medium text-muted hover:text-ink cursor-pointer">
                  {t('Annuller')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {groups.map((g) => (
          <React.Fragment key={g.id}>
            {groups.length > 1 && (
              <p className={cn(
                'text-[11px] font-bold uppercase tracking-[0.14em] text-faint',
                g.id === 'takket' && 'mt-3',
              )}>
                {t(g.label)} · {g.rows.length}
              </p>
            )}
            {g.rows.map((entry) => (
              <ThankRow
                key={entry.key}
                entry={entry}
                open={openId === entry.key}
                onOpen={() => setOpenId((k) => (k === entry.key ? null : entry.key))}
                onToggle={() => toggle(entry)}
                onMethod={(m) => setMethod(entry, m)}
                onNote={(n) => setNote(entry, n)}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </motion.section>
  );
}

/* ── One person on the list ───────────────────────────────────────────── */
function ThankRow({ entry, open, onOpen, onToggle, onMethod, onNote }: {
  entry: ThankEntry;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onMethod: (m: ThankMethod) => void;
  onNote: (n: string) => void;
}) {
  const { t } = useLang();
  const [note, setNoteDraft] = useState(entry.note ?? '');
  const done = Boolean(entry.thankedAt);

  return (
    <div className={cn('rounded-[18px] border px-5 py-3.5 transition-colors', taskRowTone(done ? 'done' : 'default'))}>
      <div className="flex items-center gap-3 sm:gap-4">
        <TaskCheckbox done={done} label={entry.name} onToggle={onToggle} />

        {/* The whole row opens the details, not just a small icon at the end. */}
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-label={t('Detaljer for {name}', { name: entry.name })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cn('text-base font-semibold', done ? doneLabelClass : 'text-ink')}>
              {entry.name}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
              {entry.gift && (
                <span className="flex items-center gap-1.5">
                  <Gift size={12} className="shrink-0" />
                  {entry.gift}
                </span>
              )}
              {!entry.attended && !entry.gift && (
                <span className="text-faint">{t('Kom ikke')}</span>
              )}
            </span>
            {/* What they wrote is what the thank-you answers, so it shows
                while the card is being written, not only when opened. */}
            {entry.message && !open && (
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] italic text-sage">
                <Quote size={11} className="shrink-0" aria-hidden />
                <span className="truncate pr-1">{entry.message}</span>
              </span>
            )}
          </span>

          {done && entry.method && (
            <span className="hidden text-xs font-bold uppercase tracking-[0.12em] text-sage-strong sm:inline">
              {t(methodLabel(entry.method) ?? '')}
            </span>
          )}
          <ChevronDown
            size={16}
            aria-hidden
            className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-4">
              {entry.message && (
                <div className="rounded-[14px] bg-white/60 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
                    {t('De skrev')}
                  </p>
                  <p className="mt-1 text-sm italic leading-relaxed text-ink">{entry.message}</p>
                </div>
              )}

              {entry.email && (
                // No send button anywhere in the app — mailto is the honest option.
                <a href={`mailto:${entry.email}`}
                  className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                  <Mail size={13} className="shrink-0" />
                  {entry.email}
                </a>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
                  {t('Takket via')}
                </span>
                {THANK_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onMethod(m.id)}
                    className={cn(
                      'flex h-7 items-center rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer',
                      entry.method === m.id
                        ? 'bg-ink text-paper'
                        : 'border border-line-soft bg-white/60 text-muted hover:text-ink',
                    )}
                  >
                    {t(m.label)}
                  </button>
                ))}
              </div>

              <input
                value={note}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => note !== (entry.note ?? '') && onNote(note)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder={t('Privat note, fx hvad I gav igen')}
                aria-label={t('Privat note, fx hvad I gav igen')}
                className="h-10 rounded-[12px] border border-line-soft bg-white/60 px-3.5 text-sm text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── How far they are ─────────────────────────────────────────────────── */
function ThankProgress({ done, total }: { done: number; total: number }) {
  const { t } = useLang();
  const pct = Math.round((done / total) * 100);
  const finished = done === total;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn('text-sm font-semibold', finished ? 'text-ink' : 'text-muted')}>
          {finished
            ? t('Alle er takket. Det var den sidste.')
            : t('{done} af {total} takket', { done, total })}
        </p>
        <p className="font-serif text-lg tabular-nums text-ink">{pct}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={t('{done} af {total} takket', { done, total })}
        className="h-2 overflow-hidden rounded-full bg-shell"
      >
        <motion.div
          className="h-full rounded-full bg-sage-strong"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
