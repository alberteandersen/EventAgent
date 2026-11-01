/* Schema.org JSON-LD for the public pages. Each page emits one @graph, and the
   organisation and website nodes are referenced by @id rather than repeated,
   so search engines and AI crawlers read one consistent description of Kalas. */

import { absoluteUrl, SITE_URL } from "@/lib/site-url";
import type { FaqGroup, GuideArticle, GuideCategory } from "@/content/guide/types";
import { parseMarkdown, plainText, wordCount } from "./markdown";

type Node = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const KALAS_DESCRIPTION =
  "Kalas er en bryllupsplanlægger med AI-assistenten Juno, der finder bryllupslokaler, skriver til dem og samler svarene som tilbud, og holder styr på tjekliste, budget, gæsteliste, invitationer og bordplan.";

export const graph = (...nodes: Node[]) => ({ "@context": "https://schema.org", "@graph": nodes });

export function organization(): Node {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Kalas",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: absoluteUrl("/kalas-logo.png"), width: 288, height: 200 },
    description: KALAS_DESCRIPTION,
  };
}

export function website(): Node {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: "Kalas",
    inLanguage: ["da-DK", "en"],
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplication(): Node {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: "Kalas",
    url: SITE_URL,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description: KALAS_DESCRIPTION,
    inLanguage: ["da-DK", "en"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "DKK", description: "Gratis at komme i gang" },
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export const articlePath = (slug: string) => `/guide/${slug}`;
export const ogImagePath = (key: string) => `/og/${key}`;

export function articleSchema(article: GuideArticle, category: GuideCategory): Node {
  const url = absoluteUrl(articlePath(article.slug));
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.description,
    abstract: article.summary,
    url,
    mainEntityOfPage: url,
    image: [absoluteUrl(ogImagePath(article.slug)), absoluteUrl(article.image.src)],
    datePublished: article.published,
    dateModified: article.updated,
    inLanguage: "da-DK",
    articleSection: category.name,
    wordCount: wordCount(article.body),
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(article.sources?.length ? { citation: article.sources.map((s) => s.url) } : {}),
  };
}

export function guideCollection(articles: GuideArticle[]): Node {
  return {
    "@type": "CollectionPage",
    "@id": `${absoluteUrl("/guide")}#page`,
    name: "Bryllupsguide",
    url: absoluteUrl("/guide"),
    inLanguage: "da-DK",
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORG_ID },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(articlePath(a.slug)),
        name: a.title,
      })),
    },
  };
}

/** Answers as plain text: markdown links keep their words, lose their URLs. */
export const answerText = (md: string) =>
  parseMarkdown(md)
    .map((b) => (b.type === "p" || b.type === "callout" ? plainText(b.inline) : ""))
    .filter(Boolean)
    .join("\n\n");

export function faqPage(groups: FaqGroup[]): Node {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/guide/faq")}#page`,
    url: absoluteUrl("/guide/faq"),
    inLanguage: "da-DK",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: groups.flatMap((g) =>
      g.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: answerText(item.a) },
      })),
    ),
  };
}

/** Safe inside a <script>: a "</script>" in any string cannot close the tag. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
