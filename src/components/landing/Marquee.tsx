"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type ViewportOptions } from "motion/react";
import { cn } from "@/lib/utils";

const eventCards = [
  {
    label: "Vielse i haven",
    image: "/landing/garden-ceremony.jpg",
    alt: "Vielse i en have under gamle træer",
    className: "col-span-4 row-span-3",
    viewport: { once: true, amount: 0.35, margin: "0px 0px -20% 0px" },
    fromY: 24,
  },
  {
    label: "Fest i byen",
    image: "/landing/city-reception.jpg",
    alt: "Bryllupsfest i en gårdhave i København",
    className: "col-span-4 row-span-2 col-start-5",
    viewport: { once: true, amount: 0.4, margin: "-10% 0px -25% 0px" },
    fromY: 18,
  },
  {
    label: "Bryllup i udlandet",
    image: "/landing/destination.jpg",
    alt: "Bryllupsmiddag på terrassen ved en villa i Toscana i solnedgangen",
    className: "col-span-4 row-span-4 col-start-9 row-start-1",
    viewport: { once: true, amount: 0.3, margin: "-15% 0px -15% 0px" },
    fromY: 28,
  },
  {
    label: "Rustikke lader",
    image: "/landing/rustic-barn.jpg",
    alt: "Bryllup i en skandinavisk lade i levende lys",
    className: "col-span-4 row-span-3 col-start-1 row-start-4",
    viewport: { once: true, amount: 0.35, margin: "-20% 0px -10% 0px" },
    fromY: 22,
  },
  {
    label: "Små bryllupper",
    image: "/landing/elopement.jpg",
    alt: "Brudepar alene på en eng ved klinterne",
    className: "col-span-4 row-span-2 col-start-5 row-start-3",
    viewport: { once: true, amount: 0.4, margin: "-25% 0px -5% 0px" },
    fromY: 20,
  },
  {
    label: "Fest på taget",
    image: "/landing/rooftop.jpg",
    alt: "Bryllupsfest på en tagterrasse i den blå time",
    className: "col-span-8 row-span-2 col-start-5 row-start-5",
    viewport: { once: true, amount: 0.35, margin: "-30% 0px 0px 0px" },
    fromY: 16,
  },
];

function EventCard({
  label,
  image,
  alt,
  className,
  viewport,
  fromY,
}: (typeof eventCards)[number]) {
  return (
    <motion.div
      initial={{ opacity: 0, y: fromY, scale: 0.94, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={viewport as ViewportOptions}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative min-h-[140px] overflow-hidden rounded-2xl border border-[#D4D6C0]/70 bg-[#F6F0E8] shadow-[0_10px_28px_-12px_rgba(74,78,60,0.18)] sm:min-h-0 sm:rounded-[1.25rem]",
        className
      )}
    >
      <Image src={image} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 42vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#4A4E3C]/25 via-transparent to-transparent" />
      <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#4A4E3C] shadow-[0_2px_8px_rgba(74,78,60,0.12)] sm:bottom-3.5 sm:left-3.5 sm:px-3.5 sm:py-2 sm:text-xs">
        {label}
      </span>
    </motion.div>
  );
}

export function Marquee() {
  return (
    <section className="border-y border-[#D4D6C0] bg-[#F6F0E8] py-14 sm:py-20 lg:py-24 overflow-x-clip">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,36%)_minmax(0,64%)] lg:gap-12 xl:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg"
        >
          <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-accent">
            Jeres dag, på jeres måde
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.01em] text-[#4A4E3C] sm:text-6xl lg:text-[4rem]">
            Til alle slags bryllupper
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#7A8066] sm:text-[17px]">
            Fra det lille bryllup for to til den store fest: Kalas finder stedet,
            skriver til leverandørerne og holder styr på detaljerne, så I kan
            koncentrere jer om hinanden.
          </p>
          <Link
            href="#features"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#4A4E3C] px-6 py-3.5 text-sm font-medium text-[#F6F0E8] transition hover:bg-[#575B47]"
          >
            Se hvordan det virker
            <span aria-hidden>→</span>
          </Link>
        </motion.div>

        <div className="grid h-[520px] w-full min-w-0 grid-cols-12 grid-rows-6 gap-3 sm:h-[580px] sm:gap-4 lg:h-[640px]">
          {eventCards.map((card) => (
            <EventCard key={card.label} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}
