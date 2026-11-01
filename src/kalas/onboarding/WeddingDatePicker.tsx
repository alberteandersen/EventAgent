import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui';
import { useLang } from '../i18n';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  lang: 'da' | 'en';
  /** Replaces the default top margin, for callers that lay it out themselves. */
  className?: string;
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** How far ahead the year dropdown reaches. */
const YEARS_AHEAD = 6;

/** Inline month calendar — shown when the couple already knows their wedding date. */
export default function WeddingDatePicker({ value, onChange, lang, className }: Props) {
  const { t } = useLang();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const selected = parseIso(value);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? today));

  const locale = lang === 'en' ? 'en-US' : 'da-DK';
  const monthLabel = viewMonth.toLocaleDateString(locale, { month: 'long' });

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const monday = new Date(2024, 0, 1); // Mon
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  }, [locale]);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const out: Array<{ date: Date; inMonth: boolean } | null> = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      out.push({ date: new Date(year, month, d), inMonth: true });
    }
    return out;
  }, [viewMonth]);

  const minMonth = startOfMonth(today);
  const canGoPrev = viewMonth > minMonth;

  /* A wedding two years out was twenty-four taps on "next month". The year is
     a dropdown instead; the arrows are still there for the months. */
  const viewYear = viewMonth.getFullYear();
  const years = Array.from(
    { length: Math.max(YEARS_AHEAD, viewYear - today.getFullYear()) + 1 },
    (_, i) => today.getFullYear() + i,
  );
  const pickYear = (year: number) => {
    const next = new Date(year, viewMonth.getMonth(), 1);
    // This year's months that have already gone are not on offer.
    setViewMonth(next < minMonth ? minMonth : next);
  };

  const pick = (d: Date) => {
    if (d < today) return;
    onChange(toIso(d));
  };

  return (
    <div className={cn('w-full max-w-[380px] rounded-[20px] border border-line bg-paper p-5 shadow-[0px_12px_36px_rgba(18,51,43,0.06)]', className ?? 'mt-5')}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => canGoPrev && setViewMonth((m) => addMonths(m, -1))}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-line transition-colors cursor-pointer',
            canGoPrev ? 'text-ink hover:bg-shell' : 'cursor-not-allowed text-line-strong opacity-50',
          )}
          aria-label={t('Forrige måned')}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-baseline gap-1.5 font-serif text-[1.1rem] tracking-[-0.02em] text-ink">
          <span className="capitalize" aria-live="polite">{monthLabel}</span>
          <span className="relative">
            <select
              value={viewYear}
              onChange={(e) => pickYear(Number(e.target.value))}
              aria-label={t('Vælg år')}
              className="cursor-pointer appearance-none rounded-full border border-line bg-transparent py-0.5 pl-2.5 pr-6 font-serif text-[1.1rem] tracking-[-0.02em] text-ink transition-colors hover:bg-shell focus-visible:border-ink focus-visible:outline-none"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
          </span>
        </div>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-shell cursor-pointer"
          aria-label={t('Næste måned')}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekdayLabels.map((w) => (
          <span key={w} className="py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted">
            {w.replace('.', '')}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />;
          const { date } = cell;
          const disabled = date < today;
          const isSelected = selected ? sameDay(date, selected) : false;
          const isToday = sameDay(date, today);

          return (
            <button
              key={toIso(date)}
              type="button"
              disabled={disabled}
              onClick={() => pick(date)}
              className={cn(
                'flex h-10 w-full items-center justify-center rounded-full text-[0.88rem] transition-colors cursor-pointer',
                disabled && 'cursor-not-allowed text-line-strong',
                !disabled && !isSelected && 'text-ink hover:bg-sage-wash',
                isSelected && 'bg-ink-deep font-semibold text-paper shadow-[0px_4px_12px_rgba(18,51,43,0.2)]',
                isToday && !isSelected && 'ring-1 ring-sage-strong ring-inset',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-4 text-center text-[0.82rem] text-muted">
          {selected.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
