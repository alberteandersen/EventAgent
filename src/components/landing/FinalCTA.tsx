"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-6 py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-rose-blush blur-[110px]" />
        <div className="absolute right-1/4 bottom-0 h-72 w-72 rounded-full bg-rose-blush/70 blur-[110px]" />
      </div>

      <BlurFade inView duration={0.7} className="mx-auto max-w-2xl text-center">
        <motion.div
          animate={{ rotate: [0, 14, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-6 text-5xl"
        >
          💍
        </motion.div>
        <h2 className="font-[family-name:var(--font-cormorant)] text-5xl font-semibold leading-[1.02] tracking-[-0.4px] text-[#4A4E3C] sm:text-7xl">
          Jeres bryllupsdag,
          <br />
          <span className="text-accent">så godt som planlagt.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-lg text-velvet-body">
          Opret en konto, og fortæl Juno om jeres bryllup. Hun kan skrive til
          de første steder allerede i dag.
        </p>
        <Link
          href="/login"
          className="mt-10 inline-flex rounded-full bg-blue px-10 py-4 text-sm font-medium text-on-ink shadow-[0px_4px_14px_rgba(58,79,55,0.22)] transition hover:bg-blue-light"
        >
          Start planlægningen, det er gratis
        </Link>
      </BlurFade>
    </section>
  );
}
