"use client";

/* Bryllupsdagen — the wedding day itself, minute by minute. Distinct from the
   Tidslinje tab (milestones, months out, date-only) and from the public
   "Program for dagen" section in the website builder (marketing copy, no
   status): this is the couple's own working schedule, with a live done/now/
   upcoming state that only ever activates on the actual day.

   Rows are editable in place and persist on blur — there is no draft/save
   step here, matching how the budget sub-items list works: each row is its
   own id, so there is nothing to reconcile, and immediate persistence means
   nothing is lost by navigating away. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Clipboard, ClipboardCheck, FileDown, Plus, X } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { Eyebrow, Chip, cn } from '../../ui';
import { formatProgramText, sortByTime, statusOf } from './dayProgram';
import { todayISO } from './shared';

const fieldCls =
  'min-w-0 rule rounded-xl bg-shell px-3 py-2 text-[0.85rem] text-ink placeholder:text-muted/60 tabular-nums focus:outline-none focus:border-[var(--color-sage-strong)]';

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A print-only window: no new route, no PDF library — the browser's own
 *  print dialog lets the couple choose "Save as PDF" from here. */
function printProgram(title: string, items: { time: string; title: string; subtitle?: string | null }[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = sortByTime(items)
    .map(
      (i) => `<div class="row"><span class="time">${i.time}</span><div><div class="title">${i.title}</div>${
        i.subtitle ? `<div class="sub">${i.subtitle}</div>` : ''
      }</div></div>`,
    )
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body { font-family: Georgia, serif; color: #24413a; padding: 40px; max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 24px; }
    .row { display: flex; gap: 20px; padding: 14px 0; border-bottom: 1px solid #e2e6e2; }
    .time { font-weight: 700; width: 56px; flex-shrink: 0; }
    .title { font-weight: 600; }
    .sub { color: #5f6b66; font-size: 0.85rem; margin-top: 2px; }
  </style></head><body><h1>${title}</h1>${rows}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export default function DayProgramTab() {
  const { t } = useLang();
  const { couple, dayProgramItems, addDayProgramItem, updateDayProgramItem, deleteDayProgramItem } = useWedding();
  const [clock, setClock] = useState(nowHHMM());
  const [copied, setCopied] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setClock(nowHHMM()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const items = sortByTime(dayProgramItems);
  const isToday = Boolean(couple.dateISO) && couple.dateISO === todayISO();

  const addItem = () => {
    const cleanTitle = newTitle.trim();
    if (!newTime || !cleanTitle) return;
    void addDayProgramItem({ time: newTime, title: cleanTitle, subtitle: newSubtitle.trim() || null });
    setNewTime('');
    setNewTitle('');
    setNewSubtitle('');
  };

  const copyProgram = () => {
    void navigator.clipboard.writeText(formatProgramText(items, t('Bryllupsdagen'))).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{t('Bryllupsdagen')}</Eyebrow>
          <h2 className="mt-1 font-serif text-[1.4rem] text-ink">
            {items.length > 0
              ? t('{n} øjeblikke, én smukt koordineret dag', { n: items.length })
              : t('Byg jeres dags program minut for minut')}
          </h2>
        </div>

        {items.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copyProgram}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
            >
              {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
              {copied ? t('Kopieret') : t('Kopiér programmet')}
            </button>
            <button
              type="button"
              onClick={() => printProgram(t('Bryllupsdagen'), items)}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
            >
              <FileDown size={14} />
              {t('Download som PDF')}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 max-w-md text-[0.85rem] text-muted">
          {t('Læg jeres dag time for time — fra gæsternes ankomst til den sidste dans — så alle, fotografen, familien, leverandørerne, kender planen.')}
        </p>
      ) : (
        <div className="relative mt-8">
          <div aria-hidden className="absolute bottom-3 left-[23px] top-3 w-px bg-line" />
          <div className="flex flex-col gap-5">
            {items.map((item, i) => {
              const status = statusOf(items, i, clock, isToday);
              return (
                <div key={item.id} className="flex items-start gap-4">
                  <span className="relative z-10 flex w-12 shrink-0 justify-center pt-2">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border',
                        status === 'done' && 'border-sage-strong bg-sage-strong',
                        status === 'now' && 'border-sage-strong bg-card ring-4 ring-sage-tint',
                        status === 'upcoming' && 'border-line-strong bg-card',
                      )}
                    >
                      {status === 'done' && <Check size={12} className="text-canvas" strokeWidth={3} />}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl px-2 py-1 transition-colors hover:bg-shell">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        defaultValue={item.time}
                        onBlur={(e) => { if (e.target.value && e.target.value !== item.time) void updateDayProgramItem(item.id, { time: e.target.value }); }}
                        aria-label={t('Klokkeslæt')}
                        className="w-[5.5rem] shrink-0 rounded-lg bg-transparent px-1 py-0.5 text-[0.82rem] font-semibold text-ink tabular-nums focus:outline-none focus:bg-card"
                      />
                      <input
                        defaultValue={item.title}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== item.title) void updateDayProgramItem(item.id, { title: v });
                          else e.target.value = item.title;
                        }}
                        aria-label={t('Titel')}
                        className="min-w-[8rem] flex-1 rounded-lg bg-transparent px-1 py-0.5 font-serif text-[1.02rem] text-ink focus:outline-none focus:bg-card"
                      />
                      {status === 'now' && <Chip tone="sage">{t('Nu')}</Chip>}
                      <button
                        type="button"
                        onClick={() => void deleteDayProgramItem(item.id)}
                        aria-label={t('Slet {label}', { label: item.title })}
                        className="ml-auto shrink-0 rounded-full p-1 text-muted/0 transition-colors hover:bg-shell hover:text-[var(--color-terracotta)] group-hover:text-muted cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <input
                      defaultValue={item.subtitle ?? ''}
                      placeholder={t('Sted, detaljer…')}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (item.subtitle ?? '')) void updateDayProgramItem(item.id, { subtitle: v || null });
                      }}
                      aria-label={t('Detaljer')}
                      className="mt-0.5 w-full rounded-lg bg-transparent px-1 py-0.5 text-[0.78rem] text-muted focus:outline-none focus:bg-card"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add a moment */}
      <div className={cn('flex flex-wrap items-center gap-2', items.length > 0 ? 'mt-6 pl-16' : 'mt-5')}>
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          aria-label={t('Klokkeslæt')}
          className={cn(fieldCls, 'w-[6.5rem] shrink-0')}
        />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={t('Fx ceremoni, middag, første dans…')}
          aria-label={t('Nyt øjeblik')}
          className={cn(fieldCls, 'min-w-[9rem] flex-1')}
        />
        <input
          value={newSubtitle}
          onChange={(e) => setNewSubtitle(e.target.value)}
          placeholder={t('Sted, detaljer…')}
          aria-label={t('Detaljer')}
          className={cn(fieldCls, 'w-40 shrink-0')}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newTime || !newTitle.trim()}
          aria-label={t('Tilføj øjeblik')}
          className="shrink-0 rounded-full bg-ink p-2 text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>
    </motion.div>
  );
}
