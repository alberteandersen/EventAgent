import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle, getCategory, relatedTo } from "@/content/guide";
import { ArticleCard } from "@/components/guide/ArticleCard";
import { JsonLd } from "@/components/guide/JsonLd";
import { Markdown } from "@/components/guide/Markdown";
import { Eyebrow, formatDate } from "@/components/guide/kalas";
import {
  InlineProductCard,
  MobileCtaBar,
  ProductNudge,
  SidebarProductCard,
  StartSteps,
} from "@/components/guide/ProductCards";
import { parseMarkdown, readingMinutes } from "@/lib/guide/markdown";
import { pageMetadata } from "@/lib/guide/metadata";
import { articlePath, articleSchema, breadcrumbs, graph, organization, website } from "@/lib/guide/schema";

type Params = { params: Promise<{ slug: string }> };

// Only the articles in content/guide exist; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params) {
  const article = getArticle((await params).slug);
  if (!article) return {};
  return pageMetadata({
    title: article.seoTitle,
    description: article.description,
    path: articlePath(article.slug),
    og: article.slug,
    article: { published: article.published, modified: article.updated, section: getCategory(article.category).name },
  });
}

export default async function GuideArticlePage({ params }: Params) {
  const article = getArticle((await params).slug);
  if (!article) notFound();

  const category = getCategory(article.category);
  const blocks = parseMarkdown(article.body);
  const toc = blocks.flatMap((b) => (b.type === "h2" ? [b] : []));
  const crumbs = [
    { name: "Forside", path: "/" },
    { name: "Bryllupsguide", path: "/guide" },
    { name: article.title, path: articlePath(article.slug) },
  ];

  const tocList = (
    <ol className="mt-3 space-y-1">
      {toc.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`} className="block rounded-lg px-2 py-1.5 text-sm leading-snug text-ink-soft transition-colors hover:bg-shell hover:text-ink">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <JsonLd data={graph(organization(), website(), articleSchema(article, category), breadcrumbs(crumbs))} />

      <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="Brødkrumme" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li><Link href="/" className="hover:text-ink">Forside</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/guide" className="hover:text-ink">Bryllupsguide</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={`/guide#${category.id}`} className="hover:text-ink">{category.name}</Link></li>
          </ol>
        </nav>

        {/* Header in the app's hero band: text beside a framed photo. */}
        <header className="mt-6 grid gap-8 rounded-[28px] border border-line bg-blush p-6 sm:p-9 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <Eyebrow>{category.name}</Eyebrow>
            <h1 className="mt-4 text-[clamp(2.3rem,5vw,3.4rem)] font-semibold leading-[1.05] text-ink">{article.title}</h1>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">{article.description}</p>
            <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
              <span>Af Kalas</span>
              <span aria-hidden>·</span>
              <span>
                Opdateret <time dateTime={article.updated}>{formatDate(article.updated)}</time>
              </span>
              <span aria-hidden>·</span>
              <span>{readingMinutes(article.body)} min. læsning</span>
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border-[6px] border-[#f8f6f0] shadow-[0_16px_40px_rgba(36,65,58,0.18)]">
            <Image
              src={article.image.src}
              alt={article.image.alt}
              fill
              priority
              sizes="(min-width: 1024px) 440px, 100vw"
              className="object-cover"
            />
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
          <article className="min-w-0">
            <section aria-labelledby="kort-svar" className="rounded-[28px] border border-line bg-card p-6 sm:p-7">
              <p id="kort-svar" className="text-xs font-bold uppercase tracking-[0.22em] text-sage">Kort svar</p>
              <p className="mt-3 text-[1.125rem] leading-[1.7] text-ink">{article.summary}</p>
            </section>
            <ProductNudge kalas={article.kalas} />

            <details className="group mt-6 rounded-[22px] border border-line bg-card lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                Indhold i guiden
                <span aria-hidden className="text-muted transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="px-3 pb-4">{tocList}</div>
            </details>

            <div className="mt-2">
              <Markdown blocks={blocks} productCard={<InlineProductCard kalas={article.kalas} />} />
            </div>

            {article.sources?.length ? (
              <section aria-labelledby="kilder" className="mt-12 rounded-[22px] border border-line bg-card p-6">
                <p id="kilder" className="text-xs font-bold uppercase tracking-[0.22em] text-sage">Kilder</p>
                <ul className="mt-3 space-y-2 text-[0.9375rem]">
                  {article.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} rel="noopener" className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <StartSteps cta={article.kalas.cta} />
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-5">
              <nav aria-labelledby="indhold" className="rounded-[28px] border border-line bg-card p-5">
                <p id="indhold" className="px-2 text-xs font-bold uppercase tracking-[0.22em] text-sage">I denne guide</p>
                {tocList}
              </nav>
              <SidebarProductCard kalas={article.kalas} />
            </div>
          </aside>
        </div>
      </div>

      <section aria-labelledby="laes-ogsaa" className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6">
        <Eyebrow>Næste guide</Eyebrow>
        <h2 id="laes-ogsaa" className="mt-2 text-3xl font-semibold text-ink md:text-[2.5rem]">Læs også</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {relatedTo(article).map((a) => <ArticleCard key={a.slug} article={a} />)}
        </div>
      </section>

      <MobileCtaBar cta={article.kalas.cta} />
    </div>
  );
}
