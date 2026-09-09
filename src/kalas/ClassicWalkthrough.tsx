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
import { X, MousePointerClick } from 'lucide-react';
import { NAV, type ScreenId } from './Shell';
import { useLang } from './i18n';
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
    // Measured on the next frame, never synchronously: the step usually
    // arrives with a page change, and the target has not been laid out yet.
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    const onClick = () => advance();

    const raf = requestAnimationFrame(() => {
      el = anchor ? findAnchor(anchor) : null;
      if (!el) { setBox(null); return; }
      measure();
      el.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      el.addEventListener('click', onClick);
    });

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener('click', onClick);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.anchor, advance]);

  const onNext = () => {
    // Escape hatch: they didn't click the control, so take them there ourselves.
    if (step.page) navigateRef.current?.(step.page);
    advance();
  };

  const total = WALKTHROUGH_STEPS.length;
  const message = t(
    step.classicMessage ?? step.message,
    params as Record<string, string | number>,
  );

  // "Tryk på Budget i menuen" — the nav owns the label, so it stays in step.
  const navLabel = NAV.find((n) => n.id === step.anchor)?.label;
  const cta = navLabel ? t('Tryk på {label} i menuen', { label: t(navLabel) }) : null;

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

  return (
    <>
      {box && (
        <div
          aria-hidden
          className="kalas-tour-spot pointer-events-none fixed z-40 rounded-[14px] border-2 border-sage transition-all duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      <div
        role="dialog"
        aria-label={t('Rundvisning')}
        className="fixed inset-x-4 bottom-24 z-50 rounded-[18px] border border-line-strong bg-card p-5 shadow-[0_12px_32px_rgba(19,26,22,0.28)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[340px]"
        style={placed ? { top: placed.top, left: placed.left, right: 'auto', bottom: 'auto' } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">{t('{n} af {total}', { n: idx + 1, total })}</p>
          <button
            type="button"
            onClick={() => onFinish('classic')}
            aria-label={t('Spring rundvisningen over')}
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-shell hover:text-ink"
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>

        <p aria-live="polite" className="mt-2 text-sm leading-relaxed text-ink">
          {message}
        </p>

        {cta && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-sage-tint px-3 py-2 text-[13px] font-semibold text-sage-strong">
            <MousePointerClick size={15} strokeWidth={2} className="shrink-0" aria-hidden />
            {cta}
          </p>
        )}

        {tries.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {tries.map((prompt) => {
              const filled = t(prompt, params as Record<string, string | number>);
              return (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onAskAva(filled)}
                  className="cursor-pointer rounded-xl border border-line-strong bg-shell px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-ink"
                >
                  {t('Prøv: “{prompt}”', { prompt: filled })}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          {step.final ? (
            <>
              <button
                type="button"
                onClick={() => onFinish('chat')}
                className="cursor-pointer text-[13px] font-semibold text-muted hover:text-ink"
              >
                {t('Prøv chat-tilstand')}
              </button>
              <button
                type="button"
                onClick={() => onFinish('classic')}
                className="cursor-pointer rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas"
              >
                {t('Så er jeg klar')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onFinish('classic')}
                className="cursor-pointer text-[13px] font-semibold text-muted hover:text-ink"
              >
                {t('Spring rundvisningen over')}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="cursor-pointer rounded-full border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {cta ? t('Spring dette trin over') : t('Videre')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
