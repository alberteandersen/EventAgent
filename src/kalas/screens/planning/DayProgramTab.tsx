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

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, Check, ChevronDown, Clipboard, ClipboardCheck, Copy,
  FileDown, Link2, Plus, RefreshCw, Share2, Sparkles, Trash2, User, X,
} from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../../undo';
import { useLang } from '../../i18n';
import { Eyebrow, cn } from '../../ui';
import {
  daySpan, formatDuration, formatProgramText, gapAfter, shiftFrom, sortByTime, sortKey, statusOf,
} from './dayProgram';
import { todayISO } from './shared';
import type { DayProgramItemRow } from '@/lib/db/types';

const fieldCls =
  'min-w-0 rule rounded-xl bg-shell px-3 py-2 text-[0.85rem] text-ink placeholder:text-muted/60 focus:outline-none focus:border-[var(--color-sage-strong)]';

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

const OWNERS = ['Fotograf', 'Toastmaster', 'Catering', 'Musik/DJ', 'Præst', 'Venue', 'Os selv'];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

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
  const { t } = useLang();
  const [clock, setClock] = useState(clockOverride ?? nowHHMM());
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');
  // Why nothing was added: no title yet, or the save itself failed.
  const [addProblem, setAddProblem] = useState<'title' | 'failed' | null>(null);
  // The share panel: closed, loading, open on a link, or failed.
  const [share, setShare] = useState<{ open: boolean; url: string | null; busy: boolean; failed: boolean; copied: boolean }>(
    { open: false, url: null, busy: false, failed: false, copied: false },
  );
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clockOverride) return;
    const id = window.setInterval(() => setClock(nowHHMM()), 30_000);
    return () => window.clearInterval(id);
  }, [clockOverride]);

  const items = sortByTime(rawItems);
  const span = daySpan(items);
  const nowIndex = items.findIndex((i) => sortKey(i.time) > sortKey(clock));
  const markerAt = nowIndex === -1 ? items.length : nowIndex;

  const nextTime = () => {
    // A new moment lands after the day's current end, not on top of it.
    const last = items[items.length - 1];
    if (!last) return '14:00';
    const end = sortKey(last.time) + (last.duration_min || 60);
    return `${String(Math.floor((end % 1440) / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  };

  // The field always shows a real time — the slot right after the day's
  // current end — instead of an empty "--:--" the couple has to fill in
  // before they can type what they actually came to type. Clearing newTime
  // after an add re-derives it against the moment just added.
  const timeValue = newTime || nextTime();

  // One line, two readers: the tab's own heading and the printed programme.
  const dayHeadline =
    items.length === 0
      ? t('Byg jeres dags program minut for minut')
      : items.length === 1
        ? t('Ét øjeblik — en dag er begyndt')
        : t('{n} øjeblikke, én smukt koordineret dag', { n: items.length });

  /* The button used to be disabled until a title was typed, and a disabled
     button next to an empty field reads as a broken one: couples pressed it,
     nothing happened, and nothing said why. It always answers now, either by
     adding the moment or by saying what is missing. */
  const addItem = async () => {
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) {
      setAddProblem('title');
      titleRef.current?.focus();
      return;
    }
    setAddProblem(null);
    const time = timeValue;
    setNewTitle('');
    setNewTime('');
    titleRef.current?.focus();
    const saved = await onAdd({ time, title: cleanTitle, duration_min: 0 });
    if (saved === null) {
      // Put back what they typed, so a failed save costs them nothing.
      setNewTitle(cleanTitle);
      setNewTime(time);
      setAddProblem('failed');
    }
  };

  const addQuick = async (q: (typeof QUICK_MOMENTS)[number]) => {
    setAddProblem(null);
    const saved = await onAdd({ time: q.time, title: q.title, duration_min: q.duration_min });
    if (saved === null) setAddProblem('failed');
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

  /* The add bar. Kept full width and above the day rather than indented at
     the end of it: on a full programme the tail is a long scroll away, and
     the one control you reach for repeatedly should not be the one you have
     to hunt for. */
  const composer = (
    <div className="mt-4">
      {/* One control, not three boxes: the time, the title and the action
          share a single field, divided by a hairline.

          focus-shell, not a per-input ring: the app's global focus rule
          deliberately beats `focus:outline-none`, so a bare input in a
          rounded shell gets a hard rectangle cutting across it. Same class
          the Ava chat composer uses, for the same reason. */}
      <div className="focus-shell flex items-center gap-1 rounded-2xl border border-line bg-card p-1.5 transition-colors focus-within:border-[var(--color-sage-strong)]">
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setNewTime(e.target.value)}
          aria-label={t('Klokkeslæt')}
          className="w-[5.6rem] shrink-0 rounded-xl bg-transparent px-2 py-2 text-center text-[0.84rem] font-semibold text-ink tabular-nums [color-scheme:light] focus:bg-shell focus:outline-none"
        />
        <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
        <input
          ref={titleRef}
          value={newTitle}
          onChange={(e) => { setNewTitle(e.target.value); if (addProblem === 'title') setAddProblem(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }}
          placeholder={t('Fx ceremoni, middag, første dans…')}
          aria-label={t('Nyt øjeblik')}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[0.88rem] text-ink placeholder:text-muted/70 focus:outline-none"
        />
        <button
          type="button" onClick={() => void addItem()}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[0.8rem] font-semibold transition-colors cursor-pointer',
            newTitle.trim()
              ? 'bg-ink text-canvas hover:opacity-90'
              : 'bg-shell text-ink-soft hover:bg-line',
          )}
        >
          <Plus size={14} /> {t('Tilføj')}
        </button>
      </div>

      {addProblem && (
        <p role="status" className={cn(
          'mt-2 pl-1 text-[0.76rem]',
          addProblem === 'failed' ? 'text-[var(--color-terracotta)]' : 'text-ink-soft',
        )}>
          {addProblem === 'failed'
            ? t('Øjeblikket blev ikke gemt. Prøv igen.')
            : t('Skriv først, hvad der sker kl. {time}.', { time: timeValue })}
        </p>
      )}

      {/* One tap for the moments almost every wedding has */}
      {QUICK_MOMENTS.some((q) => !items.some((i) => i.title === q.title)) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-0.5">
          <span className="text-[0.68rem] uppercase tracking-[0.12em] text-faint">{t('Hurtigt')}</span>
          {QUICK_MOMENTS.filter((q) => !items.some((i) => i.title === q.title)).map((q) => (
            <button
              key={q.title}
              type="button"
              onClick={() => void addQuick(q)}
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[0.73rem] text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
            >
              <Plus size={11} strokeWidth={2.5} /> {t(q.title)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{t('Bryllupsdagen')}</Eyebrow>
          <h2 className="mt-1 font-serif text-[1.5rem] leading-tight text-ink">
            {dayHeadline}
          </h2>
        </div>

        {items.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {onShare && (
              <button
                type="button"
                onClick={() => (share.open ? setShare((s) => ({ ...s, open: false })) : void runShare('get'))}
                aria-expanded={share.open}
                className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[0.78rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer"
              >
                <Share2 size={14} /> {t('Del programmet')}
              </button>
            )}
            <button
              type="button" onClick={copyProgram}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-2 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
            >
              {copied ? <ClipboardCheck size={14} className="text-success" /> : <Clipboard size={14} />}
              {copied ? t('Kopieret') : t('Kopiér')}
            </button>
            <button
              type="button"
              onClick={() => printProgram(t('Bryllupsdagen'), dayHeadline, items)}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-2 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink cursor-pointer"
            >
              <FileDown size={14} /> {t('PDF')}
            </button>
          </div>
        )}
      </div>

      {/* ── Sharing ─────────────────────────────────────────────────────
          A read-only page with the day on it, for the people who run it.
          The link is copied the moment it exists, since that is what the
          couple came here to do; the panel is for what comes after. */}
      <AnimatePresence initial={false}>
        {share.open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-4 rounded-2xl rule bg-card px-4 py-4"
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

      {/* ── The shape of the day ────────────────────────────────────────
          Every figure carries its own label. Unlabelled they read as four
          loose numbers that have to be decoded — "1 pauser" least of all. */}
      {span && (
        <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3 rounded-2xl rule bg-card px-4 py-3">
          <Stat label={t('Tidsrum')}>
            <span className="font-serif text-[1.05rem] text-ink tabular-nums">{span.start} – {span.end}</span>
          </Stat>
          <Stat label={t('Varighed')}>{formatDuration(span.totalMin)}</Stat>
          <Stat label={t('Punkter')}>{items.length}</Stat>
          <Stat label={t('Pauser')}>{span.gaps}</Stat>
          {span.overlaps > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 pb-0.5 text-[0.78rem] font-semibold text-[var(--color-terracotta)]">
              <AlertTriangle size={13} />
              {span.overlaps === 1
                ? t('1 overlap')
                : t('{n} overlap', { n: span.overlaps })}
            </span>
          )}
        </div>
      )}

      {items.length > 0 && composer}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="mt-5 rounded-2xl rule bg-card px-6 py-8">
          <p className="max-w-md text-[0.88rem] leading-relaxed text-ink-soft">
            {t('Læg jeres dag time for time — fra gæsternes ankomst til den sidste dans — så alle, fotografen, familien, leverandørerne, kender planen.')}
          </p>
          <button
            type="button"
            onClick={() => onSeed(CLASSIC_DAY)}
            className="mt-5 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Sparkles size={14} /> {t('Start fra en klassisk dag')}
          </button>
          <p className="mt-2.5 text-[0.74rem] text-muted">
            {t('Elleve øjeblikke, fra styling til natmad. Ret dem til jeres egne bagefter.')}
          </p>
        </div>
      )}

      {items.length === 0 && composer}

      {/* ── The day ─────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="relative mt-6">
          <div aria-hidden className="absolute bottom-4 left-[6.25rem] top-3 w-px bg-line" />

          <div className="flex flex-col">
            {items.map((item, i) => {
              const status = statusOf(items, i, clock, isToday);
              const gap = gapAfter(items, i);
              const open = openId === item.id;
              const barHeight = Math.min(Math.max(item.duration_min, 0) * 0.8, 120);

              return (
                <div key={item.id}>
                  {isToday && markerAt === i && <NowMarker clock={clock} label={t('nu')} />}

                  <motion.div layout="position" className="group flex items-stretch gap-3">
                    {/* Time */}
                    <div className="flex w-[4.6rem] shrink-0 flex-col items-end pt-2.5">
                      <input
                        type="time"
                        defaultValue={item.time}
                        onBlur={(e) => { if (e.target.value && e.target.value !== item.time) onUpdate(item.id, { time: e.target.value }); }}
                        aria-label={t('Klokkeslæt')}
                        className={cn(
                          'kalas-inline-time w-full rounded-lg bg-transparent px-1 py-0.5 text-right text-[0.86rem] font-semibold tabular-nums [color-scheme:light] focus:bg-shell focus:outline-none',
                          status === 'done' ? 'text-muted' : 'text-ink',
                        )}
                      />
                      {item.duration_min > 0 && (
                        <span className="pr-1 text-[0.64rem] text-faint tabular-nums">{formatDuration(item.duration_min)}</span>
                      )}
                    </div>

                    {/* Rail: a dot, and a bar as long as the moment lasts */}
                    <div className="relative z-10 flex w-6 shrink-0 flex-col items-center pt-3">
                      <span
                        className={cn(
                          'flex size-[1.15rem] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          status === 'done' && 'border-sage-strong bg-sage-strong',
                          status === 'now' && 'border-sage-strong bg-card ring-4 ring-sage-tint',
                          status === 'upcoming' && 'border-line-strong bg-card',
                        )}
                      >
                        {status === 'done' && <Check size={10} className="text-canvas" strokeWidth={3.5} />}
                      </span>
                      {item.duration_min > 0 && (
                        <span
                          className={cn(
                            'mt-1 w-[3px] shrink-0 rounded-full',
                            status === 'done' ? 'bg-sage-strong/30' : status === 'now' ? 'bg-sage-strong' : 'bg-line-strong/60',
                          )}
                          style={{ height: barHeight }}
                          aria-hidden
                        />
                      )}
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1 pb-4">
                      <div
                        className={cn(
                          'rounded-xl px-2.5 py-1.5 transition-colors',
                          status === 'now' ? 'bg-sage-tint/50' : 'hover:bg-shell',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            defaultValue={item.title}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== item.title) onUpdate(item.id, { title: v });
                              else e.target.value = item.title;
                            }}
                            aria-label={t('Titel')}
                            className={cn(
                              'min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 font-serif text-[1.05rem] focus:bg-card focus:outline-none',
                              status === 'done' ? 'text-ink-soft' : 'text-ink',
                            )}
                          />

                          {status === 'now' && (
                            <span className="shrink-0 rounded-full bg-sage-strong px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-canvas">
                              {t('Nu')}
                            </span>
                          )}

                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button" onClick={() => duplicate(item)}
                              aria-label={t('Dublér {label}', { label: item.title })}
                              className="rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-ink cursor-pointer"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button" onClick={() => onDelete(item.id)}
                              aria-label={t('Slet {label}', { label: item.title })}
                              className="rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-[var(--color-terracotta)] cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : item.id)}
                            aria-expanded={open}
                            aria-label={open ? t('Skjul detaljer') : t('Vis detaljer')}
                            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-ink cursor-pointer"
                          >
                            <ChevronDown size={15} className={cn('transition-transform duration-200', open && 'rotate-180')} />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2">
                          <input
                            defaultValue={item.subtitle ?? ''}
                            placeholder={t('Sted, detaljer…')}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (item.subtitle ?? '')) onUpdate(item.id, { subtitle: v || null });
                            }}
                            aria-label={t('Detaljer')}
                            className="min-w-[6rem] flex-1 rounded-lg bg-transparent px-1 py-0.5 text-[0.78rem] text-muted focus:bg-card focus:outline-none"
                          />
                          {item.owner && !open && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-shell px-2 py-0.5 text-[0.68rem] text-ink-soft">
                              <User size={10} /> {item.owner}
                            </span>
                          )}
                        </div>

                        {/* Detail panel */}
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2.5 space-y-3 rounded-xl bg-card/70 p-3">
                                <Row label={t('Varighed')}>
                                  {DURATIONS.map((d) => (
                                    <Pill
                                      key={d} active={item.duration_min === d}
                                      onClick={() => onUpdate(item.id, { duration_min: item.duration_min === d ? 0 : d })}
                                    >
                                      {formatDuration(d)}
                                    </Pill>
                                  ))}
                                </Row>

                                <Row label={t('Ansvarlig')}>
                                  {OWNERS.map((o) => (
                                    <Pill
                                      key={o} active={item.owner === o}
                                      onClick={() => onUpdate(item.id, { owner: item.owner === o ? null : o })}
                                    >
                                      {t(o)}
                                    </Pill>
                                  ))}
                                </Row>

                                <Row label={t('Ryk denne og alt efter')}>
                                  {[-15, -5, 5, 15].map((d) => (
                                    <Pill key={d} onClick={() => shift(i, d)}>
                                      {d > 0 ? `+${d}` : d} {t('min')}
                                    </Pill>
                                  ))}
                                </Row>

                                <textarea
                                  rows={2}
                                  defaultValue={item.notes ?? ''}
                                  placeholder={t('Noter til leverandører — hvad skal der ske, og hvem gør hvad?')}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== (item.notes ?? '')) onUpdate(item.id, { notes: v || null });
                                  }}
                                  aria-label={t('Noter')}
                                  className={cn(fieldCls, 'w-full resize-none text-[0.8rem]')}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>

                  {/* The seam: a hole, or a collision */}
                  {gap != null && gap !== 0 && (
                    <div className="-mt-2 mb-2 flex items-center gap-3 pl-[4.6rem]">
                      <span className="flex w-6 shrink-0 justify-center">
                        <span
                          className={cn(
                            'w-0 border-l border-dashed',
                            gap < 0 ? 'border-[var(--color-terracotta)]' : 'border-line-strong',
                          )}
                          style={{ height: Math.min(Math.abs(gap) * 0.5, 34) + 12 }}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-[0.68rem] italic',
                          gap < 0 ? 'font-semibold not-italic text-[var(--color-terracotta)]' : 'text-faint',
                        )}
                      >
                        {gap < 0
                          ? t('overlapper {d}', { d: formatDuration(-gap) })
                          : t('{d} pause', { d: formatDuration(gap) })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {isToday && markerAt === items.length && <NowMarker clock={clock} label={t('nu')} />}
          </div>
        </div>
      )}

      {/* The native picker indicator eats the width an inline time needs, and
          an inline edit does not want a second affordance next to it anyway —
          typing and the arrow keys both still work. Same scoped-style approach
          the budget screen already uses for its date fields. */}
      <style>{`
        .kalas-inline-time::-webkit-calendar-picker-indicator { display: none; }
        .kalas-inline-time::-webkit-datetime-edit { color: inherit; }
      `}</style>
    </motion.div>
  );
}

/** "You are here", drawn where the clock actually falls between two moments. */
function NowMarker({ clock, label }: { clock: string; label: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-[4.6rem] shrink-0 pr-1 text-right text-[0.7rem] font-bold tabular-nums text-[var(--color-terracotta)]">
        {clock}
      </span>
      <span className="relative z-10 flex w-6 shrink-0 justify-center">
        <motion.span
          className="size-2.5 rounded-full bg-[var(--color-terracotta)] ring-4 ring-card"
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
      <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--color-terracotta)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--color-terracotta)]/25" />
    </div>
  );
}

/** A figure with its label above it, so the summary strip reads without
 *  being decoded. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="text-[0.82rem] text-ink-soft tabular-nums">{children}</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-full text-[0.62rem] font-bold uppercase tracking-[0.14em] text-faint sm:w-auto sm:min-w-[7.5rem]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[0.72rem] transition-colors cursor-pointer',
        active
          ? 'border-ink bg-ink text-canvas'
          : 'border-line bg-shell text-ink-soft hover:border-ink hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
