"use client";

/* The checklist lays itself out the first time the plan is opened. Its items
   are dateless, so this does not wait for a wedding date; waiting only left
   couples staring at an empty list. Seeding when the plan is opened also keeps
   ~200 rows off half-created onboarding events, which is what that gate was
   for. */

import { useEffect, useRef, useState } from 'react';
import { useWedding } from '../../useWedding';
import { defaultChecklist, missingChecklistItems } from './checklist-data';
import { isCheck, topUpKey } from './shared';

/** Event ids whose default list has already been claimed for insertion.
 *  Module scope rather than a ref on purpose: switching tabs unmounts the
 *  caller, and a fresh ref would start a second insert of the same 200 rows
 *  while the first is still in flight. A reset claims it too. */
export const seeding = new Set<string>();

/** Returns the seed error, if the default list could not be laid out. */
export function useChecklistSeed() {
  const { loading, event, timelineTasks, seedTasks } = useWedding();
  const [error, setError] = useState<string | null>(null);
  const toppedUpRef = useRef(false);
  /* Only the checks count here: milestones exist before the checklist is
     seeded, so counting them would convince the seeder the list is full. */
  const checks = timelineTasks.filter(isCheck);

  useEffect(() => {
    if (loading || !event || checks.length > 0 || seeding.has(event.id)) return;
    const id = event.id;
    seeding.add(id);
    void seedTasks(defaultChecklist()).then((err) => {
      if (err) { seeding.delete(id); setError(err); }
    });
  }, [loading, event, checks.length, seedTasks]);

  /* Couples who already have a checklist get any newly added default items,
     once per event. Their ticks and their own items are untouched, which a
     reset would not be. */
  useEffect(() => {
    if (loading || toppedUpRef.current || checks.length === 0 || !event) return;
    toppedUpRef.current = true;
    const key = topUpKey(event.id);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const missing = missingChecklistItems(checks);
    if (missing.length > 0) void seedTasks(missing);
  }, [loading, checks, event, seedTasks]);

  return { error, setError };
}
