/* One concrete line per tour step, taken from the couple's own wedding.
 *
 * The card used to describe what each page is for, which reads as a feature
 * list — true of every wedding and therefore about none of them. A tour that
 * says "næste opgave: Book fotograf, om 34 dage" is telling them something
 * they did not already know, on their own data, and the page behind it shows
 * exactly that.
 *
 * Pure so it can be tested without the app: everything it needs is passed in,
 * and a step with nothing worth saying returns null rather than filler.
 */

import type { GuestRow, TimelineTaskRow, VenueRow } from '@/lib/db/types';

export interface TourFactInput {
  region: string;
  guestEstimate: number;
  budgetTotal: number;
  dateISO: string | null;
  venues: Pick<VenueRow, 'category' | 'swipe_status'>[];
  guests: Pick<GuestRow, 'rsvp'>[];
  tasks: Pick<TimelineTaskRow, 'title' | 'due_date' | 'done'>[];
  /** Unanswered replies sitting in the inbox. */
  unreadReplies: number;
  /** Today, injectable so the tests are not clock-dependent. */
  now?: Date;
}

const kr = (n: number) => n.toLocaleString('da-DK');

/** Whole days from today to an ISO date; negative when it has passed. */
export function daysUntil(iso: string, now: Date): number {
  const then = new Date(`${iso}T12:00:00Z`).getTime();
  const today = new Date(`${now.toISOString().slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((then - today) / 86_400_000);
}

/**
 * The next thing that is actually due: not done, has a date, soonest first.
 * Overdue tasks still count — they are the most concrete thing on the page.
 */
export function nextTask<T extends { title: string; due_date: string | null; done: boolean }>(
  tasks: T[],
): T | null {
  const open = tasks.filter((t) => !t.done && t.due_date);
  if (open.length === 0) return null;
  return open.reduce((soonest, t) => (t.due_date! < soonest.due_date! ? t : soonest));
}

export function tourFact(stepId: string, i: TourFactInput): string | null {
  const now = i.now ?? new Date();

  switch (stepId) {
    case 'vendors': {
      const shortlisted = i.venues.filter(
        (v) => v.category === 'venue' && v.swipe_status === 'liked',
      ).length;
      if (shortlisted > 0) {
        return `I har ${shortlisted} på jeres shortlist. Jeg kan finde flere, der har plads til ${i.guestEstimate}.`;
      }
      if (!i.region) return null;
      return `Ingen steder på tavlen endnu. Jeg leder efter noget i ${i.region} med plads til ${i.guestEstimate}.`;
    }

    case 'budget': {
      if (i.budgetTotal <= 0) return null;
      // The venue is the biggest line and the one they decide first.
      const venueShare = Math.round((i.budgetTotal * 0.33) / 500) * 500;
      return `Af jeres ${kr(i.budgetTotal)} kr er ca. ${kr(venueShare)} kr sat af til stedet.`;
    }

    case 'guests': {
      const added = i.guests.length;
      if (added === 0) return `Listen er tom. I regner med omkring ${i.guestEstimate}.`;
      const yes = i.guests.filter((g) => g.rsvp === 'ja').length;
      return `${added} på listen, ${yes} har sagt ja.`;
    }

    case 'planning': {
      const task = nextTask(i.tasks);
      if (!task?.due_date) return null;
      const days = daysUntil(task.due_date, now);
      if (days < 0) return `Næste opgave: ${task.title} — den skulle have været klar for ${Math.abs(days)} dage siden.`;
      if (days === 0) return `Næste opgave: ${task.title} — i dag.`;
      return `Næste opgave: ${task.title} — om ${days} dage.`;
    }

    case 'inbox': {
      if (i.unreadReplies === 0) return 'Ingen svar endnu. De lander her, så snart et sted skriver tilbage.';
      return `${i.unreadReplies} ubesvarede svar venter på jer.`;
    }

    case 'intro':
    case 'start': {
      if (!i.dateISO) return null;
      const days = daysUntil(i.dateISO, now);
      if (days < 0) return null;
      return `Der er ${days} dage til.`;
    }

    default:
      return null;
  }
}
