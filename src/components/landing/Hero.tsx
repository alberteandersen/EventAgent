import Link from "next/link";
import { JunoDesk } from "./JunoDesk";

/* The opening is Juno at work: her status on a card, waiting for a yes. The
   visitor presses the card's one button and sees what "she does, we decide"
   means before they have read a paragraph. */
export function Hero() {
  return (
    <section data-ground="laurel" className="relative overflow-hidden bg-laurel text-on-laurel">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-x-16 gap-y-10 px-6 pb-20 pt-[6.5rem] sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:pb-24 lg:pt-24">
        <div>
          <h1 className="text-balance font-serif text-[clamp(2.75rem,6.4vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.015em]">
            Mød Juno, jeres bryllups&shy;koordinator.
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-on-laurel-soft">
            Hun finder stederne, skriver til dem på deres eget sprog og gør
            svarene til tilbud, I kan sammenligne. Imens holder hun styr på
            gæster, budget og bordplan. Intet sendes, før I har sagt ja.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link
              href="/login"
              className="rounded-full bg-cream px-8 py-4 text-sm font-semibold text-ink shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)] transition-colors hover:bg-white"
            >
              Kom i gang gratis
            </Link>
            <Link
              href="#arbejde"
              className="text-sm font-medium text-on-laurel underline decoration-on-laurel-soft/60 decoration-1 underline-offset-[6px] transition-colors hover:decoration-on-laurel"
            >
              Se hvordan hun arbejder
            </Link>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-on-laurel-soft">
            Gratis at planlægge. 499 kr. én gang, hvis Juno skal designe jeres
            hjemmeside og invitation.
          </p>
        </div>

        <JunoDesk />
      </div>
    </section>
  );
}
