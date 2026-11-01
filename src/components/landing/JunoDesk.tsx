"use client";

/* Juno's desk: she flies in and hovers over a small stack of notes to the
   couple, and the top one waits for an answer. Pressing its button is the
   page's one authored moment: she is pleased, her arrow carries the note off,
   and the next one shows what she did with the yes. Four notes, the order a wedding takes: found,
   written, answered, and everything else she is keeping.

   The venues are invented on purpose (see CapabilityMockups); the note under
   the stack says so. */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HEART, Juno } from "@/components/juno/Juno";

const PLACES = [
  { name: "Sandrevlen Badehotel", where: "Bornholm", photo: "/landing/elopement.jpg" },
  { name: "Ellemose Herregård", where: "Fyn", photo: "/landing/rustic-barn.jpg" },
  { name: "Kløverhøj Lade", where: "Djursland", photo: "/landing/garden-ceremony.jpg" },
  { name: "Villa Aurelisa", where: "Toscana", photo: "/landing/destination.jpg" },
];

const QUOTES = [
  { name: "Sandrevlen Badehotel", terms: "Ledig 12. sep. · menu og vin", price: "77.700 kr." },
  { name: "Ellemose Herregård", terms: "Ledig 19. sep. · eksklusiv leje", price: "124.000 kr." },
  { name: "Villa Aurelisa", terms: "Ledig 5. sep. · villa og middag", price: "14.500 €" },
];

const KEEPING = [
  ["Gæster", "42 af 60 har svaret"],
  ["Budget", "96.200 af 150.000 kr. aftalt"],
  ["Bordplan", "54 af 60 har en plads"],
] as const;

type Note = { when: string; says: string; body: React.ReactNode; action: string };

const NOTES: Note[] = [
  {
    when: "torsdag 19.42",
    says: "Jeg har fundet 12 steder ved vandet med plads til 60 i september. I har gemt de fire her. Skal jeg skrive til dem?",
    action: "Ja, skriv til dem",
    body: (
      <ul className="grid grid-cols-2 gap-2.5">
        {PLACES.map((p) => (
          <li key={p.name} className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="relative h-16">
              <Image src={p.photo} alt="" fill sizes="200px" className="object-cover" />
            </div>
            <p className="truncate px-2.5 pt-1.5 font-serif text-[0.95rem] font-semibold leading-tight text-ink">{p.name}</p>
            <p className="px-2.5 pb-2 text-[0.72rem] text-ink-body">{p.where}</p>
          </li>
        ))}
      </ul>
    ),
  },
  {
    when: "torsdag 19.44",
    says: "Her er udkastet til Villa Aurelisa. Det er på italiensk; de tre danske steder får det på dansk.",
    action: "Godkend og send",
    body: (
      <div lang="it" className="rounded-xl border border-border bg-white px-4 py-3.5 text-[0.84rem] leading-relaxed text-ink-body">
        <p className="text-ink">Gentile staff di Villa Aurelisa,</p>
        <p className="mt-1.5">
          ci sposiamo a settembre 2027 e ci siamo innamorati della vostra
          terrazza sui vigneti. Saremo circa 60 invitati. Avreste
          disponibilità, e quale sarebbe il prezzo?
        </p>
        <p className="mt-1.5 text-ink">Cordiali saluti, Juno, per conto di Emma e Frederik</p>
      </div>
    ),
  },
  {
    when: "mandag 08.15",
    says: "Tre har svaret. Jeg har trukket pris, dato og vilkår ud af hvert svar, så I kan sammenligne.",
    action: "Vis mig resten",
    body: (
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
        {QUOTES.map((q) => (
          <li key={q.name} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-serif text-[1rem] font-semibold leading-tight text-ink">{q.name}</p>
              <p className="truncate text-[0.74rem] text-ink-body">{q.terms}</p>
            </div>
            <p className="shrink-0 text-[0.9rem] font-semibold tabular-nums text-ink">{q.price}</p>
          </li>
        ))}
      </ul>
    ),
  },
  {
    when: "i dag 07.30",
    says: "Imens holder jeg styr på resten, så I kan se, hvor I står, når I spørger.",
    action: "Kom i gang gratis",
    body: (
      <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
        {KEEPING.map(([what, state]) => (
          <div key={what} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <dt className="font-serif text-[1rem] font-semibold text-ink">{what}</dt>
            <dd className="text-[0.82rem] tabular-nums text-ink-body">{state}</dd>
          </div>
        ))}
      </dl>
    ),
  },
];

export function JunoDesk() {
  const [step, setStep] = useState(0);
  const [glad, setGlad] = useState(false);
  // Counts the notes she has sent; each one is carried off by an arrow.
  const [sent, setSent] = useState(0);
  // She arrives on the wing, then settles into a hover.
  const [arrived, setArrived] = useState(false);
  const calm = useRef<ReturnType<typeof setTimeout>>(undefined);
  const still = useReducedMotion();
  const note = NOTES[step];
  const last = step === NOTES.length - 1;

  useEffect(() => () => clearTimeout(calm.current), []);

  const yes = () => {
    setGlad(true);
    clearTimeout(calm.current);
    calm.current = setTimeout(() => setGlad(false), 1200);
    setSent((n) => n + 1);
    setStep((s) => Math.min(s + 1, NOTES.length - 1));
  };

  const button =
    "rounded-full bg-laurel px-5 py-2.5 text-[0.84rem] font-semibold text-on-laurel transition-colors hover:bg-blue-light";

  return (
    <div className="relative mx-auto w-full max-w-[27rem] pt-[178px] lg:mx-0 lg:justify-self-end">
      {/* She comes in from above on a curve, and hovers over the stack,
          reading what is on it. */}
      <motion.div
        className="absolute right-3 top-0 z-20"
        initial={still ? false : { x: 170, y: -230, rotate: 16, opacity: 0 }}
        animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={{
          x: { duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 1.5, delay: 0.3, ease: [0.5, 0, 0.2, 1] },
          rotate: { duration: 1.5, delay: 0.3, ease: [0.3, 0, 0.2, 1] },
          opacity: { duration: 0.35, delay: 0.3 },
        }}
        onAnimationComplete={() => setArrived(true)}
      >
        <div className="juno-bob">
          <Juno
            size={190}
            follow
            bow
            mood={glad ? "glad" : "calm"}
            flight={arrived || still ? "hover" : "fly"}
            look={{ x: -0.55, y: 0.95 }}
            shadow={false}
          />
        </div>
      </motion.div>
      {/* Her shadow on the top note. */}
      <div aria-hidden className="juno-bob-shadow absolute right-[66px] top-[184px] z-[15] h-2.5 w-[84px] rounded-[50%] bg-[#1c2a19] opacity-20 blur-[3px]" />
      {/* Approved: off it goes. */}
      {sent > 0 && !still && (
        <svg
          key={sent}
          aria-hidden
          viewBox="0 0 80 24"
          width={80}
          height={24}
          className="pointer-events-none absolute right-10 top-[78px] z-30 [animation:juno-shot_780ms_cubic-bezier(0.3,0,0.7,1)_both]"
        >
          <path d="M6 12 H62 M6 12 l-5 -4.5 M6 12 l-5 4.5 M12 12 l-5 -4.5 M12 12 l-5 4.5" fill="none" stroke="#c99b3f" strokeWidth="3" strokeLinecap="round" />
          <path d={HEART} transform="translate(66 12) rotate(-90)" fill="#cf5f4b" />
        </svg>
      )}

      <div className="relative">
        {/* The rest of the stack. */}
        <div aria-hidden className="absolute inset-0 translate-y-3 rotate-[2.2deg] rounded-[1.4rem] bg-[#e4dccd]" />
        <div aria-hidden className="absolute inset-0 translate-y-1.5 -rotate-[1.3deg] rounded-[1.4rem] bg-[#ede6d9]" />

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.article
            key={step}
            aria-live="polite"
            initial={still ? false : { opacity: 0, scale: 0.975, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still ? { opacity: 0 } : { opacity: 0, x: -70, y: -26, rotate: -7 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 rounded-[1.4rem] bg-cream p-5 text-ink shadow-[0_34px_60px_-34px_rgba(8,16,7,0.75)] sm:p-6"
          >
            <p className="text-[0.78rem] text-ink-body">
              <span className="font-semibold text-ink">Juno</span> · {note.when}
            </p>
            <p className="mt-2.5 text-[0.98rem] leading-relaxed text-ink">{note.says}</p>
            <div className="mt-4">{note.body}</div>

            <div className="mt-5 flex items-center justify-between gap-4">
              {last ? (
                <Link href="/login" className={button}>{note.action}</Link>
              ) : (
                <button type="button" onClick={yes} className={`${button} cursor-pointer`}>{note.action}</button>
              )}
              {last ? (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="cursor-pointer text-[0.8rem] text-ink-body underline decoration-border-strong underline-offset-4 hover:text-ink"
                >
                  Forfra
                </button>
              ) : (
                <p className="text-[0.78rem] tabular-nums text-ink-body">{step + 1} af {NOTES.length}</p>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <p className="mt-7 text-center text-[0.78rem] text-on-laurel-soft">
        Et eksempel. Stederne og parret er opdigtede.
      </p>
    </div>
  );
}
