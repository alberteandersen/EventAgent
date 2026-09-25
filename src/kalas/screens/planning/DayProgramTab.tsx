"use client";

/* Bryllupsdagen — the wedding day itself, minute by minute.
 *
 * Distinct from the Tidslinje tab (milestones, months out, date-only) and from
 * the public "Program for dagen" section in the website builder (marketing
 * copy, no status): this is the couple's own run-of-show. It has to answer
 * three questions the other two never do — how long does each thing take,
 * where are the holes, and who is holding it.
 *
 * Rows persist on blur, with no draft/save step, the same as the budget
 * sub-items list: each row is its own id, so there is nothing to reconcile,
 * and nothing is lost by navigating away mid-edit. The arithmetic (ordering
 * past midnight, gaps, overlaps, the day's span, the ripple shift) lives in
 * dayProgram.ts so it can be tested without a clock.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, Check, Clipboard, ClipboardCheck, Copy,
  FileDown, Link2, MoreHorizontal, Plus, RefreshCw, Share2, Sparkles, X,
} from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { useLang } from '../../i18n';
import {
  daySpan, formatDuration, formatProgramText, gapAfter, shiftFrom, sortByTime,
} from './dayProgram';
import { todayISO } from './shared';
import DayCalendar from './DayCalendar';
import type { DayProgramItemRow } from '@/lib/db/types';

/** A whole Danish wedding day, so the tab never opens on a blank page. The
 *  couple edits it down to their own — far less work than building it up. */
const CLASSIC_DAY: { time: string; title: string; subtitle: string; duration_min: number; owner?: string }[] = [
  { time: '11:00', title: 'Klargøring & styling', subtitle: 'Bruden og brudepigerne', duration_min: 150 },
  { time: '13:30', title: 'Fotografen ankommer', subtitle: 'Detaljer og forberedelse', duration_min: 30, owner: 'Fotograf' },
  { time: '14:00', title: 'Gæsternes ankomst', subtitle: 'Velkomstdrinks', duration_min: 45, owner: 'Toastmaster' },
  { time: '15:00', title: 'Vielse', subtitle: 'Ceremonien', duration_min: 45, owner: 'Præst' },
  { time: '15:45', title: 'Lykønskninger & gruppebilleder', subtitle: '', duration_min: 45, owner: 'Fotograf' },
  { time: '16:30', title: 'Reception', subtitle: 'Snacks og bobler', duration_min: 90 },
  { time: '18:00', title: 'Middag', subtitle: 'Taler mellem retterne', duration_min: 150, owner: 'Toastmaster' },
  { time: '20:30', title: 'Kagebord', subtitle: '', duration_min: 30, owner: 'Catering' },
  { time: '21:00', title: 'Første dans', subtitle: 'Brudevalsen', duration_min: 30, owner: 'Musik/DJ' },
  { time: '21:30', title: 'Fest', subtitle: 'Dansegulvet er åbent', duration_min: 180, owner: 'Musik/DJ' },
  { time: '00:30', title: 'Natmad', subtitle: '', duration_min: 45, owner: 'Catering' },
];

/** One tap adds a common moment at a sensible default time. */
const QUICK_MOMENTS: { title: string; time: string; duration_min: number }[] = [
  { title: 'Gæsternes ankomst', time: '14:00', duration_min: 45 },
  { title: 'Vielse', time: '15:00', duration_min: 45 },
  { title: 'Gruppebilleder', time: '15:45', duration_min: 45 },
  { title: 'Middag', time: '18:00', duration_min: 150 },
  { title: 'Taler', time: '19:00', duration_min: 60 },
  { title: 'Første dans', time: '21:00', duration_min: 30 },
  { title: 'Natmad', time: '00:30', duration_min: 45 },
];


function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A print-only window: no new route, no PDF library — the browser's own print
 *  dialog is where "Save as PDF" already lives. */
function printProgram(title: string, subtitle: string, items: DayProgramItemRow[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const rows = sortByTime(items)
    .map((i) => `<div class="row">
        <div class="time">${esc(i.time)}${i.duration_min ? `<span class="dur">${esc(formatDuration(i.duration_min))}</span>` : ''}</div>
        <div class="body">
          <div class="title">${esc(i.title)}</div>
          ${i.subtitle ? `<div class="sub">${esc(i.subtitle)}</div>` : ''}
          ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
        </div>
        <div class="owner">${i.owner ? esc(i.owner) : ''}</div>
      </div>`)
    .join('');
  win.document.write(`<!doctype html><html lang="da"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #24413a; padding: 48px 40px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 2rem; margin: 0 0 4px; font-weight: 400; }
    .lede { color: #5f6b66; font-size: 0.9rem; margin: 0 0 32px; font-family: system-ui, sans-serif; }
    .row { display: flex; gap: 20px; padding: 14px 0; border-bottom: 1px solid #e2e6e2; page-break-inside: avoid; }
    .time { width: 78px; flex-shrink: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
    .dur { display: block; font-weight: 400; font-size: 0.7rem; color: #8a938e; font-family: system-ui, sans-serif; margin-top: 2px; }
    .body { flex: 1; min-width: 0; }
    .title { font-weight: 600; font-size: 1.05rem; }
    .sub, .notes { color: #5f6b66; font-size: 0.82rem; margin-top: 3px; font-family: system-ui, sans-serif; }
    .notes { font-style: italic; }
    .owner { width: 110px; flex-shrink: 0; text-align: right; color: #5f6b66; font-size: 0.75rem; font-family: system-ui, sans-serif; }
  </style></head><body><h1>${esc(title)}</h1><p class="lede">${esc(subtitle)}</p>${rows}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/** The tab as mounted by Planning.tsx: pulls the day out of the wedding
 *  context and hands it to the presentation below. Split so the view can be
 *  exercised without a Supabase session — the same reason BudgetLineDetail
 *  takes plain props. */
export default function DayProgramTab() {
  const { couple, dayProgramItems, addDayProgramItem, updateDayProgramItem, deleteDayProgramItem, seedDayProgram } = useWedding();
  const items = useWithoutPending(dayProgramItems);
  const removeWithUndo = useRemoveWithUndo();
  const remove = (id: string) =>
    removeWithUndo(id, dayProgramItems.find((i) => i.id === id)?.title ?? '', () => deleteDayProgramItem(id));
  return (
    <DayProgram
      items={items}
      isToday={Boolean(couple.dateISO) && couple.dateISO === todayISO()}
      onAdd={(item) => addDayProgramItem(item)}
      onUpdate={(id, patch) => void updateDayProgramItem(id, patch)}
      onDelete={remove}
      onSeed={(rows) => void seedDayProgram(rows)}
      onShare={shareLink}
    />
  );
}

/** The read-only link: the existing one, a fresh one (`rotate`), or none
 *  (`stop`). Resolves to the full URL, null when sharing is off, or throws. */
async function shareLink(action: 'get' | 'rotate' | 'stop'): Promise<string | null> {
  const res = await fetch('/api/day-program/share', {
    method: action === 'stop' ? 'DELETE' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: action === 'stop' ? undefined : JSON.stringify({ rotate: action === 'rotate' }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const { token } = (await res.json()) as { token: string | null };
  return token ? `${window.location.origin}/p/${token}` : null;
}

export interface DayProgramProps {
  items: DayProgramItemRow[];
  /** Only on the actual wedding day does anything read as done or "Nu". */
  isToday: boolean;
  /** May resolve to null when the write failed, which the composer reports
   *  instead of clearing the field as if it had worked. */
  onAdd: (item: { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null; notes?: string | null }) => void | Promise<unknown>;
  onUpdate: (id: string, patch: Partial<Pick<DayProgramItemRow, 'time' | 'title' | 'subtitle' | 'duration_min' | 'owner' | 'notes'>>) => void;
  onDelete: (id: string) => void;
  onSeed: (rows: { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null }[]) => void;
  /** Overridable so the harness can park the clock mid-day. */
  clockOverride?: string;
  /** The read-only link for photographer, toastmaster and family. Left out,
   *  there is no Del button. */
  onShare?: (action: 'get' | 'rotate' | 'stop') => Promise<string | null>;
}

export function DayProgram({
  items: rawItems, isToday, onAdd, onUpdate, onDelete, onSeed, clockOverride, onShare,
}: DayProgramProps) {
  const { t, tn } = useLang();
  const [clock, setClock] = useState(clockOverride ?? nowHHMM());
  // An empty day opens on one choice, the classic day. The blank composer
  // waits behind "start med en tom dag" instead of competing with it.
  const [blankStart, setBlankStart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Why a quick add did not land.
  const [addFailed, setAddFailed] = useState(false);
  // The share panel: closed, loading, open on a link, or failed.
  const [share, setShare] = useState<{ open: boolean; url: string | null; busy: boolean; failed: boolean; copied: boolean }>(
    { open: false, url: null, busy: false, failed: false, copied: false },
  );

  useEffect(() => {
    if (clockOverride) return;
    const id = window.setInterval(() => setClock(nowHHMM()), 30_000);
    return () => window.clearInterval(id);
  }, [clockOverride]);

  const items = sortByTime(rawItems);
  const span = daySpan(items);
  // The first place one moment runs into the next, for the notice up top.
  const clash = (() => {
    for (let i = 0; i < items.length - 1; i++) {
      const g = gapAfter(items, i);
      if (g != null && g < 0) return { index: i, a: items[i].title, b: items[i + 1].title, minutes: -g };
    }
    return null;
  })();

  // One line, two readers: the tab's own heading and the printed programme.
  const dayHeadline =
    items.length === 0
      ? t('Byg jeres dags program minut for minut')
      : items.length === 1
        ? t('Ét øjeblik — en dag er begyndt')
        : t('{n} øjeblikke, én smukt koordineret dag', { n: items.length });

  const addQuick = async (q: (typeof QUICK_MOMENTS)[number]) => {
    setAddFailed(false);
    const saved = await onAdd({ time: q.time, title: q.title, duration_min: q.duration_min });
    if (saved === null) setAddFailed(true);
  };

  const shift = (index: number, delta: number) => {
    for (const patch of shiftFrom(items, index, delta)) {
      onUpdate(patch.id, { time: patch.time });
    }
  };

  const duplicate = (item: DayProgramItemRow) => {
    onAdd({
      time: item.time, title: item.title, subtitle: item.subtitle,
      duration_min: item.duration_min, owner: item.owner, notes: item.notes,
    });
  };

  const runShare = async (action: 'get' | 'rotate' | 'stop') => {
    if (!onShare) return;
    setShare((s) => ({ ...s, open: action !== 'stop', busy: true, failed: false, copied: false }));
    try {
      const url = await onShare(action);
      setShare((s) => ({ ...s, url, busy: false }));
      if (url && action !== 'stop') {
        void navigator.clipboard?.writeText(url).then(() => setShare((s) => ({ ...s, copied: true })));
      }
    } catch {
      setShare((s) => ({ ...s, busy: false, failed: true }));
    }
  };

  const copyProgram = () => {
    void navigator.clipboard.writeText(formatProgramText(items, t('Bryllupsdagen'))).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  /* One tap for the moments almost every wedding has, while the day is being
     started from blank; once a few are in, the calendar is the way to add. */
  const quickAdds = QUICK_MOMENTS.filter((q) => !items.some((i) => i.title === q.title));
  const quick = items.length < 4 && quickAdds.length > 0 && (
    <div className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="text-[12px] text-muted">{t('Tilføj hurtigt:')}</span>
      {quickAdds.map((q) => (
        <button
          key={q.title}
          type="button"
          onClick={() => void addQuick(q)}
          className="inline-flex items-center gap-0.5 rounded-full border border-line px-2.5 py-1 text-[0.76rem] text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
        >
          <Plus size={11} strokeWidth={2.5} /> {t(q.title)}
        </button>
      ))}
      {addFailed && <span role="status" className="text-[12px] text-terracotta">{t('Øjeblikket blev ikke gemt. Prøv igen.')}</span>}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[22px] border border-line bg-card px-4 py-6 sm:rounded-[28px] sm:px-9 sm:py-9"
    >
      {/* ── Header: the day's span, said once, rather than a strip of
          labelled figures; sharing first, the rest behind "⋯". ────────── */}
      {span ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[1.7rem] leading-tight text-ink sm:text-[2rem]">
              {t('Fra {start} til {end}', { start: span.start, end: span.end })}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {formatDuration(span.totalMin)} · {tn(items.length, 'ét punkt', '{n} punkter')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onShare && (
              <button
                type="button"
                onClick={() => (share.open ? setShare((s) => ({ ...s, open: false })) : void runShare('get'))}
                aria-expanded={share.open}
                className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.8rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer"
              >
                <Share2 size={14} /> {t('Del')}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t('Flere handlinger')}
                aria-expanded={menuOpen}
                className="flex size-9 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:text-ink cursor-pointer"
              >
                {copied ? <ClipboardCheck size={15} className="text-success" /> : <MoreHorizontal size={16} />}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-[220px] overflow-hidden rounded-[14px] border border-line bg-card py-1 shadow-[0_16px_40px_-12px_rgba(20,26,19,0.25)]">
                    <button type="button" onClick={() => { setMenuOpen(false); copyProgram(); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-shell cursor-pointer">
                      <Clipboard size={14} className="text-muted" /> {t('Kopiér som tekst')}
                    </button>
                    <button type="button" onClick={() => { setMenuOpen(false); printProgram(t('Bryllupsdagen'), dayHeadline, items); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-shell cursor-pointer">
                      <FileDown size={14} className="text-muted" /> {t('Gem som PDF')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="font-serif text-[1.7rem] leading-tight text-ink sm:text-[2rem]">{t('Jeres dag, time for time')}</h2>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
            {t('Fra gæsternes ankomst til den sidste dans, så fotografen, familien og leverandørerne kender planen.')}
          </p>
        </div>
      )}

      {/* ── Sharing ─────────────────────────────────────────────────────
          A read-only page with the day on it, for the people who run it.
          The link is copied the moment it exists, since that is what the
          couple came here to do; the panel is for what comes after. */}
      <AnimatePresence initial={false}>
        {share.open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-4 rounded-2xl bg-shell px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.86rem] font-semibold text-ink">{t('Del med fotograf, toastmaster og familie')}</p>
                <p className="mt-0.5 text-[0.76rem] text-muted">
                  {t('Alle med linket kan se programmet, men ikke ændre det. De skal ikke logge ind.')}
                </p>
              </div>
              <button type="button" onClick={() => setShare((s) => ({ ...s, open: false }))} aria-label={t('Luk')}
                className="shrink-0 rounded-full p-1 text-muted hover:bg-shell hover:text-ink cursor-pointer">
                <X size={15} />
              </button>
            </div>

            {share.failed ? (
              <p className="mt-3 text-[0.8rem] text-[var(--color-terracotta)]">{t('Linket kunne ikke laves. Prøv igen.')}</p>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-shell px-3 py-2">
                  <Link2 size={13} className="shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-[0.8rem] text-ink-soft">{share.busy ? t('Laver linket…') : share.url}</span>
                </div>
                <button
                  type="button"
                  disabled={!share.url || share.busy}
                  onClick={() => share.url && void navigator.clipboard?.writeText(share.url).then(() => setShare((s) => ({ ...s, copied: true })))}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[0.76rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40 cursor-pointer"
                >
                  {share.copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  {share.copied ? t('Kopieret') : t('Kopiér')}
                </button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.74rem]">
              <button type="button" disabled={share.busy} onClick={() => void runShare('rotate')}
                className="inline-flex items-center gap-1 text-muted hover:text-ink disabled:opacity-40 cursor-pointer">
                <RefreshCw size={11} /> {t('Lav et nyt link (det gamle holder op med at virke)')}
              </button>
              <button type="button" disabled={share.busy} onClick={() => void runShare('stop')}
                className="text-[var(--color-terracotta)] hover:opacity-80 disabled:opacity-40 cursor-pointer">
                {t('Stop deling')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── A collision, said in words, with the fix one tap away. The strip
          of figures that used to sit here (tidsrum, varighed, punkter,
          pauser) only ever needed this one of them. */}
      {clash && (
        <div role="status" className="mt-5 flex flex-col items-start gap-2 rounded-xl bg-terracotta-tint/70 px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:gap-3">
          <AlertTriangle size={14} className="hidden shrink-0 text-terracotta sm:block" aria-hidden />
          <span className="min-w-0 flex-1 text-ink">
            {t('{a} løber {d} ind i {b}.', { a: t(clash.a), b: t(clash.b), d: formatDuration(clash.minutes) })}
            {span && span.overlaps > 1 && ` ${tn(span.overlaps - 1, 'Og ét overlap mere.', 'Og {n} overlap mere.')}`}
          </span>
          <button type="button" onClick={() => shift(clash.index + 1, clash.minutes)}
            className="shrink-0 font-semibold text-terracotta underline-offset-4 hover:underline cursor-pointer">
            {t('Ryk resten {d} senere', { d: formatDuration(clash.minutes) })}
          </button>
        </div>
      )}


      {/* ── Empty state: one way in, and the blank page behind a link. ─── */}
      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-start">
          <button
            type="button"
            onClick={() => onSeed(CLASSIC_DAY)}
            className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Sparkles size={14} /> {t('Start fra en klassisk dag')}
          </button>
          <p className="mt-2.5 text-[13px] text-muted">
            {t('Elleve øjeblikke, fra styling til natmad. Ret dem til jeres egne bagefter.')}
          </p>
          {!blankStart && (
            <button type="button" onClick={() => setBlankStart(true)}
              className="mt-5 text-[13px] font-semibold text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink cursor-pointer">
              {t('Eller start med en tom dag')}
            </button>
          )}
        </div>
      )}

      {(items.length > 0 || blankStart) && quick}

      {/* ── The day, as a calendar ──────────────────────────────────── */}
      {(items.length > 0 || blankStart) && (
        <DayCalendar
          items={items}
          clock={clock}
          isToday={isToday}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDuplicate={duplicate}
          onShift={shift}
        />
      )}
    </motion.div>
  );
}
