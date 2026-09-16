"use client";

/* The feature story as a scannable bento — every card is a live, code-drawn
   miniature of the real product surface. No scroll-jacking, no screenshots
   to rot. */

import { motion } from "framer-motion";
import { BlurFade } from "@/components/ui/blur-fade";
import { CapabilityMockup } from "./CapabilityMockups";

type Feature = {
  id: string;
  title: string;
  body: string;
  className: string;
};

const features: Feature[] = [
  {
    id: "budget",
    title: "The budget keeps itself",
    body: "Quotes and deposits land in the right category, flagged before anything tips over.",
    className: "lg:col-span-6",
  },
  {
    id: "guests",
    title: "Guests & RSVPs",
    body: "List, meals and plus-ones update themselves as replies arrive.",
    className: "lg:col-span-6",
  },
  {
    id: "website",
    title: "A website from your photos",
    body: "Designed by Ava, live at your own kalas.dk address the moment you publish.",
    className: "lg:col-span-6",
  },
  {
    id: "timeline",
    title: "Always knows what's next",
    body: "The right nudge at the right week, nothing slips through.",
    className: "lg:col-span-6",
  },
];

export function WhatAvaRuns() {
  return (
    <section className="border-t border-[#D4D6C0] bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <BlurFade inView className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-accent">
            Beyond the venue
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.4px] text-[#4A4E3C] sm:text-6xl">
            And she runs <span className="text-accent">the rest.</span>
          </h2>
        </BlurFade>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          {features.map((f, i) => (
            <BlurFade key={f.id} inView delay={Math.min(i, 4) * 0.06} duration={0.5} className={f.className}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="flex h-full flex-col gap-4 rounded-3xl border border-[#D4D6C0] bg-cream p-5 shadow-[0_16px_44px_-24px_rgba(74,78,60,0.25)]"
              >
                <CapabilityMockup id={f.id} />
                <div className="px-1 pb-1">
                  <h3 className="font-[family-name:var(--font-cormorant)] text-[1.4rem] font-semibold leading-tight tracking-[-0.1px] text-[#4A4E3C]">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#7A8066]">{f.body}</p>
                </div>
              </motion.div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
