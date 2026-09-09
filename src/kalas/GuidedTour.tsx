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
import { X, Play, Check } from 'lucide-react';
import { NAV, type ScreenId } from './Shell';
import { cn } from './ui';
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

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;
const CARD_W = 340;
const GAP = 18;
/** Room the "Tryk her" tag needs to the right of the target. */
const TAG_W = 104;
const EDGE = 16;

/* The card moves out of its own way. It used to sit wherever there was room
   next to the target, which meant it covered the budget it had just told them
   to look at — and once it covered the "Tryk her" tag, the one instruction on
   screen was hidden behind the thing giving it. Sides are tried in order and
   the first that clears both the target and the tag wins. */
function placeCard(box: Box, cardH: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - cardH - EDGE));
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - CARD_W - EDGE));

  const candidates = [
    // Right of the target, clear of the tag — the usual case for the nav rail.
    { left: box.left + box.width + TAG_W + GAP, top: box.top },
    // Under it, for a wide target like the hero.
    { left: box.left, top: box.top + box.height + GAP },
    // Over it.
    { left: box.left, top: box.top - cardH - GAP },
    // Left, for a target hard against the right edge.
    { left: box.left - CARD_W - GAP, top: box.top },
  ];

  for (const c of candidates) {
    const fits = c.left >= EDGE && c.left + CARD_W <= vw - EDGE
      && c.top >= EDGE && c.top + cardH <= vh - EDGE;
    if (fits) return { left: c.left, top: clampY(c.top) };
  }
  // Nothing clears it: bottom-right, as far from the target as the screen allows.
  return { left: clampX(vw - CARD_W - EDGE), top: clampY(vh - cardH - EDGE) };
}

export default function GuidedTour({
  params,
  onNavigate,
  onAskAva,
  onFinish,
  promptDoneTick = 0,
  chatMode = false,
  idx,
  setIdx,
}: {
  params: Partial<WalkthroughParams>;
  onNavigate: (s: ScreenId) => void;
  /** Runs a try-prompt for real: switches to chat mode and sends it. */
  onAskAva: (prompt: string) => void;
  /** Bumped when a prompt this tour handed over has finished running. */
  promptDoneTick?: number;
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

  /* Asking them to try something and then saying nothing when it works is the
     tour dropping the thread. Ava's answer is in the chat; this is the tour
     acknowledging it and moving on by itself, so they are not left wondering
     whether that counted. */
  const [done, setDone] = useState(false);
  const seenTick = useRef(promptDoneTick);
  useEffect(() => {
    if (promptDoneTick === seenTick.current) return;
    seenTick.current = promptDoneTick;
    setDone(true);
    const timer = window.setTimeout(() => {
      setDone(false);
      setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [promptDoneTick, setIdx]);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, [setIdx]);

  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  /* ── Spotlight the step's control, and let a click on it advance ───── */
  // The nav item is the target, so navigation happens because they clicked it —
  // not because we moved the page under them.
  useEffect(() => {
    const anchor = step.anchor;
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
        el.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        el.addEventListener('click', onClick);
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
    const onClick = () => advance();

    // A step with nothing to point at clears the last one's spotlight — on a
    // timer like everything else here, so no setState runs synchronously in
    // the effect body.
    if (!anchor) {
      timer = window.setTimeout(() => setBox(null), 0);
      return () => window.clearTimeout(timer);
    }

    const tick = () => { raf = requestAnimationFrame(tick); measure(); };
    raf = requestAnimationFrame(tick);
    timer = window.setInterval(measure, 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      el?.removeEventListener('click', onClick);
      anchorElRef.current = null;
    };
  }, [step.anchor, advance]);

  /* Opening the step's page is KalasRoot's job, not this component's. Done
     here it re-fired whenever the tour re-rendered or was re-mounted, which
     yanked the couple back to Hjem the moment they clicked something on the
     page themselves — pressing a checklist row went nowhere. */

  const onNext = () => {
    // Escape hatch: they didn't click the control, so take them there ourselves.
    if (step.page) navigateRef.current?.(step.page);
    advance();
  };

  const total = WALKTHROUGH_STEPS.length;
  const body = t(step.body, params as Record<string, string | number>);
  const title = t(step.title);

  // The nav owns its label, so the eyebrow and the "Tryk her" tag stay in step
  // with whatever the menu is called.
  const navLabel = NAV.find((n) => n.id === step.anchor)?.label;
  const eyebrow = navLabel ? t(navLabel) : t('Hjem');
  /* Both halves have to hold: the step must name a control, and it must have
     been found on screen. The step alone is not enough — chat mode on a phone
     hides the nav rail, and promising a "Tryk her" that is nowhere to be seen
     is worse than falling back to the button. The box alone is not enough
     either: it outlives its step by a frame, which left the last two steps —
     which point at nothing — still lighting up the previous target. */
  const pointing = Boolean(step.anchor) && box !== null;

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

  const placed = wide && box ? placeCard(box, cardH) : null;

  /* The tag rides on the right of its target, and flips under it when the
     target is wide enough to reach the edge — the hero does, and the tag was
     sitting off-screen where nobody could follow it. */
  const tag = box
    ? box.left + box.width + TAG_W + EDGE <= window.innerWidth
      ? { top: box.top + box.height / 2 - 14, left: box.left + box.width + 10, below: false }
      : { top: box.top + box.height + 8, left: Math.max(EDGE, box.left + 12), below: true }
    : null;

  const pct = Math.round(((idx + 1) / total) * 100);

  return (
    <>
      {pointing && box && (
        <div
          aria-hidden
          className="kalas-tour-spot pointer-events-none fixed z-40 rounded-[14px] border-2 border-sage-strong transition-all duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      {/* "Tryk her", welded to the control itself. The card explains; this
          says where the finger goes, and it travels with the target rather
          than describing its location in words. */}
      {pointing && tag && (
        <div
          className={cn(
            'pointer-events-none fixed z-40 flex transition-all duration-300',
            tag.below ? 'flex-col items-start' : 'items-center',
          )}
          style={{ top: tag.top, left: tag.left }}
        >
          <span
            className={cn(
              'h-0 w-0',
              tag.below
                ? 'ml-3 border-x-[6px] border-b-[7px] border-x-transparent'
                : 'border-y-[6px] border-r-[7px] border-y-transparent',
            )}
            style={tag.below
              ? { borderBottomColor: 'var(--color-ink)' }
              : { borderRightColor: 'var(--color-ink)' }}
          />
          {/* It says "press here", so pressing it has to work. It used to be
              decoration with pointer-events off, and a label that does nothing
              when you obey it is the worst thing on the screen. Pressing it
              presses the real control, so the app does exactly what it would
              have done — navigation included — and the tour moves on. */}
          <button
            type="button"
            onClick={() => {
              const el = anchorElRef.current;
              if (el) el.click();
              else advance();
            }}
            className="pointer-events-auto cursor-pointer rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-canvas shadow-[0_4px_14px_rgba(36,65,58,0.3)] transition-opacity hover:opacity-90"
          >
            {t('Tryk her')}
          </button>
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

        <h2 className="mt-2 font-serif text-[1.4rem] leading-tight text-ink">{title}</h2>

        <div aria-live="polite" className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          <RichText text={body} />
        </div>

        {done && (
          <p className="mt-4 flex items-center gap-2 rounded-full bg-sage-tint px-4 py-2.5 text-[13px] font-semibold text-sage-strong">
            <Check size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
            {t('Sådan — det er på plads. Vi går videre.')}
          </p>
        )}

        {!done && tries.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {tries.map((prompt) => {
              const filled = t(prompt, params as Record<string, string | number>);
              return (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    /* Open the page the prompt is about before sending it, so
                       the couple watches the board fill up instead of reading
                       that it happened. The agent navigates too, but only once
                       it has finished — that is twenty seconds of staring at
                       the wrong screen. */
                    if (step.page) navigateRef.current?.(step.page);
                    onAskAva(filled);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-sage-tint px-4 py-2.5 text-left text-[13px] font-semibold text-sage-strong transition-colors hover:bg-sage"
                >
                  <Play size={12} strokeWidth={2.5} className="shrink-0 fill-current" aria-hidden />
                  <span className="min-w-0">{filled}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onFinish(step.final ? (chatMode ? 'classic' : 'chat') : chatMode ? 'chat' : 'classic')}
            className="cursor-pointer text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
          >
            {step.final
              ? chatMode ? t('Skift til klassisk') : t('Prøv chat-tilstand')
              : t('Spring rundvisningen over')}
          </button>
          <button
            type="button"
            onClick={step.final ? () => onFinish(chatMode ? 'chat' : 'classic') : onNext}
            className="cursor-pointer rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {step.final ? t('Så er jeg klar') : pointing ? t('Spring dette trin over') : t('Videre')}
          </button>
        </div>
      </div>
    </>
  );
}
