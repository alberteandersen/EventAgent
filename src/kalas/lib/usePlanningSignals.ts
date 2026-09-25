"use client";

/* planningSignals() read from the wedding, for the screens that show them
   (the timeline's rows and the Overblik tab). Kept apart from
   planning-signals.ts so that file stays pure and testable without React. */

import { useCallback, useMemo } from 'react';
import { useWedding } from '../useWedding';
import { planningSignals, suggestedDone } from './planning-signals';

export function usePlanningSignals() {
  const { couple, event, venues, guests, invitations, journey, seatingPlan } = useWedding();
  const signals = useMemo(() => planningSignals({
    budget: couple.budgetTotal,
    chosenVenueId: event?.chosen_venue_id,
    venues, guests, invitations,
    inviteStageComplete: journey.some((s) => s.key === 'invites' && s.status === 'complete'),
    seatingData: seatingPlan?.data,
  }), [couple.budgetTotal, event?.chosen_venue_id, venues, guests, invitations, journey, seatingPlan]);
  /** Why a milestone looks done already, or null. */
  const looksDone = useCallback((title: string) => suggestedDone(title, signals), [signals]);
  return { signals, looksDone };
}
