"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* The bar answers the ground it is over: a cream pill on the laurel fields,
   a laurel pill on the cream and pistachio ones. A section says it is laurel
   with data-ground="laurel"; the page opens on one, so the bar starts cream. */
export function Nav() {
  const [onLaurel, setOnLaurel] = useState(true);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const line = 44; // the bar's own middle, from the top of the window
      const over = Array.from(document.querySelectorAll<HTMLElement>('[data-ground="laurel"]')).some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      });
      setOnLaurel(over);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      cancelAnimationFrame(frame);
    };
  }, []);

  const shift = "transition-colors duration-300";
  const link = `rounded-full px-3 py-2 text-sm sm:px-4 ${shift} ${
    onLaurel ? "text-ink-body hover:text-ink" : "text-on-laurel-soft hover:text-on-laurel"
  }`;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto mt-3 flex w-[min(80rem,calc(100%-2rem))] items-center justify-between rounded-full border py-2.5 pl-5 pr-2 shadow-[0_10px_30px_-14px_rgba(20,30,18,0.45)] sm:pl-8 sm:pr-2.5 ${shift} ${
          onLaurel ? "border-border bg-cream" : "border-laurel bg-laurel"
        }`}
      >
        <Link
          href="/"
          aria-label="Kalas"
          className={`font-[family-name:var(--font-wordmark)] text-[1.6rem] font-bold leading-none ${shift} ${onLaurel ? "text-ink" : "text-on-laurel"}`}
        >
          kalas
        </Link>
        <nav aria-label="Primær" className="flex items-center gap-1">
          <Link href="/guide" className={`hidden sm:inline-flex ${link}`}>Guides</Link>
          <Link href="/login" className={link}>Log ind</Link>
          <Link
            href="/login"
            className={`ml-1 rounded-full px-4 py-2 text-sm font-semibold ${shift} ${
              onLaurel ? "bg-laurel text-on-laurel hover:bg-blue-light" : "bg-cream text-ink hover:bg-white"
            }`}
          >
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
