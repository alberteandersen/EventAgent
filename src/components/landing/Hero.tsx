"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { AgentPhoneMockup } from "@/components/landing/AgentPhoneMockup";

const headline = ["Plan", "the", "wedding.", "Skip", "the", "stress."];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yPreview = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  return (
    <section
      ref={ref}
      className="relative min-h-[min(100vh,920px)] overflow-hidden px-6 pb-0 pt-32 sm:min-h-[920px] sm:pt-40"
    >
      <div className="absolute inset-0 z-0">
        <motion.div style={{ scale: bgScale }} className="absolute inset-0">
          <Image
            src="/landing/hero.jpg"
            alt="Long-table wedding dinner on a coastal terrace at dusk, string lights overhead"
            fill
            priority
            className="object-cover object-[center_62%]"
            sizes="100vw"
          />
        </motion.div>
        <div className="absolute inset-0 bg-ink/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/20 via-transparent to-ink/20" />
        <div
          className="absolute inset-x-0 bottom-0 h-[48%]"
          style={{
            background:
              "linear-gradient(to top, rgba(246,240,232,0.75) 0%, rgba(246,240,232,0.4) 14%, rgba(246,240,232,0.18) 28%, rgba(246,240,232,0.06) 42%, transparent 58%)",
          }}
        />
      </div>

      {/* Soft mask over the phone clip + section seam */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 sm:h-28"
        style={{
          background:
            "linear-gradient(to top, rgba(246,240,232,0.55) 0%, rgba(246,240,232,0.2) 55%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl pb-56 text-center sm:pb-64">
        <h1 className="font-[family-name:var(--font-cormorant)] text-6xl font-semibold leading-[0.98] tracking-[-0.5px] text-surface drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] sm:text-7xl xl:text-[5.5rem]">
          {headline.map((word, i) => (
            <BlurFade
              key={i}
              delay={0.15 + i * 0.08}
              duration={0.5}
              className={`mr-[0.25em] inline-block ${word === "stress." ? "text-white/55" : ""}`}
            >
              {word}{" "}
            </BlurFade>
          ))}
        </h1>

        <BlurFade delay={0.65} duration={0.5} className="mx-auto mt-7 max-w-xl">
          <p className="text-lg leading-relaxed text-on-velvet/90 drop-shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
            Ava researches real venues anywhere in the world, writes to them in
            their own language, and turns the replies into quotes you can compare,
            then runs budget, guests, invites and your wedding website.
            You approve; she does.
          </p>
        </BlurFade>

        <BlurFade delay={0.8} duration={0.5} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-blue px-8 py-4 text-sm font-medium text-on-ink shadow-[0px_4px_14px_rgba(58,79,55,0.28)] transition hover:bg-blue-light"
          >
            Plan my wedding, free
          </Link>
          <Link
            href="#features"
            className="rounded-full border border-white/35 bg-white/15 px-8 py-4 text-sm font-medium text-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl transition hover:bg-white/25"
          >
            See how it works
          </Link>
        </BlurFade>
      </div>

      <motion.div
        style={{ y: yPreview, opacity: previewOpacity }}
        className="pointer-events-none absolute bottom-0 left-1/2 z-10 w-[min(100%,280px)] -translate-x-1/2 translate-y-[38%] sm:w-[300px] sm:translate-y-[40%]"
      >
        <BlurFade delay={0.95} duration={0.6}>
          <AgentPhoneMockup className="w-full shadow-[0_-24px_48px_-12px_rgba(74,78,60,0.25)]" />
        </BlurFade>
      </motion.div>
    </section>
  );
}
