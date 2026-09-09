"use client";

/* Ava's walkthrough for Classic mode.
 *
 * The chat version (useWalkthrough.ts) narrates by dropping bubbles into the
 * message list. There is no message list here, so this one anchors itself to
 * the real interface: it spotlights the control the step is about, says in so
 * many words what to press, and advances when they press it. "Videre" is the
 * escape hatch, not the intended path — that is the difference between a tour
 * you read and a walkthrough you do.
 *
 * Both versions share one script (walkthrough.ts) and one progress key, so a
 * couple who switches modes mid-tour picks up where they left off.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Play } from 'lucide-react';
import { NAV, type ScreenId } from './Shell';
import { useLang } from './i18n';
import RichText from './chat/RichText';
import {
  WALKTHROUGH_KEY,
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

/** Card beside the spotlight where it fits, below it otherwise. */
function placeCard(box: Box): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const right = box.left + box.width + GAP;

  const left = right + CARD_W <= vw - 16
    ? right
    : Math.max(16, Math.min(box.left, vw - CARD_W - 16));

  // Roughly centred on the target, then kept inside the viewport.
  const wanted = left === right ? box.top - 12 : box.top + box.height + GAP;
  const top = Math.max(16, Math.min(wanted, vh - 260));
  return { top, left };
}

export default function ClassicWalkthrough({
  params,
  onNavigate,
  onAskAva,
  onFinish,
}: {
  params: Partial<WalkthroughParams>;
  onNavigate: (s: ScreenId) => void;
  /** Runs a try-prompt for real: switches to chat mode and sends it. */
  onAskAva: (prompt: string) => void;
  onFinish: (mode: 'chat' | 'classic') => void;
}) {
  const { t } = useLang();
  const [idx, setIdx] = useState(() => {
    try {
      const raw = localStorage.getItem(WALKTHROUGH_KEY);
      const n = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, 0), WALKTHROUGH_STEPS.length - 1) : 0;
    } catch {
      return 0;
    }
  });

  const step = WALKTHROUGH_STEPS[idx];
  const tries = stepTries(step, params);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    try { localStorage.setItem(WALKTHROUGH_KEY, String(idx)); } catch { /* ignore */ }
  }, [idx]);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, []);

  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  /* ── Spotlight the step's control, and let a click on it advance ───── */
  // The nav item is the target, so navigation happens because they clicked it —
  // not because we moved the page under them.
  useEffect(() => {
    const anchor = step.anchor;
    let el: HTMLElement | null = null;
    let raf = 0;
    let last: Box | null = null;

    /* Measured every frame rather than on scroll and resize events. The step
       usually arrives with a page change and a smooth scrollIntoView, and a
       one-shot measurement lands before either has settled — which put the
       "Tryk her" tag a few hundred pixels above the control it points at.
       The state only changes when the rectangle does, so the loop costs a
       getBoundingClientRect per frame and no renders. */
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) {
        el = anchor ? findAnchor(anchor) : null;
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

    // Clearing goes through the same frame as measuring, so no setState runs
    // synchronously in the effect body.
    if (!anchor) {
      raf = requestAnimationFrame(() => setBox(null));
      return () => cancelAnimationFrame(raf);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener('click', onClick);
    };
  }, [step.anchor, advance]);

  const onNext = () => {
    // Escape hatch: they didn't click the control, so take them there ourselves.
    if (step.page) navigateRef.current?.(step.page);
    advance();
  };

  const total = WALKTHROUGH_STEPS.length;
  const body = t(
    step.classicMessage ?? step.message,
    params as Record<string, string | number>,
  );
  const title = t(step.classicTitle ?? 'Rundvisning');

  // The nav owns its label, so the eyebrow and the "Tryk her" tag stay in step
  // with whatever the menu is called.
  const navLabel = NAV.find((n) => n.id === step.anchor)?.label;
  const eyebrow = navLabel ? t(navLabel) : t('Hjem');
  const cta = Boolean(navLabel);

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

  const placed = wide && box ? placeCard(box) : null;

  const pct = Math.round(((idx + 1) / total) * 100);

  return (
    <>
      {box && (
        <div
          aria-hidden
          className="kalas-tour-spot pointer-events-none fixed z-40 rounded-[14px] border-2 border-sage transition-all duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      {/* "Tryk her", welded to the control itself. The card explains; this
          says where the finger goes, and it travels with the target rather
          than describing its location in words. */}
      {box && cta && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 flex items-center transition-all duration-300"
          style={{ top: box.top + box.height / 2 - 14, left: box.left + box.width + 10 }}
        >
          <span
            className="h-0 w-0 border-y-[6px] border-r-[7px] border-y-transparent"
            style={{ borderRightColor: 'var(--color-ink)' }}
          />
          <span className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-canvas shadow-[0_4px_14px_rgba(19,26,22,0.35)]">
            {t('Tryk her')}
          </span>
        </div>
      )}

      <div
        role="dialog"
        aria-label={t('Rundvisning')}
        className="fixed inset-x-4 bottom-24 z-50 overflow-hidden rounded-[18px] bg-[#1b2420] p-5 text-[#e6ede8] shadow-[0_16px_44px_rgba(0,0,0,0.45)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[360px]"
        style={placed ? { top: placed.top, left: placed.left, right: 'auto', bottom: 'auto' } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7fbba0]">
            {eyebrow}
          </p>
          <div className="flex items-center gap-2">
            {/* How far in they are, as a ring rather than a number to read. */}
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ background: `conic-gradient(#7fbba0 ${pct}%, rgba(230,237,232,0.18) 0)` }}
            />
            <span className="sr-only">{t('{n} af {total}', { n: idx + 1, total })}</span>
            <button
              type="button"
              onClick={() => onFinish('classic')}
              aria-label={t('Spring rundvisningen over')}
              className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8fa199] transition-colors hover:bg-white/10 hover:text-[#e6ede8]"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <h2 className="mt-2.5 font-serif text-[1.35rem] leading-tight text-white">
          {title}
        </h2>

        <div aria-live="polite" className="mt-2 text-[13.5px] leading-relaxed text-[#b9c7c0]">
          <RichText text={body} />
        </div>

        {tries.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {tries.map((prompt) => {
              const filled = t(prompt, params as Record<string, string | number>);
              return (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onAskAva(filled)}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-left text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
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
            onClick={() => onFinish('classic')}
            className="cursor-pointer text-[12.5px] font-semibold text-[#8fa199] transition-colors hover:text-[#e6ede8]"
          >
            {step.final ? t('Prøv chat-tilstand') : t('Spring rundvisningen over')}
          </button>
          <button
            type="button"
            onClick={step.final ? () => onFinish('classic') : onNext}
            className="cursor-pointer rounded-full bg-[#e6ede8] px-4 py-2 text-[12.5px] font-semibold text-[#131a16] transition-opacity hover:opacity-90"
          >
            {step.final ? t('Så er jeg klar') : cta ? t('Spring dette trin over') : t('Videre')}
          </button>
        </div>
      </div>
    </>
  );
}
