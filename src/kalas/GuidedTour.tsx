"use client";

/* Ava's guided tour — the only one.
 *
 * There used to be a second walkthrough that narrated by dropping bubbles into
 * the chat, and since onboarding lands every couple in chat mode, that was the
 * one everybody actually met: a column of text, nothing pointed at. This one
 * anchors to the real interface instead — it spotlights the control the step
 * is about, says in so many words what to press, and advances when they press
 * it. "Videre" is the escape hatch, not the intended path; that is the
 * difference between a tour you read and one you do.
 *
 * Mounted in both shells, so the mode the couple happens to be in decides
 * nothing about whether they are shown around.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { X, MessageCircle, MousePointer2, ArrowRight } from 'lucide-react';
import { NAV, type ScreenId } from './Shell';
import { EDGE, placeCard, type Box } from './tourPlacement';
import { useLang } from './i18n';
import RichText from './chat/RichText';
import {
  WALKTHROUGH_STEPS,
  stepTries,
  type WalkthroughParams,
} from './walkthrough';

/** The visible element carrying this `data-tour` — the nav renders twice (sidebar + mobile). */
function findAnchor(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}


const PAD = 6;
/** How far the cursor sits from the spotlight's edge. */
const CURSOR_GAP = 10;

export default function GuidedTour({
  params,
  onNavigate,
  onFinish,
  fact = null,
  chatMode = false,
  idx,
  setIdx,
}: {
  params: Partial<WalkthroughParams>;
  onNavigate: (s: ScreenId) => void;
  /** One concrete line about this couple's wedding for the current step. */
  fact?: string | null;
  /* Step state is owned by the parent. Kept here it was re-read from storage
     whenever the couple changed mode, because that swaps which shell the tour
     is mounted under — which showed them the same step a second time. */
  idx: number;
  setIdx: Dispatch<SetStateAction<number>>;
  onFinish: (mode: 'chat' | 'classic') => void;
  /** Which mode the couple is in, so the last step offers them the other one. */
  chatMode?: boolean;
}) {
  const { t } = useLang();

  const step = WALKTHROUGH_STEPS[idx];
  const tries = stepTries(step, params);
  const [box, setBox] = useState<Box | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /* The element the step points at, so the tag can press it. */
  const anchorElRef = useRef<HTMLElement | null>(null);
  const [cardH, setCardH] = useState(260);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, [setIdx]);

  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  /* ── Spotlight the step's control, and let a click on it advance ───── */
  // The nav item is the target, so navigation happens because they clicked it —
  // not because we moved the page under them.
  const anchor = step.anchor;

  useEffect(() => {
    let el: HTMLElement | null = null;
    let raf = 0;
    let timer = 0;
    let last: Box | null = null;

    /* Re-measured continuously rather than once: the step arrives with a page
       change and a smooth scrollIntoView, and a single measurement lands
       before either has settled — which put the "Tryk her" tag a few hundred
       pixels above the control it points at.
       Driven by a frame loop while the tab is visible, and by a timer as well,
       because requestAnimationFrame does not fire in a background tab and the
       tour would otherwise come back from another tab with nothing lit up.
       Both paths write only when the rectangle actually changed. */
    const measure = () => {
      if (!el) {
        el = anchor ? findAnchor(anchor) : null;
        anchorElRef.current = el;
        if (!el) return;
        /* 'center', not 'nearest': the anchors are page regions now, and
           "nearest" for something already partly in view is no scroll at
           all — which left the step pointing off the bottom of the screen. */
        el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      const r = el.getBoundingClientRect();
      const next: Box = {
        top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2,
      };
      if (last && last.top === next.top && last.left === next.left
        && last.width === next.width && last.height === next.height) return;
      last = next;
      setBox(next);
    };

    // A step with nothing to point at clears the last one's spotlight — on a
    // timer like everything else here, so no setState runs synchronously in
    // the effect body.
    if (!anchor) {
      timer = window.setTimeout(() => setBox(null), 0);
      return () => window.clearTimeout(timer);
    }

    /* Measured straight away as well as on the loop. Waiting for the first
       interval tick meant that if anything re-ran this effect inside 250 ms —
       a re-render for any reason — the interval was cleared before it ever
       fired, and the spotlight stayed on the previous step's target for the
       rest of the tour. */
    const first = window.setTimeout(measure, 0);
    const tick = () => { raf = requestAnimationFrame(tick); measure(); };
    raf = requestAnimationFrame(tick);
    timer = window.setInterval(measure, 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(first);
      window.clearInterval(timer);
      anchorElRef.current = null;
    };
  }, [anchor, step.id]);

  /* Opening the step's page is KalasRoot's job, not this component's. Done
     here it re-fired whenever the tour re-rendered or was re-mounted, which
     yanked the couple back to Hjem the moment they clicked something on the
     page themselves — pressing a checklist row went nowhere. */


  const total = WALKTHROUGH_STEPS.length;
  const body = t(step.body, params as Record<string, string | number>);
  const title = t(step.title);

  /* The step's own label first, then the nav's — the anchors point at page
     content now, so "Hjem" as a blanket fallback was wrong for every one of
     them. The nav still owns its label where a step does point at it. */
  const navLabel = NAV.find((n) => n.id === anchor)?.label;
  const eyebrow = step.eyebrow ? t(step.eyebrow) : navLabel ? t(navLabel) : t('Hjem');
  /* Both halves have to hold: the step must name a control, and it must have
     been found on screen. The step alone is not enough — chat mode on a phone
     hides the nav rail, and promising a "Tryk her" that is nowhere to be seen
     is worse than falling back to the button. The box alone is not enough
     either: it outlives its step by a frame, which left the last two steps —
     which point at nothing — still lighting up the previous target. */
  const pointing = Boolean(anchor) && box !== null;

  /* Only the desktop layout follows the target; on a phone the card is a
     sheet above the bottom nav, so inline coordinates would fight the class. */
  const [wide, setWide] = useState(() => {
    try { return window.matchMedia('(min-width: 1024px)').matches; } catch { return false; }
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* Measured, not assumed: the card's height changes with the copy and with
     whether the step has a prompt to try, and placement that guesses it puts
     the card half off the bottom of the screen. */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = wide && box
    ? placeCard(box, cardH, { width: window.innerWidth, height: window.innerHeight })
    : null;

  /* The four panels that fence off everything except the target. With no
     target the whole screen is fenced, which is right: those steps have
     nothing to press but the card. */
  const blockers = (() => {
    const b = pointing && box ? box : null;
    const full = { top: 0, left: 0, right: 0, bottom: 0 } as const;
    if (!b) return { top: { ...full }, left: { display: 'none' }, right: { display: 'none' }, bottom: { display: 'none' } };
    return {
      top: { top: 0, left: 0, right: 0, height: Math.max(0, b.top), bottom: 'auto' },
      bottom: { top: b.top + b.height, left: 0, right: 0, bottom: 0 },
      left: { top: b.top, left: 0, width: Math.max(0, b.left), height: b.height },
      right: { top: b.top, left: b.left + b.width, right: 0, height: b.height },
    };
  })();

  /* The page behind must not scroll away from the thing being pointed at. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* The cursor sits just off the spotlight's edge — right of it when there is
     room, under it when the target reaches the edge, which the hero does. */
  const cursor = box
    ? box.left + box.width + 28 + EDGE <= window.innerWidth
      ? { top: box.top + box.height / 2 - 10, left: box.left + box.width + CURSOR_GAP }
      : { top: box.top + box.height + CURSOR_GAP, left: Math.max(EDGE, box.left + 12) }
    : null;

  const pct = Math.round(((idx + 1) / total) * 100);

  return (
    <>
      {/* Everything but the highlight is out of bounds. Four panels rather
          than one overlay with a hole: a hole punched with a mask still eats
          the clicks, and the whole point is that the control underneath stays
          pressable while the rest of the page does not. */}
      <div aria-hidden className="fixed inset-0 z-30" style={blockers.top} />
      <div aria-hidden className="fixed z-30" style={blockers.left} />
      <div aria-hidden className="fixed z-30" style={blockers.right} />
      <div aria-hidden className="fixed z-30" style={blockers.bottom} />

      {pointing && box && (
        <div
          aria-hidden
          data-tour-target={anchor}
          className="kalas-tour-spot pointer-events-none fixed z-40 rounded-[14px] border-2 border-sage-strong transition-all duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      {/* "Tryk her", welded to the control itself. The card explains; this
          says where the finger goes, and it travels with the target rather
          than describing its location in words. */}
      {/* A cursor, not a label. The tour opens the page itself, so telling
          them to press the menu button for the page they are already on was
          an instruction that did nothing when obeyed. This just points; the
          card's own button is what moves the tour on. */}
      {pointing && cursor && !step.final && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 transition-all duration-300"
          style={{ top: cursor.top, left: cursor.left }}
        >
          <MousePointer2
            size={20}
            className="kalas-tour-cursor -scale-x-100 text-ink"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(36,65,58,0.35))' }}
            fill="var(--color-canvas)"
          />
        </div>
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={t('Rundvisning')}
        className="fixed inset-x-4 bottom-24 z-50 overflow-hidden rounded-[20px] rule bg-card p-5 shadow-[0_14px_40px_rgba(36,65,58,0.18)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[352px]"
        style={placed ? { top: placed.top, left: placed.left, right: 'auto', bottom: 'auto' } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{eyebrow}</p>
          <div className="flex items-center gap-2">
            {/* How far in they are, as a ring rather than a number to read. */}
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(var(--color-sage-strong) ${pct}%, var(--color-line) 0)`,
              }}
            />
            <span className="sr-only">{t('{n} af {total}', { n: idx + 1, total })}</span>
            <button
              type="button"
              onClick={() => onFinish(chatMode ? 'chat' : 'classic')}
              aria-label={t('Spring rundvisningen over')}
              className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-ink"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <h2 className="mt-2 font-serif text-[1.4rem] leading-tight text-ink">
          {title}
        </h2>

        <div aria-live="polite" className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          <RichText text={body} />
        </div>

        {/* Their wedding, not the feature. Describing what a page is for is
            true of every couple and therefore about none of them; the next
            task with its date is something they did not already know, and it
            is on the screen behind the card. */}
        {fact && (
          <p className="mt-3 rounded-xl bg-shell px-3 py-2 text-[13px] leading-snug text-ink">
            {fact}
          </p>
        )}

        {/* An example of what they could ask, not a control. Firing a real
            agent turn from a button inside the tour meant the asking happened
            somewhere they could not see it; it belongs in the chat. */}
        {tries.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sage-tint px-4 py-2.5 text-[13px] leading-snug text-sage-strong">
            <MessageCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {t('Prøv at skrive:')}{' '}
              <span className="font-semibold">{t(tries[0], params as Record<string, string | number>)}</span>
            </span>
          </p>
        )}

        {/* The only way forward. The anchor used to be the advance button —
            but it points at page content now, where a click should do its own
            job. Without this the tour was a dead end whenever the anchor was
            not on screen, which is every nav-anchored step on a phone. */}
        {!step.final && (
          <button
            type="button"
            onClick={advance}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t('Videre')} <ArrowRight size={14} />
          </button>
        )}

        {/* The tour ends on a decision, not a dismissal. The two modes are a
            real fork in how the couple will use Kalas every day, and until
            now it was a text link next to a button — the choice was there,
            the difference was not. */}
        {step.final && (
          <div className="mt-5 flex flex-col gap-2">
            <p className="eyebrow">{t('Hvordan vil I helst arbejde?')}</p>
            <button
              type="button"
              onClick={() => onFinish('chat')}
              className="flex cursor-pointer flex-col gap-0.5 rounded-2xl rule bg-shell px-4 py-3 text-left transition-colors hover:border-ink"
            >
              <span className="text-[13px] font-semibold text-ink">{t('Med Ava ved siden af')}</span>
              <span className="text-[12.5px] leading-snug text-muted">
                {t('I skriver, hvad I vil have. Jeg søger på nettet, skriver til stederne, retter budgettet og åbner den rigtige side undervejs.')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onFinish('classic')}
              className="flex cursor-pointer flex-col gap-0.5 rounded-2xl rule bg-shell px-4 py-3 text-left transition-colors hover:border-ink"
            >
              <span className="text-[13px] font-semibold text-ink">{t('Klassisk, med menuen')}</span>
              <span className="text-[12.5px] leading-snug text-muted">
                {t('Alt ligger i menuen — venues, budget, gæster, hjemmeside. I styrer selv, og kan altid tilkalde mig.')}
              </span>
            </button>
            <p className="mt-1 text-[12px] text-muted">{t('I kan skifte når som helst oppe i hjørnet.')}</p>
          </div>
        )}
      </div>
    </>
  );
}
