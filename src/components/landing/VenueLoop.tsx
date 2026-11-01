"use client";

/* The core loop, broken out: brief → outreach in the venue's language →
   replies as comparable quotes. Alternating panels on a numbered spine —
   plain scrolling, no jacking; the mockups are live code miniatures. */

import { motion } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";
import { CapabilityMockup } from "./CapabilityMockups";

type Step = {
  id: string;
  n: string;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  extra?: React.ReactNode;
  tilt: number;
};

const steps: Step[] = [
  {
    id: "meet",
    n: "01",
    eyebrow: "Sig det én gang",
    title: (
      <>
        Fortæl hende det som <span className="text-accent">til en ven.</span>
      </>
    ),
    body: "“35 gæster, ved havet, efteråret 2027” er alt, Juno behøver. Hun finder rigtige steder, der passer, med kontaktoplysninger, anmeldelser og kapacitet, og lægger dem på jeres liste.",
    tilt: -1.2,
  },
  {
    id: "outreach",
    n: "02",
    eyebrow: "Hun skriver til dem",
    title: (
      <>
        Hun skriver til hvert sted{" "}
        <span className="text-accent">på dets eget sprog.</span>
      </>
    ),
    body: "Én godkendt forespørgsel bliver til en personlig mail til hvert sted på jeres liste: dansk til badehotellet, italiensk til villaen, sendt fra Junos egen postkasse. I læser og godkender hver mail, før den går af sted.",
    extra: (
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-velvet-body">
        {["🇩🇰 Dansk", "🇮🇹 Italiano", "🇫🇷 Français", "🇬🇧 English"].map((l) => (
          <span
            key={l}
            className="rounded-full border border-[#D4D6C0] bg-white/70 px-2.5 py-1 font-medium"
          >
            {l}
          </span>
        ))}
        <span className="pl-1">25 sprog, ud fra stedets adresse</span>
      </div>
    ),
    tilt: 1.4,
  },
  {
    id: "quotes",
    n: "03",
    eyebrow: "I vælger",
    title: (
      <>
        Svarene bliver til{" "}
        <span className="text-accent">tilbud, I kan sammenligne.</span>
      </>
    ),
    body: "Når stederne svarer, trækker Juno priser, ledige datoer og det, der er inkluderet, ud og stiller dem side om side. Hun skriver et udkast til hvert svar, som I godkender, indtil ét af stederne er jeres.",
    tilt: -1.4,
  },
];

export function VenueLoop() {
  return (
    <section id="features" className="relative scroll-mt-24 overflow-x-clip border-t border-[#D4D6C0] bg-[#F6F0E8]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <BlurFade inView className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-accent-ink">
            Jagten på stedet, klaret
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.4px] text-[#4A4E3C] sm:text-6xl">
            Fra første ønske til <span className="text-accent">booket sted.</span>
          </h2>
        </BlurFade>

        <div className="relative mt-16 sm:mt-20">
          {/* spine */}
          <div
            aria-hidden
            className="absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 lg:block"
            style={{
              background:
                "repeating-linear-gradient(to bottom, #C9CDB4 0 6px, transparent 6px 14px)",
            }}
          />

          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, i) => {
              const mockupFirst = i % 2 === 1;
              return (
                <div
                  key={step.id}
                  className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
                >
                  {/* spine node */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-1/2 z-10 hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#C9CDB4] bg-[#F6F0E8] font-[family-name:var(--font-cormorant)] text-sm font-semibold text-accent-ink lg:flex"
                  >
                    {step.n}
                  </div>

                  <BlurFade
                    inView
                    duration={0.6}
                    className={mockupFirst ? "min-w-0 lg:order-2 lg:pl-10" : "min-w-0 lg:pr-10"}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-accent-ink">
                      {step.n} · {step.eyebrow}
                    </p>
                    <h3 className="mt-3 max-w-md font-[family-name:var(--font-cormorant)] text-4xl font-semibold leading-[1.04] tracking-[-0.3px] text-[#4A4E3C] sm:text-[2.75rem]">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-velvet-body">
                      {step.body}
                    </p>
                    {step.extra}
                  </BlurFade>

                  <BlurFade
                    inView
                    delay={0.12}
                    duration={0.6}
                    className={mockupFirst ? "min-w-0 lg:order-1 lg:pr-10" : "min-w-0 lg:pl-10"}
                  >
                    <motion.div
                      initial={false}
                      style={{ rotate: step.tilt }}
                      whileHover={{ rotate: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className="relative"
                    >
                      <div
                        aria-hidden
                        className="absolute -inset-6 -z-10 rounded-[2rem] opacity-70"
                        style={{
                          background:
                            "radial-gradient(60% 60% at 50% 45%, rgba(194,178,128,0.20), transparent 75%)",
                        }}
                      />
                      <div className="shadow-[0_28px_64px_-24px_rgba(74,78,60,0.35)]">
                        <CapabilityMockup id={step.id} />
                      </div>
                    </motion.div>
                  </BlurFade>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
