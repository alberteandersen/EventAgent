import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const monthLabel = viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

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

  const pick = (d: Date) => {
    if (d < today) return;
    onChange(toIso(d));
  };

  return (
    <div className={cn('w-full max-w-[380px] rounded-[20px] border border-[#d8d5ca] bg-[#fffdf7] p-5 shadow-[0px_12px_36px_rgba(18,51,43,0.06)]', className ?? 'mt-5')}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => canGoPrev && setViewMonth((m) => addMonths(m, -1))}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d5ca] transition-colors cursor-pointer',
            canGoPrev ? 'text-[#23351f] hover:bg-[#f3f1ea]' : 'cursor-not-allowed text-[#b8bdb5] opacity-50',
          )}
          aria-label={t('Forrige måned')}
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-serif text-[1.1rem] capitalize tracking-[-0.02em] text-[#23351f]">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d5ca] text-[#23351f] transition-colors hover:bg-[#f3f1ea] cursor-pointer"
          aria-label={t('Næste måned')}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekdayLabels.map((w) => (
          <span key={w} className="py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#6c755e]">
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
                disabled && 'cursor-not-allowed text-[#c5cbc3]',
                !disabled && !isSelected && 'text-[#23351f] hover:bg-[#eef2e8]',
                isSelected && 'bg-ink-deep font-semibold text-[#fffdf7] shadow-[0px_4px_12px_rgba(18,51,43,0.2)]',
                isToday && !isSelected && 'ring-1 ring-[#7b8e55] ring-inset',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-4 text-center text-[0.82rem] text-[#56645b]">
          {selected.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
