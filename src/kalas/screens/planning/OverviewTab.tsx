import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useWithoutPending } from '../../undo';
import { useLang } from '../../i18n';
import { TaskCheckbox, cn } from '../../ui';
import type { ScreenId } from '../../Shell';
import { usePlanningSignals } from '../../lib/usePlanningSignals';
import { PHASES, currentPhase, isDueBy, phaseLabel, phaseOf, type Phase } from './checklist-data';
import { nextSteps, type NextStep } from './next-steps';
import { MILESTONE_ACTIONS, areaLabel, areaOf, daysDiff, isCheck, isMilestone, todayISO, type PlanTab } from './shared';
import { canRun, runMilestoneAction } from './actions';
import { useChecklistSeed } from './useChecklistSeed';

/** Keeps "9–12 mdr. før" on one line: no break at the spaces or the dash. */
const unbroken = (s: string) => s.replace(/ /g, '\u00a0').replace(/–/g, '–\u2060');

/** The phases a plan runs through before the day; "Efter" is off the line. */
const LINE = PHASES.filter((p) => p.id !== 'efter');

/**
 * Where the planning screen opens: how long is left and where that puts the
 * couple, then the few things to do next, out of fourteen milestones and two
 * hundred checklist items. Everything else is one tab away.
 */
export default function OverviewTab({ onOpenTab, onCelebrate, onNavigate }: {
  onOpenTab: (tab: PlanTab, checklistFilter?: 'nu') => void;
  onCelebrate: (title: string) => void;
  onNavigate?: (s: ScreenId) => void;
}) {
  const { t, tn, lang } = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'da-DK';
  const { couple, timelineTasks, updateTask } = useWedding();
  const tasks = useWithoutPending(timelineTasks);
  const { looksDone } = usePlanningSignals();
  useChecklistSeed();

  const today = todayISO();
  const weddingISO = couple.dateISO;
  const daysLeft = weddingISO ? daysDiff(weddingISO, today) : null;
  const now: Phase | null = daysLeft !== null ? currentPhase(daysLeft) : null;
  const steps = nextSteps(tasks, { today, weddingISO, looksDone });

  const milestones = tasks.filter(isMilestone);
  const checks = tasks.filter(isCheck);
  const dueNow = now ? checks.filter((r) => { const p = phaseOf(r.title); return !r.done && p !== null && isDueBy(p, now); }).length : 0;

  const longDate = (iso: string) => {
    const s = new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', ...(iso.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  });

  const heading = daysLeft === null ? t('Jeres plan')
    : daysLeft > 1 ? t('{n} dage til jeres bryllup', { n: daysLeft })
    : daysLeft === 1 ? t('I morgen er dagen')
    : daysLeft === 0 ? t('I dag er dagen')
    : t('Tillykke, I er gift');

  function tick(step: NextStep) {
    void updateTask(step.row.id, { done: true });
    onCelebrate(step.row.title);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[22px] border border-line bg-card px-5 py-6 sm:rounded-[28px] sm:px-9 sm:py-9"
    >
      {/* Where they are */}
      <h2 className="font-serif text-[1.9rem] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.4rem]">{heading}</h2>
      {weddingISO && now ? (
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {longDate(weddingISO)}.{' '}
          {now === 'efter'
            ? t('Nu mangler kun det, der kommer bagefter.')
            : t('I er i fasen {phase}.', { phase: unbroken(t(phaseLabel(now)).toLowerCase()) })}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[14px] leading-relaxed text-muted">
            {t('Sæt datoen, så lægger vi tidslinjen ud og viser, hvad der hører til nu.')}
          </p>
          <a href="/settings" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90">
            {t('Sæt datoen')}
          </a>
        </div>
      )}

      {now && <PhaseLine now={now} />}

      {/* What to do next */}
      <h3 className="mt-10 font-serif text-[1.35rem] text-ink sm:mt-12">{t('Det næste')}</h3>
      {steps.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{t('Alt, der hører til nu, er klaret. I er foran planen.')}</p>
      ) : (
        <ul className="mt-3 border-t border-line">
          <AnimatePresence initial={false}>
            {steps.map((step) => (
              <motion.li
                key={step.row.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-b border-line"
              >
                <StepRow step={step} shortDate={shortDate} onTick={() => tick(step)} onNavigate={onNavigate} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 text-[14px] font-semibold">
        {dueNow > 0 && (
          <button type="button" onClick={() => onOpenTab('tjekliste', 'nu')} className="group inline-flex items-center gap-1.5 text-ink cursor-pointer">
            {tn(dueNow, 'Det ene punkt, der hører til nu', 'Alle {n} punkter, der hører til nu')}
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </button>
        )}
        {milestones.length > 0 && (
          <button type="button" onClick={() => onOpenTab('tidslinje')} className="group inline-flex items-center gap-1.5 text-ink cursor-pointer">
            {t('Hele tidslinjen')}
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </button>
        )}
      </div>

      {/* How far, in one sentence rather than a row of numbers */}
      {(milestones.length > 0 || checks.length > 0) && (
        <p className="mt-10 text-[13px] text-muted">
          {t('{m} af {mt} milepæle og {c} af {ct} punkter på tjeklisten er klaret.', {
            m: milestones.filter((r) => r.done).length, mt: milestones.length,
            c: checks.filter((r) => r.done).length, ct: checks.length,
          })}
        </p>
      )}
    </motion.section>
  );
}

/** The plan's phases as one line: behind them, now, ahead. Time, not tasks. */
function PhaseLine({ now }: { now: Phase }) {
  const { t } = useLang();
  const at = now === 'efter' ? LINE.length : LINE.findIndex((p) => p.id === now);
  const align = at <= 0 ? 'justify-self-start' : at >= LINE.length - 1 ? 'justify-self-end' : 'justify-self-center';
  return (
    <div className="mt-7">
      <ol aria-label={t('Hvor I er i planen')} className="grid grid-cols-8 gap-1">
        {LINE.map((p, i) => (
          <li
            key={p.id}
            aria-current={i === at ? 'step' : undefined}
            className={cn(
              'h-1.5 rounded-full',
              i < at ? 'bg-sage-strong' : i === at ? 'bg-ink' : 'bg-line',
            )}
          >
            <span className="sr-only">{t(p.label)}</span>
          </li>
        ))}
        {at < LINE.length && (
          <li aria-hidden className={cn('mt-2 whitespace-nowrap text-[12px] font-semibold text-ink', align)} style={{ gridColumn: at + 1, gridRow: 2 }}>
            {t(LINE[at].label)}
          </li>
        )}
      </ol>
      <div aria-hidden className="mt-1 flex justify-between text-[12px] text-muted">
        <span>{at === 0 ? '' : t('Forlovelsen')}</span>
        <span>{at === LINE.length - 1 ? '' : t('Dagen')}</span>
      </div>
    </div>
  );
}

function StepRow({ step, shortDate, onTick, onNavigate }: {
  step: NextStep;
  shortDate: (iso: string) => string;
  onTick: () => void;
  onNavigate?: (s: ScreenId) => void;
}) {
  const { t, tn } = useLang();
  const r = step.row;
  const act = isMilestone(r) ? MILESTONE_ACTIONS[r.title] : undefined;
  const late = r.due_date ? -daysDiff(r.due_date) : 0;

  const meta = step.why === 'overdue'
    ? <span className="font-semibold text-terracotta">{tn(late, 'Forsinket én dag', 'Forsinket {n} dage')}</span>
    : step.why === 'soon' && r.due_date
      ? <span>{isMilestone(r) ? t('Milepæl') : t('Tjekliste')} · {shortDate(r.due_date)}</span>
      : step.why === 'phase'
        ? <span>{t('Tjekliste')} · {t(areaLabel(areaOf(r)))}</span>
        : null;

  return (
    <div className="flex items-start gap-3 py-3.5 sm:items-center sm:gap-4">
      <div className="mt-0.5 shrink-0 sm:mt-0">
        <TaskCheckbox done={false} label={t(r.title)} onToggle={onTick} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug text-ink">{t(r.title)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
          {meta}
          {step.why === 'looks-done' && step.reason && (
            <button
              type="button"
              onClick={onTick}
              aria-label={t("Sæt flueben ved '{title}': {reason}", { title: t(r.title), reason: t(step.reason) })}
              className="inline-flex items-center gap-1.5 rounded-full bg-sage-tint py-1 pl-2.5 pr-3 text-left text-[12px] font-semibold text-success transition-colors hover:bg-sage-tint/70 cursor-pointer"
            >
              <Check size={12} strokeWidth={2.6} aria-hidden />
              {t(step.reason)} · {t('Sæt flueben')}
            </button>
          )}
          {step.why !== 'looks-done' && canRun(act, onNavigate) && (
            <button
              type="button"
              onClick={() => runMilestoneAction(act, onNavigate)}
              className={cn(
                'group inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer sm:hidden',
                step.why === 'overdue' ? 'text-terracotta' : 'text-ink-soft hover:text-ink',
              )}
            >
              {t(act.label)}
              <ArrowRight size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {/* The way to do it, on the right where there is room for it. */}
      {step.why !== 'looks-done' && canRun(act, onNavigate) && (
        <button
          type="button"
          onClick={() => runMilestoneAction(act, onNavigate)}
          className={cn(
            'group hidden shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer sm:inline-flex',
            step.why === 'overdue'
              ? 'border-terracotta/40 text-terracotta hover:bg-terracotta-tint'
              : 'border-line text-ink hover:bg-shell',
          )}
        >
          {t(act.label)}
          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
