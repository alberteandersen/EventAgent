// Chip constants + helpers for the wedding-first onboarding flow.
// Shared between the client wizard and the /api/onboarding route.

import type { DatePrecision } from "@/lib/db/types";

export interface GuestBand {
  key: string;
  label: string;
  /** Rough midpoint stored into events.guest_count (null = unknown). */
  count: number | null;
}

export const GUEST_BANDS: readonly GuestBand[] = [
  { key: "just_us", label: "Just us", count: 2 },
  { key: "under_50", label: "Under 50", count: 35 },
  { key: "50_100", label: "50–100", count: 75 },
  { key: "100_150", label: "100–150", count: 125 },
  { key: "150_plus", label: "150+", count: 175 },
  { key: "not_sure", label: "Not sure yet", count: null },
] as const;

export interface OnboardingDate {
  precision: DatePrecision;
  /** ISO date when precision is "exact". */
  iso?: string;
  /** Human hint like "Summer 2027" when precision is "season". */
  hint?: string;
}

/** "Emma & James's wedding" / "Emma's wedding" / "Your wedding". */
export function weddingTitle(name?: string | null, partner?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const second = (partner ?? "").trim().split(/\s+/)[0];
  if (first && second) return `${first} & ${second}'s wedding`;
  if (first) return `${first}'s wedding`;
  return "Your wedding";
}
