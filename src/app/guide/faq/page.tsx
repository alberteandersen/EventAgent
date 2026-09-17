import Link from "next/link";
import { Check } from "lucide-react";
import { FAQ, FAQ_UPDATED } from "@/content/faq";
import { CtaBand } from "@/components/guide/CtaBand";
import { FaqItemCard } from "@/components/guide/FaqItemCard";
import { JsonLd } from "@/components/guide/JsonLd";
import { CtaLink, Eyebrow, formatDate } from "@/components/guide/kalas";
import { pageMetadata } from "@/lib/guide/metadata";
import { breadcrumbs, faqPage, graph, organization, website } from "@/lib/guide/schema";

export const metadata = pageMetadata({
  title: "Spørgsmål og svar om Kalas og bryllupsplanlægning",
  description:
    "Svar på de spørgsmål, par stiller om Kalas og om at planlægge bryllup: pris, godkendelse af mails, prøvelsesattest, vidner, invitationer og bordplan.",
  path: "/guide/faq",
  og: "faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          website(),
          faqPage(FAQ),
          breadcrumbs([
            { name: "Forside", path: "/" },
            { name: "Bryllupsguide", path: "/guide" },
            { name: "Spørgsmål og svar", path: "/guide/faq" },
          ]),
        )}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="Brødkrumme" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link href="/" className="hover:text-ink">Forside</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/guide" className="hover:text-ink">Bryllupsguide</Link></li>
          </ol>
        </nav>

        <header className="mt-6 rounded-[28px] border border-line bg-blush p-7 sm:p-10">
          <Eyebrow>Spørgsmål og svar</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.05] text-ink">
            Det, par spørger os om
          </h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">
            Om Kalas og Ava, og om de ting, næsten alle spørger om, når de planlægger bryllup. Opdateret{" "}
            <time dateTime={FAQ_UPDATED}>{formatDate(FAQ_UPDATED)}</time>.
          </p>
          <nav aria-label="Emner" className="mt-6 flex flex-wrap gap-2">
            {FAQ.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {g.name} <span className="text-muted">{g.items.length}</span>
              </a>
            ))}
          </nav>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
          <div className="min-w-0">
            {FAQ.map((g, gi) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-titel`} className={`scroll-mt-24 ${gi ? "mt-12" : ""}`}>
                <h2 id={`${g.id}-titel`} className="text-3xl font-semibold text-ink md:text-[2.25rem]">{g.name}</h2>
                <div className="mt-5 flex flex-col gap-3">
                  {g.items.map((item, i) => <FaqItemCard key={item.q} item={item} open={gi === 0 && i === 0} />)}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:block">
            <div className="flex flex-col gap-5 lg:sticky lg:top-24">
              <div className="rounded-[28px] bg-ink p-6 text-[#f8f9f8]">
                <Eyebrow light>Kalas</Eyebrow>
                <p className="mt-3 font-serif text-[1.6rem] font-semibold leading-[1.1]">Prøv det selv. Det tager to minutter.</p>
                <ul className="mt-4 space-y-2.5 text-sm text-[#dbe5e0]">
                  {["Gratis at starte", "Ingen kreditkort", "I godkender alt, før noget sendes"].map((p) => (
                    <li key={p} className="flex items-center gap-2.5">
                      <Check size={15} strokeWidth={2.5} aria-hidden className="shrink-0 text-[#a9c2b6]" />
                      {p}
                    </li>
                  ))}
                </ul>
                <CtaLink light className="mt-5 w-full">Prøv Kalas gratis</CtaLink>
              </div>
              <div className="rounded-[28px] border border-line bg-card p-6">
                <Eyebrow>Guides</Eyebrow>
                <p className="mt-3 font-serif text-[1.4rem] font-semibold leading-[1.15] text-ink">Vil I have hele svaret?</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Tjekliste, budget, vielse, lokale og gæster, forklaret trin for trin.
                </p>
                <Link href="/guide" className="mt-4 inline-block text-sm font-semibold text-ink underline decoration-sage decoration-2 underline-offset-4">
                  Se alle guides
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <CtaBand />
    </>
  );
}
