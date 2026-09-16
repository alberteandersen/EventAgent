"use client";

import Link from "next/link";
import { useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <BlurFade delay={0.05} duration={0.6} className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto mt-3 flex w-[min(80rem,calc(100%-2rem))] items-center justify-between rounded-full px-6 py-2.5 transition-all duration-300 sm:px-8 ${
          scrolled
            ? "border border-border bg-surface/80 shadow-[0_8px_30px_rgba(74,78,60,0.06)] backdrop-blur-xl"
            : "border border-transparent"
        }`}
      >
        <Link
          href="/"
          className={`flex items-center gap-2 font-[family-name:var(--font-wordmark)] text-[1.6rem] font-bold leading-none transition-colors duration-300 ${
            scrolled ? "text-ink" : "text-surface drop-shadow-[0_1px_8px_rgba(0,0,0,0.25)]"
          }`}
        >
          kalas
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
              scrolled ? "text-ink-body hover:text-ink" : "text-surface/90 hover:text-surface"
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-blue px-4 py-2 text-sm font-medium text-on-ink transition hover:bg-blue-light"
          >
            Get started
          </Link>
        </nav>
      </div>
    </BlurFade>
  );
}
