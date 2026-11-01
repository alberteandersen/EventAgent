import { CATEGORIES, articlesIn } from "@/content/guide";
import { FAQ } from "@/content/faq";
import { KALAS_DESCRIPTION } from "@/lib/guide/schema";
import { absoluteUrl } from "@/lib/site-url";

/* llms.txt: a plain map of the site for language models that look for one.
   Google ignores it, so it is a convenience, not an SEO lever; it costs
   nothing because it is generated from the same content as the pages. */

export const dynamic = "force-static";

export function GET() {
  const lines = [
    "# Kalas",
    "",
    `> ${KALAS_DESCRIPTION}`,
    "",
    "Kalas findes på dansk og engelsk. Det er gratis at komme i gang, og intet bliver sendt til lokaler eller leverandører, før parret har godkendt det.",
    "",
    "## Produkt",
    "",
    `- [Kalas](${absoluteUrl("/")}): AI-bryllupsplanlæggeren Juno, der finder lokaler, skriver til dem og samler tilbud`,
    `- [Spørgsmål og svar](${absoluteUrl("/guide/faq")}): pris, godkendelse, sprog, mobil og bryllupshjemmesider`,
    "",
    "## Bryllupsguide",
    "",
    ...CATEGORIES.flatMap((c) => [
      `### ${c.name}`,
      "",
      ...articlesIn(c.id).map((a) => `- [${a.title}](${absoluteUrl(`/guide/${a.slug}`)}): ${a.description}`),
      "",
    ]),
    "## Ofte stillede spørgsmål",
    "",
    ...FAQ.flatMap((g) => g.items.map((i) => `- ${i.q}`)),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
