import type { DatePrecision } from "@/lib/db/types";

/** Start month (0-indexed) for each season token, Danish + English. */
const SEASON_START_MONTH: Record<string, number> = {
  spring: 2,
  forar: 2,
  summer: 5,
  sommer: 5,
  fall: 8,
  autumn: 8,
  efterar: 8,
  winter: 11,
  vinter: 11,
};

/** Mid-season month (0-indexed) used for approximate countdowns. */
const SEASON_MID_MONTH: Record<number, number> = {
  2: 3, // Spring → mid April
  5: 6, // Summer → mid July
  8: 9, // Fall → mid October
  11: 0, // Winter → mid January (following year)
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .trim();
}

function seasonMidDate(startMonth: number, year: number): Date {
  if (startMonth === 11) {
    return new Date(year + 1, SEASON_MID_MONTH[startMonth], 15);
  }
  return new Date(year, SEASON_MID_MONTH[startMonth], 15);
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse hints like "Efterår 2027" or "Fall 2027" into a mid-season date. A
 * bare year, onboarding's "some time in 2028", lands in the middle of it.
 */
export function estimateDateFromHint(hint: string): Date | null {
  const yearOnly = hint.trim().match(/^(\d{4})$/);
  if (yearOnly) return new Date(Number.parseInt(yearOnly[1], 10), 6, 1);

  const match = hint.trim().match(/^(\S+)\s+(\d{4})$/);
  if (!match) return null;

  const startMonth = SEASON_START_MONTH[normalizeToken(match[1])];
  const year = Number.parseInt(match[2], 10);
  if (startMonth == null || Number.isNaN(year)) return null;

  return seasonMidDate(startMonth, year);
}

export function resolveWeddingDate(event: {
  event_date: string | null;
  date_precision?: DatePrecision;
  date_hint?: string | null;
}): { iso: string | null; estimated: boolean } {
  if (event.event_date) {
    return { iso: event.event_date, estimated: false };
  }

  if (event.date_hint && event.date_precision !== "undecided") {
    const estimated = estimateDateFromHint(event.date_hint);
    if (estimated) {
      return { iso: toISODateLocal(estimated), estimated: true };
    }
  }

  return { iso: null, estimated: false };
}

export function daysUntilDate(iso: string, from = new Date()): number {
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function daysUntilWedding(
  event: {
    event_date: string | null;
    date_precision?: DatePrecision;
    date_hint?: string | null;
  } | null | undefined,
  from = new Date(),
): number | null {
  if (!event) return null;
  const { iso } = resolveWeddingDate(event);
  if (!iso) return null;
  return daysUntilDate(iso, from);
}
