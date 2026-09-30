"use client";

/* Bordplan — the seating chart.
 *
 * It was a mock: a hardcoded roster of made-up Danes, tables that held a bag
 * of names rather than chairs, and no way to say who sits next to whom. What a
 * couple actually needs from this screen is a drawing they can hand to a
 * venue, so the plan now has real chairs and this is a canvas.
 *
 * One interaction, three ways in. Picking a guest up and putting them down is
 * the only verb: drag them, or click once to lift and once to drop, or tab to
 * them and press Enter twice. All three run through the same `pick`/`place`
 * pair, so the pointer path and the keyboard path can never drift apart — and
 * the click path is what makes this usable on a tablet, which is where a lot
 * of seating plans actually get argued over.
 *
 * All the seating logic lives in ./seating/model.ts and is unit-tested; this
 * file is the surface. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Plus, Minus, Trash2, Printer, Circle, RectangleHorizontal, Crown,
  Search, Maximize2, Users, X, CornerUpLeft, ChevronDown,
} from 'lucide-react';
import { Button, Dialog, Field, Page, PageHeader, PageLoader, cn, inputClass } from '../ui';
import { useLang } from '../i18n';
import { useWedding } from '../useWedding';
import { TableNode } from './seating/TableNode';
import { ElementNode, ELEMENT_ICON } from './seating/ElementNode';
import SeatCountDialog from './seating/SeatCountDialog';
import { DEFAULT_ZOOM, ZOOMS, fitZoom, planExtent, stepZoom } from './seating/zoom';
import { findFreeSpot, type Frame } from './seating/placement';
import { dietarySummary } from './guests/dietary';
import {
  MAX_SEATS, MIN_SEATS, SHAPES, changeShape, firstFreeSeat, freeSeats, initials,
  makeTable, pruneToGuests, readPlan, seatGuest, seatOf, seatedIds, setSeatCount,
  tableBounds, unseatGuest,
  ELEMENTS, ELEMENT_SIZES, addElement, makeElement, patchElement, removeElement, resizeElement, sizeOf,
  type FloorElementKind, type PlanGuest, type SeatingPlan, type TableShape,
} from './seating/model';

const SHAPE_ICON: Record<TableShape, typeof Circle> = {
  round: Circle,
  rect: RectangleHorizontal,
  head: Crown,
};

/* The scrollable plane starts near the size of the window rather than at a
   fixed 1500x1050. A plan with two tables on it used to leave most of a
   screen of empty grid to scroll through, and pushed the totals below the
   fold, the numbers a venue asks for should be on screen, not down there. */
const PLANE_MIN = { w: 880, h: 520 };
/** The canvas grows with the plan up to this, then scrolls. */
const CANVAS_MAX_H = 576;
const PLANE_PAD = 100;

export default function Seating() {
  const { t, tn } = useLang();
  const reduce = useReducedMotion();
  const { loading, guests, couple, seatingPlan, saveSeating } = useWedding();

  const [plan, setPlan] = useState<SeatingPlan>({ version: 2, tables: [] });
  const [held, setHeld] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ guestId: string; x: number; y: number } | null>(null);
  // A table or a floor element, never both: one thing is selected at a time.
  const [selected, setSelected] = useState<string | null>(null);
  // The table being renamed, and the name as it is being typed.
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // The shape whose seat count is being asked for, before the table exists.
  const [askingShape, setAskingShape] = useState<TableShape | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // The canvas's width, kept in state so adding a table can fit the zoom to it
  // from an event handler without reading the DOM there.
  const [canvasW, setCanvasW] = useState(800);
  // Where to scroll once a new zoom has reached the DOM, in canvas pixels.
  const [scrollTo, setScrollTo] = useState<{ left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [query, setQuery] = useState('');
  const [onlyUnseated, setOnlyUnseated] = useState(true);
  const [say, setSay] = useState('');
  /* The print sheet is portalled to <body>, which does not exist while this
     renders on the server, so it waits for the client. A one-shot mount flag
     is the whole point here; it cannot cascade, because nothing sets it back.
     eslint-disable-next-line react-hooks/set-state-in-effect */
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  /* ── The guest list, as the plan sees it ───────────────────────────── */
  const pool: PlanGuest[] = useMemo(() => guests.map((g) => ({
    id: g.id,
    name: g.name,
    group: g.side?.trim() || t('Gæster'),
    // Tags and free text together, so a guest whose needs were set with the
    // chips still shows a badge and still counts under Kostbehov.
    dietary: dietarySummary(g.dietary_tags, g.dietary) || null,
    // The RSVP values are Danish: afventer / ja / nej.
    attending: g.rsvp !== 'nej',
  })), [guests, t]);

  const byId = useMemo(() => new Map(pool.map((g) => [g.id, g])), [pool]);

  /* ── Load once, then autosave ──────────────────────────────────────── */
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || loading) return;
    hydrated.current = true;
    setPlan(readPlan(seatingPlan?.data));
  }, [loading, seatingPlan]);

  /* A guest deleted from the guest list must not keep a chair on the chart. */
  useEffect(() => {
    if (!hydrated.current || pool.length === 0) return;
    setPlan((p) => pruneToGuests(p, new Set(pool.map((g) => g.id))));
  }, [pool]);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = setTimeout(() => { void saveSeating(plan as unknown as Record<string, unknown>); }, 700);
    return () => clearTimeout(id);
  }, [plan, saveSeating]);

  /* ── Picking a guest up, and putting them down ─────────────────────── */

  const place = useCallback((guestId: string, tableId: string, index: number) => {
    setPlan((p) => seatGuest(p, guestId, tableId, index));
    setHeld(null);
    const g = byId.get(guestId);
    const table = plan.tables.find((x) => x.id === tableId);
    if (g && table) setSay(t('{name} sidder nu ved {table}.', { name: g.name, table: table.name }));
  }, [byId, plan.tables, t]);

  const lift = useCallback((guestId: string | null) => {
    setHeld(guestId);
    const g = guestId ? byId.get(guestId) : null;
    setSay(g ? t('{name} er valgt. Tryk på en stol for at sætte dem der.', { name: g.name }) : '');
  }, [byId, t]);

  const unseat = useCallback((guestId: string) => {
    setPlan((p) => unseatGuest(p, guestId));
    setHeld(null);
    const g = byId.get(guestId);
    if (g) setSay(t('{name} er tilbage på listen.', { name: g.name }));
  }, [byId, t]);

  /**
   * One gesture handler for both a guest chip and an occupied chair.
   *
   * A short press is a click — lift or drop. A press that travels is a drag,
   * and the drop is resolved with elementFromPoint against the `data-seat`
   * markers rather than any geometry of our own.
   */
  const startGesture = useCallback((guestId: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    let travelled = false;

    const move = (ev: PointerEvent) => {
      if (!travelled && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) {
        travelled = true;
        setHeld(guestId);
      }
      if (travelled) setDrag({ guestId, x: ev.clientX, y: ev.clientY });
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (!travelled) { lift(held === guestId ? null : guestId); return; }

      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const seat = under?.closest('[data-seat]') as HTMLElement | null;
      if (seat?.dataset.seat) {
        const [tableId, idx] = seat.dataset.seat.split(':');
        place(guestId, tableId, Number(idx));
        return;
      }
      // Dropped back on the list — that is how a guest leaves a table.
      if (under?.closest('[data-guest-rail]')) { unseat(guestId); return; }
      setHeld(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [held, lift, place, unseat]);

  /** Clicking a chair: drop what is in hand, or pick up who is sitting there. */
  const onSeatClick = useCallback((tableId: string, index: number) => {
    const table = plan.tables.find((x) => x.id === tableId);
    const sitting = table?.seated[index] ?? null;
    if (held) { place(held, tableId, index); return; }
    lift(sitting);
  }, [held, lift, place, plan.tables]);

  /* ── Moving a table ────────────────────────────────────────────────── */
  const startTableDrag = useCallback((tableId: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const start = plan.tables.find((x) => x.id === tableId);
    if (!start) return;
    const x0 = e.clientX, y0 = e.clientY;
    const ox = start.x, oy = start.y;

    const move = (ev: PointerEvent) => {
      // Pointer pixels are screen pixels; the plane is scaled, so undo it.
      const dx = (ev.clientX - x0) / zoom;
      const dy = (ev.clientY - y0) / zoom;
      setPlan((p) => ({
        ...p,
        tables: p.tables.map((tb) => (tb.id === tableId
          ? { ...tb, x: Math.max(120, ox + dx), y: Math.max(110, oy + dy) }
          : tb)),
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [plan.tables, zoom]);

  /* Something new on the plan that the current zoom cannot show: step out
     until the whole plan fits the canvas, then scroll the new thing into the
     middle. Worked out from the plan as it will be, so there is nothing to
     wait for but the new zoom reaching the DOM before the scroll. */
  /* Where a new piece of `size` goes. First into empty space the couple can
     already see, so the view stays exactly as they left it. The canvas grows
     with the plan up to CANVAS_MAX_H before it scrolls, so that is the height
     it can use. Only when that is full does it step the zoom out, one stop at
     a time from the same corner, and stop at the first that has room. Null
     when not even the furthest stop does. */
  const placeInView = (size: { w: number; h: number }): { spot: { x: number; y: number }; zoom: number } | null => {
    const el = canvasRef.current;
    if (!el) return null;
    const origin = { x: el.scrollLeft / zoom, y: el.scrollTop / zoom };
    for (const z of [zoom, ...ZOOMS.filter((s) => s < zoom).reverse()]) {
      const frame: Frame = { ...origin, w: el.clientWidth / z, h: (CANVAS_MAX_H - 8) / z };
      const spot = findFreeSpot(plan, size, frame);
      if (spot) return { spot, zoom: z };
    }
    return null;
  };

  /** Apply a placement's zoom, keeping the same corner of the plan in view. */
  const settleZoom = (z: number) => {
    const el = canvasRef.current;
    if (z === zoom || !el) return;
    const origin = { x: el.scrollLeft / zoom, y: el.scrollTop / zoom };
    setZoom(z);
    setScrollTo({ left: origin.x * z, top: origin.y * z });
  };

  const reveal = (next: SeatingPlan, at: { x: number; y: number }) => {
    const z = fitZoom(planExtent(next), { w: canvasW, h: CANVAS_MAX_H - 8 }, zoom);
    if (z !== zoom) setZoom(z);
    setScrollTo({ left: Math.max(0, at.x * z - canvasW / 2), top: Math.max(0, at.y * z - CANVAS_MAX_H / 2) });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setCanvasW(entry.contentRect.width));
    observer.observe(canvas);
    return () => observer.disconnect();
    // The canvas only exists once loading is over.
  }, [loading]);

  useEffect(() => {
    if (!scrollTo) return;
    const id = window.setTimeout(() => {
      canvasRef.current?.scrollTo({ ...scrollTo, behavior: reduce ? 'auto' : 'smooth' });
    }, 30);
    return () => window.clearTimeout(id);
  }, [scrollTo, reduce]);

  /* ── Moving a floor element ────────────────────────────────────────── */
  const startElementDrag = useCallback((id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const start = plan.elements?.find((x) => x.id === id);
    if (!start) return;
    const x0 = e.clientX, y0 = e.clientY;
    const ox = start.x, oy = start.y;
    const move = (ev: PointerEvent) => {
      setPlan((p) => patchElement(p, id, { x: ox + (ev.clientX - x0) / zoom, y: oy + (ev.clientY - y0) / zoom }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [plan.elements, zoom]);

  const addFloorElement = (kind: FloorElementKind) => {
    const spec = ELEMENTS.find((x) => x.id === kind)!;
    let el = makeElement(plan, kind, t(spec.label));
    const placed = placeInView({ w: el.w, h: el.h });
    if (placed) el = { ...el, ...placed.spot };
    setPlan((p) => addElement(p, el));
    setMoreOpen(false);
    setSelected(null);
    setSelectedEl(el.id);
    if (placed) settleZoom(placed.zoom);
    else reveal(addElement(plan, el), el);
  };

  const selectTable = (id: string | null) => { setSelected(id); setSelectedEl(null); };
  const selectElement = (id: string | null) => { setSelectedEl(id); setSelected(null); };

  /* ── Tables ────────────────────────────────────────────────────────── */
  const addTable = (shape: TableShape, seats: number) => {
    const n = plan.tables.filter((x) => x.shape !== 'head').length + 1;
    const name = shape === 'head' ? t('Brudebord') : t('Bord {n}', { n });
    let table = setSeatCount(makeTable(plan, shape, name), seats);
    const placed = placeInView(tableBounds(table));
    if (placed) table = { ...table, ...placed.spot };
    setPlan((p) => ({ ...p, tables: [...p.tables, table] }));
    selectTable(table.id);
    if (placed) settleZoom(placed.zoom);
    else reveal({ ...plan, tables: [...plan.tables, table] }, table);
  };


  const patchTable = (id: string, fn: (tb: SeatingPlan['tables'][number]) => SeatingPlan['tables'][number]) =>
    setPlan((p) => ({ ...p, tables: p.tables.map((tb) => (tb.id === id ? fn(tb) : tb)) }));

  const removeTable = (id: string) => {
    setPlan((p) => ({ ...p, tables: p.tables.filter((tb) => tb.id !== id) }));
    setSelected(null);
  };

  /* ── Derived ───────────────────────────────────────────────────────── */
  const seated = useMemo(() => seatedIds(plan), [plan]);
  const unseatedGuests = pool.filter((g) => !seated.has(g.id));
  const totalSeats = plan.tables.reduce((n, tb) => n + tb.seats, 0);
  const dietaryCount = pool.filter((g) => g.dietary).length;
  const activeTable = plan.tables.find((tb) => tb.id === selected) ?? null;
  const activeElement = plan.elements?.find((el) => el.id === selectedEl) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool
      .filter((g) => (onlyUnseated ? !seated.has(g.id) : true))
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q));
  }, [pool, onlyUnseated, seated, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlanGuest[]>();
    for (const g of visible) map.set(g.group, [...(map.get(g.group) ?? []), g]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'da'));
  }, [visible]);

  /** The plane has to cover every table, chairs and labels included. */
  const plane = useMemo(() => {
    let w = PLANE_MIN.w, h = PLANE_MIN.h;
    for (const tb of plan.tables) {
      const b = tableBounds(tb);
      w = Math.max(w, tb.x + b.w / 2 + PLANE_PAD);
      h = Math.max(h, tb.y + b.h / 2 + PLANE_PAD);
    }
    for (const el of plan.elements ?? []) {
      w = Math.max(w, el.x + el.w / 2 + PLANE_PAD);
      h = Math.max(h, el.y + el.h / 2 + PLANE_PAD);
    }
    return { w, h };
  }, [plan.tables, plan.elements]);

  /* Escape drops whatever is in hand — the way out of every modal state. */
  useEffect(() => {
    if (!held) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') lift(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [held, lift]);

  /* A4 landscape at 96dpi, less a 12mm margin, is about 1000x660 usable. */
  const printScale = Math.min(1, 1000 / plane.w, 660 / plane.h);

  const printPlan = () => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 landscape; margin: 12mm; }';
    document.head.appendChild(style);
    // Two frames: one for the style to land, one for layout to settle.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      style.remove();
    }));
  };

  const heldGuest = held ? byId.get(held) ?? null : null;
  const dragGuest = drag ? byId.get(drag.guestId) ?? null : null;

  if (loading) return <PageLoader />;

  const saveRename = () => {
    const name = renaming?.name.trim();
    if (renaming && name) patchTable(renaming.id, (x) => ({ ...x, name }));
    setRenaming(null);
  };

  return (
    <Page>
      <PageHeader
        title={t('Bordplan')}
        subtitle={
          pool.length === 0
            ? t('Tilføj gæster på gæstelisten, så kan I sætte dem på plads her.')
            : unseatedGuests.length === 0
              ? tn(pool.length, 'Gæsten har en plads.', 'Alle {n} gæster har en plads.')
              : t('{n} af {total} gæster har en plads.', { n: seated.size, total: pool.length })
        }
        guide="seating"
        actions={<Button variant="secondary" icon={Printer} onClick={printPlan}>{t('Udskriv')}</Button>}
      />

      {/* No breakpoint and no container query: plain wrapping flex.
          A media query measures the window, which this screen never gets (in
          chat mode it lives in a narrow stage beside Ava). A container query
          measures the right box but needs a browser that supports it. Flex
          basis needs neither: the two columns sit side by side whenever their
          bases fit on one line, and the rail wraps under and goes full width
          when they do not. That is the same question, asked by the layout
          engine itself. */}
      <div className="flex min-h-0 flex-1 flex-wrap gap-4">
        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-[3_1_28rem] flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {SHAPES.map((s) => {
              const Icon = SHAPE_ICON[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAskingShape(s.id)}
                  title={t(s.hint)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[0.78rem] font-semibold text-muted transition-colors hover:border-ink hover:text-ink cursor-pointer"
                >
                  <Plus size={13} /> <Icon size={13} /> {t(s.label)}
                </button>
              );
            })}

            {/* Everything on the floor that is not a table. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3.5 text-[0.78rem] font-semibold transition-colors cursor-pointer',
                  moreOpen ? 'border-ink text-ink' : 'border-line text-muted hover:border-ink hover:text-ink',
                )}
              >
                <Plus size={13} /> {t('Mere')}
                <ChevronDown size={13} className={cn('transition-transform', moreOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.14 }}
                      className="absolute left-0 top-11 z-50 grid w-[18rem] grid-cols-2 gap-1 rounded-[18px] border border-line bg-white p-2 shadow-[0_16px_40px_-12px_rgba(20,26,19,0.25)]"
                    >
                      <p className="col-span-2 px-2 pb-1 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sage">
                        {t('Læg på planen')}
                      </p>
                      {ELEMENTS.map((el) => {
                        const Icon = ELEMENT_ICON[el.id];
                        return (
                          <button
                            key={el.id}
                            type="button"
                            role="menuitem"
                            onClick={() => addFloorElement(el.id)}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.8rem] text-ink transition-colors hover:bg-shell cursor-pointer"
                          >
                            <Icon size={14} className="shrink-0 text-sage-strong" aria-hidden /> {t(el.label)}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-white px-1">
              <button
                type="button"
                onClick={() => setZoom((z) => stepZoom(z, -1))}
                disabled={zoom <= ZOOMS[0]}
                aria-label={t('Zoom ud')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
              >
                <Minus size={14} />
              </button>
              <span className="w-11 text-center text-[0.72rem] font-semibold tabular-nums text-ink">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => stepZoom(z, 1))}
                disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
                aria-label={t('Zoom ind')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(DEFAULT_ZOOM)}
                title={t('Tilbage til standardvisning')}
                aria-label={t('Nulstil zoom')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* The plan itself */}
          <div
            ref={canvasRef}
            className="relative overflow-auto rounded-[28px] border border-line bg-paper"
            style={{
              // Hug the plan, but never take more of the page than this — the
              // totals underneath have to stay on screen.
              height: Math.max(320, Math.min(plane.h * zoom + 8, CANVAS_MAX_H)),
              backgroundImage:
                'radial-gradient(circle, rgba(196,191,174,0.5) 1px, transparent 1px)',
              backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            }}
          >
            {/* A CSS transform does not change layout size, so the scroll
                extent needs the scaled box; the inner plane keeps plan units
                so table coordinates stay honest at every zoom. */}
            <div className="relative" style={{ width: plane.w * zoom, height: plane.h * zoom }}>
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: plane.w, height: plane.h, transform: `scale(${zoom})` }}
            >
              {/* Under the tables, so a table dragged over the dance floor
                  stays on top and its chairs stay clickable. */}
              {(plan.elements ?? []).map((el) => (
                <ElementNode
                  key={el.id}
                  element={el}
                  selected={selectedEl === el.id}
                  onSelect={() => selectElement(el.id)}
                  onPointerDown={startElementDrag(el.id)}
                />
              ))}
              {plan.tables.map((tb) => (
                <TableNode
                  key={tb.id}
                  table={tb}
                  guests={byId}
                  held={held}
                  selected={selected === tb.id}
                  onSelect={() => selectTable(tb.id)}
                  onSeatClick={(i) => onSeatClick(tb.id, i)}
                  onSeatPointerDown={(gid, e) => startGesture(gid)(e)}
                  onTablePointerDown={startTableDrag(tb.id)}
                  onRename={() => setRenaming({ id: tb.id, name: tb.name })}
                />
              ))}
            </div>
            </div>

            {plan.tables.length === 0 && (plan.elements ?? []).length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-wash">
                  <Circle size={22} className="text-ink" />
                </span>
                <p className="max-w-[22rem] text-[0.9rem] leading-relaxed text-muted">
                  {t('Læg det første bord ud, så kan I trække gæsterne på plads.')}
                </p>
              </div>
            )}
          </div>

          {/* ── Selected table ───────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {activeTable && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3"
              >
                <span className="font-serif text-[1.05rem] text-ink">{activeTable.name}</span>

                <div className="flex items-center gap-1">
                  {SHAPES.map((s) => {
                    const Icon = SHAPE_ICON[s.id];
                    const on = activeTable.shape === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patchTable(activeTable.id, (x) => changeShape(x, s.id))}
                        aria-pressed={on}
                        aria-label={t(s.label)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer',
                          on ? 'border-ink bg-sage-wash text-ink'
                            : 'border-line text-muted hover:border-ink hover:text-ink',
                        )}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 rounded-full border border-line px-1">
                  <button
                    type="button"
                    onClick={() => patchTable(activeTable.id, (x) => setSeatCount(x, x.seats - 1))}
                    disabled={activeTable.seats <= MIN_SEATS}
                    aria-label={t('Færre pladser')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-16 text-center text-[0.74rem] font-semibold text-ink">
                    {t('{n} pl.', { n: activeTable.seats })}
                  </span>
                  <button
                    type="button"
                    onClick={() => patchTable(activeTable.id, (x) => setSeatCount(x, x.seats + 1))}
                    disabled={activeTable.seats >= MAX_SEATS}
                    aria-label={t('Flere pladser')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <span className="text-[0.76rem] text-sage">
                  {t('{n} ledige', { n: freeSeats(activeTable) })}
                </span>

                <button
                  type="button"
                  onClick={() => removeTable(activeTable.id)}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.76rem] font-semibold text-terracotta transition-colors hover:bg-terracotta-tint cursor-pointer"
                >
                  <Trash2 size={13} /> {t('Fjern bord')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t('Luk')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sage hover:text-ink cursor-pointer"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selected floor element ───────────────────────────────── */}
          <AnimatePresence initial={false}>
            {activeElement && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3"
              >
                {(() => { const Icon = ELEMENT_ICON[activeElement.kind]; return <Icon size={15} className="text-sage-strong" aria-hidden />; })()}
                <input
                  key={activeElement.id}
                  defaultValue={activeElement.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== activeElement.label) setPlan((p) => patchElement(p, activeElement.id, { label: v }));
                    else e.target.value = activeElement.label;
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  aria-label={t('Navn')}
                  className="h-8 min-w-0 flex-[0_1_12rem] rounded-full border border-line bg-paper px-3 font-serif text-[1rem] text-ink focus:border-ink focus:outline-none"
                />

                <div className="flex items-center gap-1" role="group" aria-label={t('Størrelse')}>
                  {ELEMENT_SIZES.map((sz) => {
                    const on = sizeOf(activeElement) === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setPlan((p) => resizeElement(p, activeElement.id, sz.id))}
                        aria-pressed={on}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full border text-[0.72rem] font-bold transition-colors cursor-pointer',
                          on ? 'border-ink bg-sage-wash text-ink'
                            : 'border-line text-muted hover:border-ink hover:text-ink',
                        )}
                      >
                        {sz.id}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => { setPlan((p) => removeElement(p, activeElement.id)); setSelectedEl(null); }}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.76rem] font-semibold text-terracotta transition-colors hover:bg-terracotta-tint cursor-pointer"
                >
                  <Trash2 size={13} /> {t('Fjern fra planen')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEl(null)}
                  aria-label={t('Luk')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sage hover:text-ink cursor-pointer"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Guest rail ─────────────────────────────────────────────── */}
        <aside
          data-guest-rail
          className="flex min-w-0 flex-[1_1_16rem] flex-col rounded-[28px] border border-line bg-white"
        >
          <div className="border-b border-line-soft p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sage">
                {t('Gæster')}
              </p>
              <p className="text-[0.72rem] font-semibold text-ink">
                {t('{n} uden plads', { n: unseatedGuests.length })}
              </p>
            </div>

            <div className="mt-3 flex h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-3">
              <Search size={13} className="shrink-0 text-sage" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Søg efter en gæst')}
                aria-label={t('Søg efter en gæst')}
                className="h-full w-full min-w-0 bg-transparent text-[0.8rem] text-ink placeholder:text-faint focus:outline-none"
              />
            </div>

            <div className="mt-2.5 flex gap-1.5">
              {[
                { id: true, label: t('Uden plads') },
                { id: false, label: t('Alle') },
              ].map((o) => (
                <button
                  key={String(o.id)}
                  type="button"
                  onClick={() => setOnlyUnseated(o.id)}
                  aria-pressed={onlyUnseated === o.id}
                  className={cn(
                    'h-8 flex-1 rounded-full border text-[0.76rem] font-semibold transition-colors cursor-pointer',
                    onlyUnseated === o.id
                      ? 'border-ink bg-sage-wash text-ink'
                      : 'border-line text-muted hover:border-ink hover:text-ink',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:max-h-[clamp(21rem,50vh,36rem)]">
            {heldGuest && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-sage-wash px-3 py-2.5">
                <CornerUpLeft size={13} className="shrink-0 text-ink" />
                <p className="min-w-0 flex-1 text-[0.76rem] leading-snug text-ink">
                  {t('Tryk på en ledig stol for at sætte {name}.', { name: heldGuest.name })}
                </p>
                <button
                  type="button"
                  onClick={() => lift(null)}
                  aria-label={t('Annuller')}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {grouped.length === 0 && (
              <p className="px-2 py-8 text-center text-[0.82rem] text-muted">
                {pool.length === 0
                  ? t('Ingen gæster endnu.')
                  : query.trim()
                    ? t('Ingen gæster matcher "{query}"', { query: query.trim() })
                    : t('Alle har fået en plads.')}
              </p>
            )}

            {grouped.map(([group, list]) => (
              <div key={group} className="mb-4">
                <p className="mb-1.5 px-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sage">
                  {group} · {list.length}
                </p>
                <div className="flex flex-col gap-1">
                  {list.map((g) => {
                    const at = seatOf(plan, g.id);
                    const table = at ? plan.tables.find((x) => x.id === at.tableId) : null;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onPointerDown={startGesture(g.id)}
                        onClick={() => lift(held === g.id ? null : g.id)}
                        aria-pressed={held === g.id}
                        className={cn(
                          'flex w-full cursor-grab items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors active:cursor-grabbing',
                          held === g.id
                            ? 'border-ink bg-sage-wash'
                            : 'border-transparent hover:border-line hover:bg-paper',
                          !g.attending && 'opacity-55',
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-tint text-[0.6rem] font-bold text-ink">
                          {initials(g.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.82rem] text-ink">{g.name}</span>
                          {table && (
                            <span className="block truncate text-[0.68rem] text-sage">{table.name}</span>
                          )}
                        </span>
                        {g.dietary && (
                          <span
                            title={g.dietary}
                            className="h-2 w-2 shrink-0 rounded-full bg-terracotta"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Fill the rest of a table in one go, when that is what is wanted. */}
          {activeTable && unseatedGuests.length > 0 && freeSeats(activeTable) > 0 && (
            <div className="border-t border-line-soft p-3">
              <button
                type="button"
                onClick={() => {
                  setPlan((p) => {
                    let next = p;
                    for (const g of unseatedGuests) {
                      const tb = next.tables.find((x) => x.id === activeTable.id);
                      const free = tb ? firstFreeSeat(tb) : -1;
                      if (free === -1) break;
                      next = seatGuest(next, g.id, activeTable.id, free);
                    }
                    return next;
                  });
                  setSay(t('Pladserne ved {table} er fyldt op.', { table: activeTable.name }));
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[0.78rem] font-bold text-paper transition-opacity hover:opacity-90 cursor-pointer"
              >
                <Users size={14} />
                {t('Fyld {table} op', { table: activeTable.name })}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ── The numbers a venue asks for ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        <Stat label={t('Borde')} value={plan.tables.length} />
        <Stat label={t('Pladser')} value={totalSeats} />
        <Stat label={t('Placeret')} value={seated.size} />
        <Stat label={t('Kostbehov')} value={dietaryCount} tone="clay" />
      </div>

      {/* What a screen reader hears when a guest is picked up or put down. */}
      <p aria-live="polite" className="sr-only">{say}</p>

      {/* The printed chart. Its own sheet at <body> level, so what comes out
          of the printer is the plan and nothing around it. */}
      {mounted && createPortal(
        <div className="kalas-print-sheet theme-kalas hidden bg-white font-sans text-ink">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <p className="font-serif text-[1.4rem]">
              {couple.a && couple.b ? `${couple.a} & ${couple.b}` : t('Bordplan')}
            </p>
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">
              {couple.dateLabel || t('Bordplan')}
            </p>
          </div>
          <div
            className="relative mx-auto mt-4 origin-top"
            style={{ width: plane.w, height: plane.h * printScale, transform: `scale(${printScale})` }}
          >
            <div className="relative" style={{ width: plane.w, height: plane.h }}>
              {(plan.elements ?? []).map((el) => (
                <ElementNode key={el.id} element={el} selected={false} onSelect={() => {}} onPointerDown={() => {}} />
              ))}
              {plan.tables.map((tb) => (
                <TableNode
                  key={tb.id}
                  table={tb}
                  guests={byId}
                  held={null}
                  selected={false}
                  onSelect={() => {}}
                  onSeatClick={() => {}}
                  onSeatPointerDown={() => {}}
                  onTablePointerDown={() => {}}
                  onRename={() => {}}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {askingShape && (
        <SeatCountDialog
          shape={askingShape}
          onCancel={() => setAskingShape(null)}
          onConfirm={(seats) => { addTable(askingShape, seats); setAskingShape(null); }}
        />
      )}

      {/* The guest under the cursor while dragging. */}
      {drag && dragGuest && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-ink shadow-[0_8px_24px_rgba(18,51,43,0.18)]"
          style={{ left: drag.x, top: drag.y }}
        >
          {dragGuest.name}
        </div>
      )}

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t('Navn på bordet')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>{t('Annuller')}</Button>
            <Button onClick={saveRename} disabled={!renaming?.name.trim()}>{t('Gem')}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); saveRename(); }}>
          <Field label={t('Navn på bordet')}>
            <input
              className={inputClass}
              value={renaming?.name ?? ''}
              onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
              data-autofocus
            />
          </Field>
        </form>
      </Dialog>
    </Page>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'clay' }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sage">{label}</p>
      <p className={cn(
        'mt-1 font-serif text-[1.6rem] leading-none',
        tone === 'clay' ? 'text-terracotta' : 'text-ink',
      )}>
        {value}
      </p>
    </div>
  );
}
