import * as React from 'react';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Plus, Trash2, User, X } from 'lucide-react';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import type { DayProgramItemRow } from '@/lib/db/types';
import {
  MIN_BLOCK_MIN, calendarRange, formatDuration, layoutLanes, snapMinutes, sortKey, statusOf, toHHMM,
} from './dayProgram';

/** How tall a minute is on the calendar. An eleven-hour day is ~780px. */
const PX = 1.2;
/** Room on the left for the hour labels. */
const GUTTER = 48;

export const OWNERS = ['Fotograf', 'Toastmaster', 'Catering', 'Musik/DJ', 'Præst', 'Venue', 'Os selv'];
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

type Patch = Partial<Pick<DayProgramItemRow, 'time' | 'title' | 'subtitle' | 'duration_min' | 'owner' | 'notes'>>;
type NewItem = { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null; notes?: string | null };

/** "14:00" as the programme writes it: 14.00. */
const clockLabel = (hhmm: string) => hhmm.replace(':', '.');

/**
 * The wedding day as a calendar: the hours down the side, each moment a
 * block as long as it lasts, so the shape of the day (the long dinner, the
 * gap before the first dance, the two things planned for the same hour) is
 * there at a glance. A block is dragged to move it, its lower edge to make it
 * longer or shorter, both in five-minute steps; a click opens it to edit,
 * and a click on an empty hour adds a moment there.
 */
export default function DayCalendar({
  items, clock, isToday, onAdd, onUpdate, onDelete, onDuplicate, onShift,
}: {
  /** Sorted along the day (sortByTime). */
  items: DayProgramItemRow[];
  clock: string;
  isToday: boolean;
  onAdd: (item: NewItem) => void | Promise<unknown>;
  onUpdate: (id: string, patch: Patch) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: DayProgramItemRow) => void;
  /** Move `items[index]` and everything after it by `delta` minutes. */
  onShift: (index: number, delta: number) => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState<{ mode: 'edit'; id: string } | { mode: 'new'; time: string } | null>(null);
  const [drag, setDrag] = useState<{
    id: string; kind: 'move' | 'resize'; startY: number; origStart: number; origDur: number;
    start: number; dur: number; moved: boolean;
  } | null>(null);
  const pointerType = useRef<string>('mouse');
  const gridRef = useRef<HTMLDivElement>(null);

  const range = calendarRange(items);
  const height = (range.to - range.from) * PX;
  const lanes = layoutLanes(items);
  const hours: number[] = [];
  for (let m = range.from; m <= range.to; m += 60) hours.push(m);

  const editItem = editing?.mode === 'edit' ? items.find((i) => i.id === editing.id) ?? null : null;
  const editIndex = editItem ? items.indexOf(editItem) : -1;

  /* ── Adding at a time ───────────────────────────────────────────────── */
  const minuteAt = (clientY: number) => {
    const top = gridRef.current?.getBoundingClientRect().top ?? 0;
    return snapMinutes(range.from + (clientY - top) / PX, 15);
  };

  /* ── Dragging ───────────────────────────────────────────────────────── */
  function startDrag(e: React.PointerEvent, item: DayProgramItemRow, kind: 'move' | 'resize') {
    pointerType.current = e.pointerType;
    // A finger scrolls the page; on a phone a tap opens the moment instead.
    if (e.pointerType === 'touch' && kind === 'move') return;
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    const start = sortKey(item.time);
    setDrag({ id: item.id, kind, startY: e.clientY, origStart: start, origDur: item.duration_min || 0, start, dur: item.duration_min || 0, moved: false });
  }
  function moveDrag(e: React.PointerEvent) {
    if (!drag) return;
    const dMin = (e.clientY - drag.startY) / PX;
    if (drag.kind === 'move') {
      setDrag({ ...drag, start: snapMinutes(drag.origStart + dMin), moved: drag.moved || Math.abs(dMin) >= 3 });
    } else {
      setDrag({ ...drag, dur: Math.max(5, snapMinutes(drag.origDur + dMin)), moved: true });
    }
  }
  function endDrag(item: DayProgramItemRow) {
    if (!drag) return;
    if (drag.kind === 'move') {
      if (drag.moved && drag.start !== drag.origStart) onUpdate(item.id, { time: toHHMM(drag.start) });
      else if (!drag.moved) setEditing({ mode: 'edit', id: item.id });
    } else if (drag.dur !== drag.origDur) {
      onUpdate(item.id, { duration_min: drag.dur });
    }
    setDrag(null);
  }

  const nowKey = sortKey(clock);
  const showNow = isToday && nowKey >= range.from && nowKey <= range.to;

  return (
    // Full width until a moment is open; then the panel takes the right side.
    <div className={cn('mt-6', editing && 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8')}>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing({ mode: 'new', time: nextFreeTime(items) })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-[0.8rem] font-semibold text-ink transition-colors hover:bg-shell cursor-pointer">
            <Plus size={14} aria-hidden /> {t('Tilføj punkt')}
          </button>
          <p className="hidden text-[12px] text-muted sm:block">
            {t('Træk for at flytte · klik på et tidspunkt for at tilføje')}
          </p>
        </div>

        <div ref={gridRef} className="relative select-none" style={{ height: height + 8 }}>
          {/* The hours */}
          {hours.map((m) => (
            <div key={m} aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: (m - range.from) * PX }}>
              <span className="shrink-0 -translate-y-px pr-2 text-right text-[11px] font-semibold tabular-nums text-muted" style={{ width: GUTTER }}>
                {clockLabel(toHHMM(m))}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
          {hours.slice(0, -1).map((m) => (
            <span key={`h${m}`} aria-hidden className="pointer-events-none absolute right-0 h-px bg-line/50"
              style={{ top: (m + 30 - range.from) * PX, left: GUTTER }} />
          ))}

          {/* An empty hour is where a new moment goes */}
          <button
            type="button"
            aria-label={t('Tilføj et punkt på et tidspunkt')}
            onClick={(e) => setEditing({ mode: 'new', time: toHHMM(minuteAt(e.clientY)) })}
            className="absolute bottom-0 right-0 top-0 cursor-copy rounded-xl focus-visible:bg-shell/60"
            style={{ left: GUTTER }}
          />

          {items.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-[13px] text-muted" style={{ paddingLeft: GUTTER }}>
              {t('Klik på et tidspunkt for at tilføje det første punkt')}
            </p>
          )}

          {/* The moments */}
          {items.map((item, i) => {
            const status = statusOf(items, i, clock, isToday);
            const live = drag?.id === item.id ? drag : null;
            const start = live && live.kind === 'move' ? live.start : sortKey(item.time);
            const dur = live && live.kind === 'resize' ? live.dur : item.duration_min || 0;
            const h = Math.max(dur, MIN_BLOCK_MIN) * PX;
            const lane = lanes.get(item.id) ?? { lane: 0, lanes: 1 };
            const selected = editing?.mode === 'edit' && editing.id === item.id;
            const span = dur > 0 ? `${clockLabel(toHHMM(start))}–${clockLabel(toHHMM(start + dur))}` : clockLabel(toHHMM(start));
            const roomy = h >= 58;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${span} ${t(item.title)}${item.owner ? `, ${t(item.owner)}` : ''}`}
                aria-pressed={selected}
                onPointerDown={(e) => startDrag(e, item, 'move')}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(item)}
                onPointerCancel={() => setDrag(null)}
                onClick={() => { if (pointerType.current === 'touch') setEditing({ mode: 'edit', id: item.id }); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing({ mode: 'edit', id: item.id }); }
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const step = (e.shiftKey ? 15 : 5) * (e.key === 'ArrowUp' ? -1 : 1);
                    onUpdate(item.id, { time: toHHMM(sortKey(item.time) + step) });
                  }
                }}
                className={cn(
                  'group absolute overflow-hidden rounded-xl border px-2.5 py-1.5 text-left outline-none transition-shadow',
                  status === 'now' ? 'border-ink bg-ink text-canvas'
                    : status === 'done' ? 'border-line bg-shell text-muted'
                    : 'border-sage-tint bg-[#eef3f0] text-ink hover:shadow-[0_6px_18px_rgba(36,65,58,0.12)]',
                  selected && 'ring-2 ring-ink ring-offset-2 ring-offset-card',
                  live ? 'z-20 cursor-grabbing shadow-[0_10px_28px_rgba(36,65,58,0.22)]' : 'cursor-grab',
                  'focus-visible:ring-2 focus-visible:ring-sage-strong',
                )}
                style={{
                  top: (start - range.from) * PX + 1,
                  height: h - 2,
                  left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${lane.lane / lane.lanes})`,
                  width: `calc((100% - ${GUTTER}px) / ${lane.lanes} - 6px)`,
                }}
              >
                {roomy ? (
                  <>
                    <p className={cn('text-[11px] font-semibold tabular-nums', status === 'now' ? 'text-canvas/75' : 'text-muted')}>
                      {span}{dur > 0 && ` · ${formatDuration(dur)}`}
                    </p>
                    <p className="truncate font-serif text-[1rem] leading-snug">{t(item.title)}</p>
                    {h >= 80 && (item.owner || item.subtitle) && (
                      <p className={cn('mt-0.5 flex items-center gap-1.5 truncate text-[12px]', status === 'now' ? 'text-canvas/75' : 'text-ink-soft')}>
                        {item.owner && <><User size={11} aria-hidden /> {t(item.owner)}</>}
                        {item.owner && item.subtitle && <span aria-hidden>·</span>}
                        {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="truncate text-[12px] leading-5">
                    <span className="font-semibold tabular-nums">{clockLabel(toHHMM(start))}</span>{' '}
                    <span className="font-serif text-[0.95rem]">{t(item.title)}</span>
                  </p>
                )}
                {/* The lower edge: drag to make it longer or shorter */}
                <span
                  aria-hidden
                  onPointerDown={(e) => startDrag(e, item, 'resize')}
                  className="absolute inset-x-3 bottom-0 h-2 cursor-ns-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 before:absolute before:inset-x-1/3 before:bottom-0.5 before:h-0.5 before:rounded-full before:bg-current before:opacity-40"
                />
              </div>
            );
          })}

          {/* Where the day is, on the day */}
          {showNow && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowKey - range.from) * PX }}>
              <span className="shrink-0 pr-1.5 text-right text-[11px] font-bold tabular-nums text-terracotta" style={{ width: GUTTER }}>
                {clockLabel(clock)}
              </span>
              <span className="size-2 -ml-1 rounded-full bg-terracotta" />
              <span className="h-0.5 flex-1 bg-terracotta/60" />
            </div>
          )}
        </div>
      </div>

      {/* ── The moment being edited, or a new one ─────────────────────────
          Beside the day on a wide screen, as a sheet from below on a phone. */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditing(null)}
              className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            />
            <motion.aside
              key={editing.mode === 'edit' ? editing.id : `new${editing.time}`}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-line bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(20,26,19,0.18)] lg:sticky lg:top-4 lg:z-auto lg:max-h-none lg:rounded-[22px] lg:p-5 lg:shadow-none"
            >
              {editing.mode === 'edit' && editItem ? (
                <EditMoment
                  item={editItem}
                  onUpdate={(patch) => onUpdate(editItem.id, patch)}
                  onShift={(d) => onShift(editIndex, d)}
                  onDuplicate={() => onDuplicate(editItem)}
                  onDelete={() => { onDelete(editItem.id); setEditing(null); }}
                  onClose={() => setEditing(null)}
                />
              ) : editing.mode === 'new' ? (
                <NewMoment
                  time={editing.time}
                  onAdd={async (m) => { await onAdd(m); setEditing(null); }}
                  onClose={() => setEditing(null)}
                />
              ) : null}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Right after the day's current end, where the next moment usually goes. */
function nextFreeTime(items: DayProgramItemRow[]): string {
  const last = items[items.length - 1];
  if (!last) return '14:00';
  return toHHMM(sortKey(last.time) + (last.duration_min || 60));
}

const fieldCls = 'w-full min-w-0 rounded-xl border border-line bg-shell px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-sage-strong focus:outline-none sm:text-[0.9rem]';

function EditMoment({ item, onUpdate, onShift, onDuplicate, onDelete, onClose }: {
  item: DayProgramItemRow;
  onUpdate: (patch: Patch) => void;
  onShift: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <input
          defaultValue={t(item.title)}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t(item.title)) onUpdate({ title: v }); }}
          aria-label={t('Titel')}
          className="min-w-0 flex-1 rounded-lg bg-transparent font-serif text-[1.35rem] leading-tight text-ink focus:bg-shell focus:outline-none"
        />
        <button type="button" onClick={onClose} aria-label={t('Luk')}
          className="shrink-0 rounded-full p-1.5 text-muted hover:bg-shell hover:text-ink cursor-pointer"><X size={16} /></button>
      </div>

      <Field label={t('Tidspunkt')}>
        <input type="time" defaultValue={item.time} key={item.time}
          onBlur={(e) => { if (e.target.value && e.target.value !== item.time) onUpdate({ time: e.target.value }); }}
          className={cn(fieldCls, 'w-32 tabular-nums [color-scheme:light]')} />
      </Field>
      <Field label={t('Varighed')}>
        {DURATIONS.map((d) => (
          <Chip key={d} active={item.duration_min === d} onClick={() => onUpdate({ duration_min: item.duration_min === d ? 0 : d })}>
            {formatDuration(d)}
          </Chip>
        ))}
      </Field>
      <Field label={t('Ansvarlig')}>
        {OWNERS.map((o) => (
          <Chip key={o} active={item.owner === o} onClick={() => onUpdate({ owner: item.owner === o ? null : o })}>{t(o)}</Chip>
        ))}
      </Field>
      <Field label={t('Sted og detaljer')}>
        <input defaultValue={item.subtitle ?? ''} key={`s${item.id}`}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (item.subtitle ?? '')) onUpdate({ subtitle: v || null }); }}
          placeholder={t('Sted, detaljer…')} className={fieldCls} />
      </Field>
      <Field label={t('Noter')}>
        <textarea rows={3} defaultValue={item.notes ?? ''} key={`n${item.id}`}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (item.notes ?? '')) onUpdate({ notes: v || null }); }}
          placeholder={t('Noter til leverandører — hvad skal der ske, og hvem gør hvad?')}
          className={cn(fieldCls, 'resize-none')} />
      </Field>
      <Field label={t('Ryk denne og alt efter')}>
        {[-15, -5, 5, 15].map((d) => (
          <Chip key={d} onClick={() => onShift(d)}>{d > 0 ? `+${d}` : d} {t('min')}</Chip>
        ))}
      </Field>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" onClick={onDuplicate}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink cursor-pointer">
          <Copy size={13} aria-hidden /> {t('Dublér')}
        </button>
        <button type="button" onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-terracotta hover:opacity-80 cursor-pointer">
          <Trash2 size={13} aria-hidden /> {t('Slet')}
        </button>
      </div>
    </div>
  );
}

function NewMoment({ time: initialTime, onAdd, onClose }: {
  time: string;
  onAdd: (m: NewItem) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(30);
  const [owner, setOwner] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const submit = () => {
    if (!title.trim()) { setMissing(true); return; }
    void onAdd({ time, title: title.trim(), duration_min: duration, owner });
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-[1.35rem] leading-tight text-ink">{t('Nyt punkt kl. {time}', { time: clockLabel(time) })}</p>
        <button type="button" onClick={onClose} aria-label={t('Luk')}
          className="shrink-0 rounded-full p-1.5 text-muted hover:bg-shell hover:text-ink cursor-pointer"><X size={16} /></button>
      </div>
      <Field label={t('Hvad sker der?')}>
        <input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setMissing(false); }}
          placeholder={t('Fx ceremoni, middag, første dans…')} className={fieldCls} />
        {missing && <p className="w-full text-[12px] text-terracotta">{t('Skriv først, hvad der sker kl. {time}.', { time: clockLabel(time) })}</p>}
      </Field>
      <Field label={t('Tidspunkt')}>
        <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)}
          className={cn(fieldCls, 'w-32 tabular-nums [color-scheme:light]')} />
      </Field>
      <Field label={t('Varighed')}>
        {DURATIONS.map((d) => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{formatDuration(d)}</Chip>)}
      </Field>
      <Field label={t('Ansvarlig')}>
        {OWNERS.map((o) => <Chip key={o} active={owner === o} onClick={() => setOwner(owner === o ? null : o)}>{t(o)}</Chip>)}
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink cursor-pointer">
          {t('Annuller')}
        </button>
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas hover:opacity-90 cursor-pointer">
          {t('Tilføj')}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[0.76rem] transition-colors cursor-pointer',
        active ? 'border-ink bg-ink text-canvas' : 'border-line bg-card text-ink-soft hover:border-ink hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
