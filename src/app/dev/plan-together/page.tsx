"use client";

/* The Settings "Planlæg sammen" card in both of its states: waiting for the
   partner, and both of them on the wedding. Sending from here calls the real
   invite route, which refuses without a session. */

import { PlanTogetherSetting } from '@/components/settings/PlanTogetherSetting';

export default function DevPlanTogetherPage() {
  return (
    <main className="theme-kalas min-h-screen w-full bg-canvas font-sans text-ink">
      <div className="mx-auto grid w-full max-w-2xl gap-6 px-6 py-10">
        <PlanTogetherSetting lang="da" members={[{ name: 'Emma', you: true }]} pendingEmail="frederik@eksempel.dk" />
        <PlanTogetherSetting lang="da" members={[{ name: 'Emma', you: true }, { name: 'Frederik', you: false }]} pendingEmail={null} />
      </div>
    </main>
  );
}
