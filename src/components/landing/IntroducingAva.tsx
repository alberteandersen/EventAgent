"use client";

/* The emotional beat: meet Ava before her feature set. A slow-breathing
   orb, layered radial glows + a drifting conic shimmer, above a short
   manifesto. Pure CSS/motion, no assets. */

import { motion } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";

function Orb() {
  return (
    <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64" aria-hidden>
      {/* halo */}
      <motion.div
        className="absolute -inset-16 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(194,178,128,0.28) 0%, rgba(58,79,55,0.10) 45%, transparent 70%)",
          filter: "blur(18px)",
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* drifting shimmer ring */}
      <motion.div
        className="absolute -inset-3 rounded-full opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(194,178,128,0.55) 70deg, transparent 160deg, rgba(220,230,212,0.5) 250deg, transparent 340deg)",
          filter: "blur(10px)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      {/* body */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 34% 30%, #FBF7EE 0%, #E9E4D2 22%, #C9CDB4 48%, #5C7052 78%, #3A4F37 100%)",
          boxShadow:
            "inset 0 1px 12px rgba(255,255,255,0.75), inset 0 -18px 40px rgba(58,79,55,0.45), 0 24px 80px -20px rgba(58,79,55,0.55)",
        }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* inner light */}
      <motion.div
        className="absolute inset-6 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.85) 0%, rgba(255,250,238,0.35) 35%, transparent 65%)",
          filter: "blur(6px)",
        }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.05, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
      {/* orbiting spark */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ background: "#C2B280", boxShadow: "0 0 14px 4px rgba(194,178,128,0.65)" }}
        />
      </motion.div>
    </div>
  );
}

export function IntroducingAva() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
        <BlurFade inView duration={0.7}>
          <Orb />
        </BlurFade>
        <BlurFade inView delay={0.15} duration={0.6}>
          <p className="mt-12 text-[11px] font-medium uppercase tracking-[1.5px] text-accent">
            Introducing Ava
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.4px] text-[#4A4E3C] sm:text-6xl">
            Not another checklist.
            <br />
            <span className="text-accent">A planner who works.</span>
          </h2>
        </BlurFade>
        <BlurFade inView delay={0.3} duration={0.6}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#7A8066] sm:text-[17px]">
            Ava researches real venues, writes the emails, chases the replies,
            compares the quotes, and keeps budget, guests and the website moving:
            the work a wedding planner actually does. You set the direction and
            approve each step. Nothing happens without your yes.
          </p>
        </BlurFade>
      </div>
    </section>
  );
}
