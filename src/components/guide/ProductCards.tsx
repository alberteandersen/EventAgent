import { Check } from "lucide-react";
import type { GuideArticle } from "@/content/guide/types";
import Link from "next/link";
import { CtaLink, Eyebrow, SIGNUP_HREF } from "./kalas";

/* The ways an article leads to Kalas. Each one says what the product does
   about the problem the reader is reading about, never just "sign up". */

const REASSURANCE = "Gratis at starte · Ingen kreditkort · I godkender alt";

/** In the body, where the article's {{kalas}} line is. */
export function InlineProductCard({ kalas }: { kalas: GuideArticle["kalas"] }) {
  return (
    <aside className="my-10 overflow-hidden rounded-[28px] bg-ink text-[#f8f9f8]">
      <div className="grid gap-6 p-7 sm:p-9 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <Eyebrow light>Sådan hjælper Kalas</Eyebrow>
          {/* Not a heading: the article's outline should stay the article's. */}
          <p className="mt-3 font-serif text-[2rem] font-semibold leading-[1.05]">{kalas.title}</p>
          <p className="mt-3 text-[0.975rem] leading-relaxed text-[#dbe5e0]">{kalas.body}</p>
        </div>
        <div className="rounded-[22px] bg-white/[0.07] p-5">
          <ul className="space-y-3">
            {kalas.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[0.95rem] leading-snug">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#dbe5e0] text-ink">
                  <Check size={12} strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <CtaLink light className="mt-5 w-full">{kalas.cta}</CtaLink>
          <p className="mt-3 text-center text-xs text-[#a9c2b6]">{REASSURANCE}</p>
        </div>
      </div>
    </aside>
  );
}

/** Right after the short answer: a quiet one-liner for readers ready to act. */
export function ProductNudge({ kalas }: { kalas: GuideArticle["kalas"] }) {
  return (
    <Link
      href={SIGNUP_HREF}
      className="group mt-4 flex items-center gap-4 rounded-[22px] border border-line bg-card px-5 py-4 transition-colors hover:border-sage"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-serif text-lg font-semibold text-[#f8f9f8]" aria-hidden>
        A
      </span>
      <span className="flex-1 text-[0.95rem] leading-snug text-ink-soft">
        <span className="font-semibold text-ink">Vil I hellere have det gjort?</span> {kalas.title}.
      </span>
      <span className="hidden text-sm font-semibold text-ink sm:inline">{kalas.cta} →</span>
    </Link>
  );
}

/** Sticky in the sidebar on wide screens. */
export function SidebarProductCard({ kalas }: { kalas: GuideArticle["kalas"] }) {
  return (
    <div className="rounded-[28px] border border-line bg-[#e6e9e6] p-6">
      <Eyebrow>Planlæg med Juno</Eyebrow>
      <p className="mt-3 font-serif text-[1.5rem] font-semibold leading-[1.1] text-ink">{kalas.title}</p>
      <ul className="mt-4 space-y-2.5">
        {kalas.points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm leading-snug text-ink-soft">
            <Check size={15} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0 text-sage-strong" />
            {p}
          </li>
        ))}
      </ul>
      <CtaLink className="mt-5 w-full">{kalas.cta}</CtaLink>
      <p className="mt-3 text-center text-xs text-muted">Gratis at starte</p>
    </div>
  );
}

/** At the end of the article: how little it takes to start. */
export function StartSteps({ cta }: { cta: string }) {
  const steps = [
    { title: "Fortæl Juno om jeres bryllup", body: "Dato, gæstetal, budget og hvor I drømmer om at holde det." },
    { title: "Godkend det, hun foreslår", body: "Forespørgsler, tjekliste og budget. Intet bliver sendt uden jer." },
    { title: "Sammenlign og beslut", body: "Svarene samles som tilbud, så I kan vælge med ro i maven." },
  ];
  return (
    <section aria-labelledby="kom-i-gang" className="mt-14 rounded-[28px] border border-line bg-card p-7 sm:p-9">
      <Eyebrow>Fra guide til plan</Eyebrow>
      <h2 id="kom-i-gang" className="mt-3 text-[2rem] font-semibold leading-[1.05] text-ink">
        Klar til at komme i gang?
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-[22px] bg-shell p-5">
            <span className="flex size-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-[#f8f9f8]">{i + 1}</span>
            <p className="mt-3 font-semibold leading-snug text-ink">{s.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <CtaLink>{cta}</CtaLink>
        <p className="text-sm text-muted">{REASSURANCE}</p>
      </div>
    </section>
  );
}

/** Pinned to the bottom of the screen on phones, where there is no sidebar. */
export function MobileCtaBar({ cta }: { cta: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <p className="text-sm leading-tight text-ink-soft">
          <span className="block font-semibold text-ink">Lad Juno gøre arbejdet</span>
          Gratis at starte
        </p>
        <Link href={SIGNUP_HREF} className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-[#f8f9f8]">
          {cta}
        </Link>
      </div>
    </div>
  );
}
