import Link from "next/link";
import { Juno } from "@/components/juno/Juno";

/* The close mirrors the opening: the laurel field, and Juno, hovering. */
export function FinalCTA() {
  return (
    <section data-ground="laurel" className="bg-laurel text-on-laurel">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center sm:py-36">
        <div className="juno-bob">
          <Juno size={220} bow follow flight="hover" shadow={false} />
        </div>
        <h2 className="mt-10 text-balance font-serif text-5xl font-semibold leading-[1] tracking-[-0.015em] sm:text-7xl">
          Sig hej til Juno.
        </h2>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-on-laurel-soft">
          Fortæl hende, hvor og hvornår I vil giftes. Hun kan skrive til de
          første steder allerede i dag.
        </p>
        <Link
          href="/login"
          className="mt-10 rounded-full bg-cream px-10 py-4 text-sm font-semibold text-ink shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)] transition-colors hover:bg-white"
        >
          Kom i gang gratis
        </Link>
      </div>
    </section>
  );
}
