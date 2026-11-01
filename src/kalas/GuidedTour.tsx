"use client";

/* Juno's guided tour — the only one, and she gives it herself: she hovers
 * over what she is saying, looks at the thing to press, and is pleased when
 * they press it.
 *
 * There used to be a second walkthrough that narrated by dropping bubbles into
 * the chat, and since onboarding opened on the chat, that was the
 * one everybody actually met: a column of text, nothing pointed at. This one
 * anchors to the real interface instead: it rings the menu item for the page
 * the step is about, and her card, bottom right, carries the one way forward.
 *
 * It ends on Hjem with Juno's panel open beside it.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import type { ScreenId } from './Shell';
import { useLang } from './i18n';
import RichText from './chat/RichText';
import { Juno } from '@/components/juno/Juno';
import {
  WALKTHROUGH_STEPS,
} from './walkthrough';

type Box = { top: number; left: number; width: number; height: number };

const noSubscription = () => () => {};

/** The visible button for a target: some render twice (the header's Juno
 *  button and the phone's bottom bar), and the hidden copy has no width. */
function findNavButton(page: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${page}"]`));
  return all.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

export default function GuidedTour({
  onNavigate,
  onFinish,
  idx,
  setIdx,
}: {
  onNavigate: (s: ScreenId) => void;
  /** One concrete line about this couple's wedding for the current step. */
  /* Step state is owned by the parent. Kept here it was re-read from storage
     whenever the couple changed mode, because that swaps which shell the tour
     is mounted under — which showed them the same step a second time. */
  idx: number;
  setIdx: Dispatch<SetStateAction<number>>;
  onFinish: () => void;
}) {
  const { t } = useLang();
  // The portal needs document.body: false on the server and while hydrating.
  const onClient = useSyncExternalStore(noSubscription, () => true, () => false);

  const step = WALKTHROUGH_STEPS[idx];

  // A step taken: she is pleased for a moment.
  const [glad, setGlad] = useState(false);
  const calm = useRef<number | undefined>(undefined);
  const cheer = useCallback(() => {
    setGlad(true);
    window.clearTimeout(calm.current);
    calm.current = window.setTimeout(() => setGlad(false), 1100);
  }, []);
  useEffect(() => () => window.clearTimeout(calm.current), []);

  const advance = useCallback(() => {
    cheer();
    setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, [setIdx, cheer]);
  const back = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, [setIdx]);

  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  /* What is ringed is the menu item for the page being described, so the
     couple can see where it lives. The Juno step rings her button instead,
     and there pressing it moves the tour on, since pressing it is the point
     of the step. Everywhere else the way forward is "Næste" on the card. */
  const target = step.target ?? step.page;
  const pressAdvances = Boolean(step.target);

  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    // Cleared on a timer, not synchronously: a setState in an effect body is
    // a cascading render, and the lint rule that catches it is right.
    if (!target) {
      const id = window.setTimeout(() => setBox(null), 0);
      return () => window.clearTimeout(id);
    }
    let el: HTMLElement | null = null;
    let raf = 0;
    let last: Box | null = null;

    /* Re-measured on a frame loop rather than once: the step arrives with a
       page change, and a single measurement lands before the layout settles —
       which used to leave the ring floating a few hundred pixels off. */
    const measure = () => {
      if (!el) {
        el = findNavButton(target);
        if (!el) return;
        /* The menu scrolls once it outgrows the window, and the button for a
           page near the bottom sits outside its visible strip — the ring was
           drawn at the button's geometric position, which is to say over the
           footer, pointing at nothing. 'nearest' scrolls the menu the minimum
           needed and leaves the page alone. Instant, because a smooth scroll
           here is silently dropped in at least one browser we run in. */
        el.scrollIntoView({ block: 'nearest' });
        if (pressAdvances) el.addEventListener('click', onClick);
      }
      const r = el.getBoundingClientRect();
      const next = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
      if (last && last.top === next.top && last.left === next.left
        && last.width === next.width && last.height === next.height) return;
      last = next;
      setBox(next);
    };
    // On the Juno step, their press on her real button moves the tour on.
    const onClick = () => advance();

    /* Three ways in, on purpose. requestAnimationFrame does not fire while
       the tab is in the background, so the interval is what brings the ring
       back when they return; and the immediate timeout means a re-render
       inside the first frame cannot leave the ring unset. Each writes only
       when the rectangle actually moved. */
    const first = window.setTimeout(measure, 0);
    const tick = () => { raf = requestAnimationFrame(tick); measure(); };
    raf = requestAnimationFrame(tick);
    const poll = window.setInterval(measure, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(first);
      window.clearInterval(poll);
      el?.removeEventListener('click', onClick);
    };
  }, [target, pressAdvances, advance]);

  /* Every step opens on the top of its page. The step describes what the page
     leads with, and arriving halfway down it — which is where the last page
     was left — means describing something off screen. */
  useEffect(() => {
    /* Instant, not smooth: a smooth scroll here is silently dropped in at
       least one browser we run in, and a step that describes the top of a
       page while showing the middle of it is worse than an abrupt jump. */
    document.getElementById('kalas-main')?.scrollTo(0, 0);
  }, [step.id]);

  /* Opening the step's page is KalasRoot's job, not this component's. Done
     here it re-fired whenever the tour re-rendered or was re-mounted, which
     yanked the couple back to Hjem the moment they clicked something on the
     page themselves — pressing a checklist row went nowhere. */

  const total = WALKTHROUGH_STEPS.length;
  const body = t(step.body);
  const title = t(step.title);

  const eyebrow = step.eyebrow ? t(step.eyebrow) : t('Hjem');

  const pct = Math.round(((idx + 1) / total) * 100);

  /* Rendered into the body, not in place. The ring is positioned from
     getBoundingClientRect — viewport coordinates — but `position: fixed`
     resolves against the nearest ancestor carrying a transform, and this app
     is full of them (every motion.div). In place, the ring's inline top of
     443px landed at 268px on screen: right number, wrong origin.

     Out there it is also outside the app's .theme-kalas subtree, so it wraps
     itself in one. Without it the card took the landing page's tokens, and
     its body text came out pale khaki on white. */
  if (!onClient) return null;

  /* Her eyes rest on the thing to press. She hovers at the card's corner,
     bottom right of the window, so the direction is from about there. */
  const look = box
    ? (() => {
        const dx = box.left + box.width / 2 - (window.innerWidth - 300);
        const dy = box.top + box.height / 2 - (window.innerHeight - 340);
        const far = Math.hypot(dx, dy) || 1;
        return { x: dx / far, y: dy / far };
      })()
    : { x: 0, y: 0.3 };

  return createPortal(
    <div className="theme-kalas font-sans">
      {/* The ring. The target is always a menu button on the left, which is
          why the card lives on the right: the two can never collide. */}
      {box && (
        <div
          aria-hidden
          /* No transition on the position. Animating top/left means the ring
             is only in the right place once the animation finishes — and
             transitions are throttled in a background tab and skipped under
             reduced motion, which left it sitting on the previous step's
             button indefinitely. It should just be where it is. */
          className="pointer-events-none fixed z-40 rounded-[12px] border-2 border-ink"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      {/* Bottom right, and it stays there. The highlight is always a menu
          button on the left, so this corner is the one place the card can
          never cover either the menu or what the step is pointing at — and a
          card that does not move is one that cannot land somewhere wrong. */}
      <div className="fixed inset-x-4 bottom-6 z-50 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[340px]">
        {/* Juno, giving the tour: hovering just above the corner of what she
            is saying. */}
        <div className="pointer-events-none absolute -top-[88px] left-3">
          <div className="juno-bob">
            <Juno size={92} flight="hover" mood={glad ? 'glad' : 'calm'} look={look} shadow={false} />
          </div>
        </div>

        {/* Dark on purpose: the pages behind it are pale, and so are their
            cards. This is the one thing on screen that is not the page. */}
        <div
          role="dialog"
          aria-label={t('Rundvisning')}
          className="rounded-[20px] bg-ink p-5 text-paper shadow-[0_18px_44px_-12px_rgba(18,51,43,0.6)]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-micro font-semibold uppercase tracking-[0.18em] text-paper/75">{eyebrow}</p>
            <div className="flex items-center gap-2">
              {/* How far in they are, as a ring rather than a number to read. */}
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(var(--color-paper) ${pct}%, color-mix(in srgb, var(--color-paper) 28%, transparent) 0)`,
                }}
              />
              <span className="sr-only">{t('{n} af {total}', { n: idx + 1, total })}</span>
              <button
                type="button"
                onClick={onFinish}
                aria-label={t('Spring rundvisningen over')}
                className="-mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-paper/75 transition-colors hover:bg-paper/10 hover:text-paper"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          <h2 className="mt-2.5 font-serif text-[1.45rem] leading-tight text-paper">
            {title}
          </h2>

          <div aria-live="polite" className="mt-2 text-[13.5px] leading-relaxed text-paper/85">
            <RichText text={body} />
          </div>

          {/* The one way forward, on every step and every screen size. */}
          {!step.final && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={back}
                disabled={idx === 0}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-paper/35 px-3 py-2 text-[13px] font-semibold text-paper/85 transition-colors hover:border-paper hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} /> {t('Tilbage')}
              </button>
              <button
                type="button"
                onClick={advance}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-paper px-4 py-2 text-[13px] font-semibold text-ink transition-opacity hover:opacity-90"
              >
                {t('Næste')} <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step.final && (
            <button
              type="button"
              onClick={onFinish}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-paper px-4 py-2.5 text-meta font-semibold text-ink transition-opacity hover:opacity-90"
            >
              {t('Kom i gang')} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
