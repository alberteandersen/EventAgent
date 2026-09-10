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

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import type { ScreenId } from './Shell';
import { useLang } from './i18n';
import RichText from './chat/RichText';
import {
  WALKTHROUGH_STEPS,
} from './walkthrough';

export default function GuidedTour({
  onNavigate,
  onFinish,
  chatMode = false,
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
  onFinish: (mode: 'chat' | 'classic') => void;
  /** Which mode the couple is in, so the last step offers them the other one. */
  chatMode?: boolean;
}) {
  const { t } = useLang();

  const step = WALKTHROUGH_STEPS[idx];

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, [setIdx]);
  const back = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, [setIdx]);

  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  /* Every step opens on the top of its page. The step describes what the page
     leads with, and arriving halfway down it — which is where the last page
     was left — means describing something off screen. */
  useEffect(() => {
    /* Instant, not smooth: a smooth scroll here is silently dropped in at
       least one browser we run in, and a step that describes the top of a
       page while showing the middle of it is worse than an abrupt jump. */
    window.scrollTo(0, 0);
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

  return (
    <>
      {/* Parked at the bottom. Nothing is highlighted any more, so the card
          has no target to sit beside — and the one thing it must not do is
          cover the top of the page, which is what each step opens on. */}
      <div
        role="dialog"
        aria-label={t('Rundvisning')}
        className="fixed inset-x-4 bottom-6 z-50 overflow-hidden rounded-[20px] rule bg-card p-4 shadow-[0_14px_40px_rgba(36,65,58,0.18)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[320px]"
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

        {/* Forward and back. The anchor used to be the advance button — but
            it points at page content now, where a click should do its own
            job. Without this the tour was a dead end whenever the anchor was
            not on screen, which is every nav-anchored step on a phone. */}
        {!step.final && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={idx === 0}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full rule px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft size={14} /> {t('Tilbage')}
            </button>
            <button
              type="button"
              onClick={advance}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {t('Videre')} <ArrowRight size={14} />
            </button>
          </div>
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
