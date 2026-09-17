import { CtaLink, Eyebrow } from "./kalas";

export function CtaBand() {
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[28px] bg-ink px-7 py-12 text-center text-[#f8f9f8] sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 480px 260px at 100% 0%, rgba(219,229,224,0.16), transparent 70%)" }}
        />
        <Eyebrow light className="relative">Kalas</Eyebrow>
        <h2 className="relative mx-auto mt-3 max-w-2xl text-[2.4rem] font-semibold leading-[1.05] sm:text-5xl">
          Lad Ava tage det tunge arbejde
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-[#dbe5e0]">
          Ava finder lokaler, skriver til dem og samler svarene som tilbud, I kan sammenligne. Budget, gæsteliste og
          tjekliste har I samlet ét sted.
        </p>
        <CtaLink light className="relative mt-8">Prøv Kalas gratis</CtaLink>
        <p className="relative mt-3 text-xs text-[#a9c2b6]">Ingen kreditkort · I godkender alt, før noget sendes</p>
      </div>
    </section>
  );
}
