/* What the rest of the app already knows about how far a couple has come,
   read as evidence for the timeline's milestones. The timeline only ever
   suggests a tick from this, with the reason; it never ticks by itself, since
   a booking can fall through and a published invitation may not be the last. */

import type { GuestRow, InvitationRow, VendorCategory, VenueRow } from '@/lib/db/types';
import { readPlan, seatedIds } from '../screens/seating/model';

export interface PlanningSignals {
  budgetSet: boolean;
  guestCount: number;
  venueChosen: boolean;
  booked: Partial<Record<VendorCategory, boolean>>;
  invitationOut: boolean;
  /** Every guest who said yes has a seat (and at least one has). */
  everyoneSeated: boolean;
}

export function planningSignals(input: {
  budget: number | null | undefined;
  chosenVenueId: string | null | undefined;
  venues: Pick<VenueRow, 'category' | 'booked_at'>[];
  guests: Pick<GuestRow, 'id' | 'rsvp'>[];
  invitations: Pick<InvitationRow, 'status'>[];
  inviteStageComplete: boolean;
  seatingData: unknown;
}): PlanningSignals {
  const booked: Partial<Record<VendorCategory, boolean>> = {};
  for (const v of input.venues) if (v.booked_at) booked[v.category] = true;
  const coming = input.guests.filter((g) => g.rsvp === 'ja');
  const seated = seatedIds(readPlan(input.seatingData));
  return {
    budgetSet: (input.budget ?? 0) > 0,
    guestCount: input.guests.length,
    venueChosen: Boolean(input.chosenVenueId),
    booked,
    invitationOut: input.inviteStageComplete || input.invitations.some((i) => i.status === 'published'),
    everyoneSeated: coming.length > 0 && coming.every((g) => seated.has(g.id)),
  };
}

/** Why a default milestone looks done, as a Danish source string for t(), or
 *  null when nothing says so. Keyed on the seeded titles (see MILESTONE_AREA
 *  in planning/milestones.ts); a milestone the couple wrote or renamed gets nothing. */
export function suggestedDone(title: string, s: PlanningSignals): string | null {
  switch (title) {
    case 'Sæt budget & gæsteliste':
      return s.budgetSet && s.guestCount >= 10 ? 'Budget og gæsteliste er på plads' : null;
    case 'Book venue':
      return s.venueChosen ? 'I har valgt jeres venue' : null;
    case 'Book fotograf':
      return s.booked.photographer ? 'I har booket en fotograf' : null;
    case 'Florist & dekoration':
      return s.booked.florist ? 'I har booket en florist' : null;
    case 'Musik / DJ / band':
      return s.booked.musician ? 'I har booket musik' : null;
    case 'Save-the-dates':
    case 'Invitationer sendt':
      return s.invitationOut ? 'Jeres invitation er sendt ud' : null;
    case 'Bordplan & menu låst':
      return s.everyoneSeated ? 'Alle gæster har en plads' : null;
    default:
      return null;
  }
}
