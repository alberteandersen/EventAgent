import Link from "next/link";
import { Check, Inbox, ListChecks, Wallet } from "lucide-react";
import { ARTICLES, CATEGORIES, START_PATH, articlesIn, getArticle, guideUpdated } from "@/content/guide";
import type { GuideCategoryId } from "@/content/guide/types";
import { FAQ } from "@/content/faq";
import { ArticleCard } from "@/components/guide/ArticleCard";
import { CtaBand } from "@/components/guide/CtaBand";
import { FaqItemCard } from "@/components/guide/FaqItemCard";
import { JsonLd } from "@/components/guide/JsonLd";
import { ArrowDot, CtaLink, Eyebrow, formatDate } from "@/components/guide/kalas";
import { readingMinutes } from "@/lib/guide/markdown";
import { pageMetadata } from "@/lib/guide/metadata";
import { breadcrumbs, graph, guideCollection, organization, website } from "@/lib/guide/schema";

export const metadata = pageMetadata({
  title: "Bryllupsguide: planlægning, budget og vielse | Kalas",
  description:
    "Kalas' bryllupsguide giver konkrete råd om tjekliste, bryllupsbudget, prøvelsesattest, bryllupslokale, gæsteliste, invitationer og bordplan.",
  path: "/guide",
  og: "guide",
});

const JUNO_DOES = [
  { icon: Inbox, title: "Skriver til lokalerne", body: "Juno finder rigtige lokaler og sender jeres forespørgsel til dem, på deres eget sprog." },
  { icon: Wallet, title: "Samler tilbuddene", body: "Svarene bliver til tilbud side om side, og budgettet viser, hvad I har forpligtet jer til." },
  { icon: ListChecks, title: "Holder styr på resten", body: "Tjekliste, gæsteliste, invitationer og bordplan ét sted, delt med jeres partner." },
];

const linkUnderline = "text-sm font-semibold text-ink underline decoration-sage decoration-2 underline-offset-4";

export default function GuideHubPage() {
  const faqPreview = FAQ.flatMap((g) => g.items).slice(0, 5);
  // The product band sits after the smaller topics, before the biggest one.
  const largest = [...CATEGORIES].sort((a, b) => articlesIn(b.id).length - articlesIn(a.id).length)[0];
  const smaller = CATEGORIES.filter((c) => c.id !== largest.id);

  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          website(),
          guideCollection(ARTICLES),
          breadcrumbs([{ name: "Forside", path: "/" }, { name: "Bryllupsguide", path: "/guide" }]),
        )}
      />

      {/* The same band as the app's home screen, with a "start here" card like its checklist. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="grid gap-8 rounded-[28px] border border-line bg-blush p-7 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <Eyebrow>Bryllupsguide</Eyebrow>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.05] text-ink">
              Planlæg brylluppet uden at gætte
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              Konkrete råd om tjekliste, budget, vielse, lokale, gæster og selve dagen. Tallene kommer fra Danmarks
              Statistik, reglerne fra borger.dk, og kilderne står under hver guide.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
              <CtaLink>Prøv Kalas gratis</CtaLink>
              <span className="text-sm text-muted">
                {ARTICLES.length} guides · opdateret <time dateTime={guideUpdated()}>{formatDate(guideUpdated())}</time>
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-card p-6 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Start her</h2>
                <p className="mt-1 text-sm text-ink-soft">De første skridt, i den rækkefølge I får brug for dem.</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-sage-strong">{START_PATH.length} trin</p>
            </div>
            <ol className="mt-5 flex flex-col gap-2.5">
              {START_PATH.map((step, i) => (
                <li key={step.slug}>
                  <Link
                    href={`/guide/${step.slug}`}
                    className="group flex items-center gap-4 rounded-[18px] border border-line bg-canvas px-4 py-3 transition-colors hover:border-sage"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-xs font-bold text-ink-soft">
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold leading-snug text-ink">{step.label}</span>
                      <span className="block text-xs text-muted">{readingMinutes(getArticle(step.slug)!.body)} min. læsning</span>
                    </span>
                    <ArrowDot />
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/guide/bryllup-tjekliste" className={`mt-4 inline-block ${linkUnderline}`}>
              Hele tjeklisten måned for måned
            </Link>
          </div>
        </div>
      </section>

      <nav aria-label="Emner" className="mx-auto mt-10 flex w-full max-w-6xl flex-wrap gap-2 px-4 sm:px-6">
        {CATEGORIES.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="rounded-full border border-line bg-shell px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {c.name} <span className="text-muted">{articlesIn(c.id).length}</span>
          </a>
        ))}
        <Link
          href="/guide/faq"
          className="rounded-full border border-line bg-shell px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Spørgsmål og svar
        </Link>
      </nav>

      {/* Topics as blocks as wide as their guides, packed densely, so a topic with
          one guide sits beside the next instead of leaving a row two-thirds empty. */}
      <div className="mx-auto mt-12 grid w-full max-w-6xl grid-flow-row-dense gap-x-5 gap-y-12 px-4 sm:px-6 lg:grid-cols-12">
        {smaller.map((c) => <Topic key={c.id} id={c.id} />)}
        <FaqTile />
      </div>

      <section aria-labelledby="juno-titel" className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-[28px] border border-line bg-card p-7 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <Eyebrow>Kalas</Eyebrow>
              <h2 id="juno-titel" className="mt-3 text-[2.2rem] font-semibold leading-[1.05] text-ink">
                Guiderne siger, hvad der skal gøres. Juno gør det.
              </h2>
            </div>
            <CtaLink className="self-start lg:self-auto">Prøv Kalas gratis</CtaLink>
          </div>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {JUNO_DOES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[22px] bg-shell p-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-ink text-[#f8f9f8]">
                  <Icon size={18} aria-hidden />
                </span>
                <p className="mt-4 font-semibold text-ink">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted">
            <Check size={15} aria-hidden className="shrink-0 text-sage-strong" />
            Gratis at starte, og intet bliver sendt, før I har godkendt det.
          </p>
        </div>
      </section>

      <div className="mx-auto mt-14 grid w-full max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-12">
        <Topic id={largest.id} />
      </div>

      <section aria-labelledby="faq-titel" className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 id="faq-titel" className="mt-3 text-[2.2rem] font-semibold leading-[1.05] text-ink">Ofte stillede spørgsmål</h2>
            <p className="mt-3 text-ink-soft">Om Kalas, og om det, næsten alle par spørger om.</p>
            <Link href="/guide/faq" className={`mt-5 inline-block ${linkUnderline}`}>
              Se alle spørgsmål og svar
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {faqPreview.map((item) => <FaqItemCard key={item.q} item={item} />)}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

const SPAN: Record<number, string> = { 1: "lg:col-span-4", 2: "lg:col-span-8" };
const COLS: Record<number, string> = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" };

function Topic({ id }: { id: GuideCategoryId }) {
  const category = CATEGORIES.find((c) => c.id === id)!;
  const articles = articlesIn(id);
  const n = articles.length;
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className={`scroll-mt-24 ${SPAN[n] ?? "lg:col-span-12"}`}>
      <Eyebrow>{n === 1 ? "1 guide" : `${n} guides`}</Eyebrow>
      <h2 id={`${id}-titel`} className="mt-2 text-3xl font-semibold text-ink">{category.name}</h2>
      <p className="mt-1.5 min-h-[2.75rem] text-sm leading-relaxed text-ink-soft">{category.description}</p>
      <div className={`mt-4 grid gap-5 ${COLS[n] ?? "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {articles.map((a) => <ArticleCard key={a.slug} article={a} />)}
      </div>
    </section>
  );
}

/** Fills the gap a two-guide topic leaves in a row of three. */
function FaqTile() {
  return (
    <aside className="flex lg:col-span-4">
      <Link
        href="/guide/faq"
        className="group mt-0 flex w-full flex-col justify-between rounded-[28px] border border-line bg-blush p-6 transition-colors hover:border-sage lg:mt-[7.5rem]"
      >
        <div>
          <Eyebrow>Spørgsmål og svar</Eyebrow>
          <p className="mt-3 font-serif text-[1.6rem] font-semibold leading-[1.1] text-ink">Hurtige svar på det, alle spørger om</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Prøvelsesattest, vidner, svarfrister, og hvad Kalas koster.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">{FAQ.flatMap((g) => g.items).length} spørgsmål</span>
          <ArrowDot />
        </div>
      </Link>
    </aside>
  );
}
