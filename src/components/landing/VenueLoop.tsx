"use client";

/* How she works, in the order it happens: told once, she finds; approved
   once, she writes; answered, she lays the quotes side by side. Alternating
   panels on a numbered spine (the order is the point), each with a miniature
   of the real screen.

   There is one Juno here, not three. She hovers over the step the reader is
   on, and travels with the scroll to the next: up, over the spine, and down,
   exactly as fast as the page moves. */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { Juno } from "@/components/juno/Juno";
import { CapabilityMockup } from "./CapabilityMockups";

type Step = {
  id: string;
  title: React.ReactNode;
  body: string;
  extra?: React.ReactNode;
  tilt: number;
};

const LANGUAGES = ["Dansk", "Italiano", "Français", "Deutsch", "English"];

const steps: Step[] = [
  {
    id: "meet",
    title: (
      <>
        Fortæl hende det <span className="text-accent">som til en ven.</span>
      </>
    ),
    body: "“60 gæster, ved vandet, september 2027” er nok. Juno finder rigtige steder, der passer, i Danmark eller der, hvor I vil giftes, med billeder, anmeldelser og kontaktoplysninger. I gemmer dem, I kan lide.",
    tilt: -1.2,
  },
  {
    id: "outreach",
    title: (
      <>
        Hun skriver til hvert sted{" "}
        <span className="text-accent">på dets eget sprog.</span>
      </>
    ),
    body: "Ét udkast, som I godkender, bliver til en personlig mail til hvert sted på jeres liste: dansk til badehotellet, italiensk til villaen. Mailen går fra Junos egen postkasse, så jeres indbakke får fred.",
    extra: (
      <div className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <li key={l} className="rounded-full border border-border bg-white/70 px-3 py-1 text-[0.78rem] font-medium text-ink-body">
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[0.82rem] text-ink-body">25 sprog i alt, valgt ud fra stedets adresse.</p>
      </div>
    ),
    tilt: 1.4,
  },
  {
    id: "quotes",
    title: (
      <>
        Svarene bliver til{" "}
        <span className="text-accent">tilbud, I kan sammenligne.</span>
      </>
    ),
    body: "Når et sted svarer, får I en mail. Juno har allerede trukket pris, dato og vilkår ud og stillet tilbuddene side om side, og hun har et udkast til svaret klar, som I godkender.",
    tilt: -1.4,
  },
];

const SIZE = 108; // Juno's width here, in px
const BASE = SIZE * 0.95 * (174 / 190); // from her top edge down to her underside
// How far down the window (as a share of its height) her perch has risen
// when she leaves it, and how far down the next one has risen when she lands.
const TAKE_OFF = 0.25;
const LAND = 0.4;

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function VenueLoop() {
  const still = useReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const screens = useRef<(HTMLDivElement | null)[]>([]);
  // Where the scroll says she is, and the same with a little give in it, so
  // a mouse wheel's steps read as one movement.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lean = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 380, damping: 36, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 380, damping: 36, mass: 0.6 });
  const springLean = useSpring(lean, { stiffness: 220, damping: 24 });
  const [on, setOn] = useState(0);
  const [flying, setFlying] = useState(false);
  const [placed, setPlaced] = useState(false);
  const last = useRef({ on: 0, flying: false, placed: false });

  /* Her place is a function of the scroll and nothing else. She rides up the
     window on the step she is over; before it carries her out at the top she
     leaves for the next one, and she is over it by the time it is high enough
     to read. So she stays on screen, drifting down it as the page goes up,
     and keeps pace with the reader however fast they go. */
  const follow = useCallback(() => {
    const box = list.current?.getBoundingClientRect();
    const rects = screens.current.map((el) => el?.getBoundingClientRect());
    if (!box || rects.some((r) => !r)) return;
    const perch = (i: number) => {
      const r = rects[i]!;
      // Just above the top edge of the screen, on the side away from the spine.
      const left = i % 2 === 1 ? r.left + 26 : r.right - 26 - SIZE;
      return { x: left - box.left, y: r.top - box.top - BASE - 10 };
    };
    // Her top edge at perch i, measured down the window.
    const height = (i: number) => rects[i]!.top - BASE - 10;
    const leave = Math.max(150, window.innerHeight * TAKE_OFF); // clear of the bar
    const arrive = window.innerHeight * LAND;

    let i = 0;
    while (i < rects.length - 1 && height(i + 1) <= arrive) i += 1;
    let u = 0; // 0 over step i, 1 over the next
    if (i < rects.length - 1) {
      const apart = height(i + 1) - height(i);
      u = Math.min(1, Math.max(0, (leave - height(i)) / (leave + apart - arrive)));
    }
    const from = perch(i);
    const to = perch(Math.min(i + 1, rects.length - 1));
    const e = ease(u);
    const arc = Math.sin(Math.PI * u);
    x.set(from.x + (to.x - from.x) * e);
    y.set(from.y + (to.y - from.y) * e - 44 * arc);
    lean.set(Math.sign(to.x - from.x) * 9 * arc);

    const now = { on: e < 0.5 ? i : i + 1, flying: u > 0.03 && u < 0.97, placed: true };
    if (!last.current.placed) {
      // First placement: no travel from the corner.
      springX.jump(x.get());
      springY.jump(y.get());
      setPlaced(true);
    }
    if (now.on !== last.current.on) setOn(now.on);
    if (now.flying !== last.current.flying) setFlying(now.flying);
    last.current = now;
  }, [x, y, lean, springX, springY]);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    let frame = 0;
    const queue = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; follow(); }); };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    const watch = new ResizeObserver(queue);
    watch.observe(el);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      watch.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [follow]);

  return (
    <section id="arbejde" className="relative scroll-mt-24 overflow-x-clip bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <h2 className="mx-auto max-w-3xl text-balance text-center font-serif text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.01em] text-ink sm:text-6xl">
          Fra første ønske til <span className="text-accent">booket sted.</span>
        </h2>

        <div className="relative mt-24 sm:mt-32">
          {/* spine */}
          <div
            aria-hidden
            className="absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 lg:block"
            style={{ background: "repeating-linear-gradient(to bottom, #C9CDB4 0 6px, transparent 6px 14px)" }}
          />

          <ol ref={list} className="relative space-y-28 lg:space-y-32">
            {steps.map((step, i) => {
              const mockupFirst = i % 2 === 1;
              return (
                <li key={step.id} className="relative grid items-center gap-x-16 gap-y-24 lg:grid-cols-2">
                  {/* spine node */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-1/2 z-10 hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-cream font-serif text-base font-semibold text-accent-ink lg:flex"
                  >
                    {i + 1}
                  </div>

                  <div className={mockupFirst ? "min-w-0 lg:order-2 lg:pl-10" : "min-w-0 lg:pr-10"}>
                    <h3 className="max-w-md text-balance font-serif text-4xl font-semibold leading-[1.04] tracking-[-0.01em] text-ink sm:text-[2.75rem]">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-ink-body">{step.body}</p>
                    {step.extra}
                  </div>

                  <div className={mockupFirst ? "min-w-0 lg:order-1 lg:pr-10" : "min-w-0 lg:pl-10"}>
                    <motion.div
                      ref={(el) => { screens.current[i] = el; }}
                      initial={false}
                      style={{ rotate: step.tilt }}
                      whileHover={{ rotate: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className="relative shadow-[0_28px_64px_-28px_rgba(74,78,60,0.4)]"
                    >
                      <CapabilityMockup id={step.id} />
                    </motion.div>
                  </div>
                </li>
              );
            })}

            {/* The one Juno. Not a list item's content: she belongs to the whole
                list, so she is positioned against it. */}
            <motion.li
              aria-hidden
              role="presentation"
              style={{ x: still ? x : springX, y: still ? y : springY, rotate: still ? 0 : springLean, opacity: placed ? 1 : 0 }}
              className="pointer-events-none absolute left-0 top-0 z-20 !mt-0 list-none transition-opacity duration-500"
            >
              <div className="juno-bob">
                <Juno
                  size={SIZE}
                  shadow={false}
                  flight={flying && !still ? "fly" : "hover"}
                  look={{ x: on % 2 === 1 ? 0.5 : -0.5, y: 1 }}
                />
              </div>
            </motion.li>
          </ol>
        </div>
      </div>
    </section>
  );
}
