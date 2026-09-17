import { describe, expect, it } from "vitest";
import { ARTICLES, getCategory } from "@/content/guide";
import { FAQ } from "@/content/faq";
import { answerText, articleSchema, breadcrumbs, faqPage, graph, organization, serializeJsonLd } from "./schema";

describe("JSON-LD", () => {
  it("describes an article with absolute URLs and ISO dates", () => {
    const a = ARTICLES[0];
    const node = articleSchema(a, getCategory(a.category));
    expect(node).toMatchObject({ "@type": "Article", headline: a.title, datePublished: a.published, inLanguage: "da-DK" });
    for (const img of node.image as string[]) expect(img).toMatch(/^https?:\/\//);
    expect(node.url).toMatch(new RegExp(`/guide/${a.slug}$`));
  });

  it("numbers breadcrumbs from one", () => {
    const node = breadcrumbs([{ name: "Forside", path: "/" }, { name: "Guide", path: "/guide" }]);
    expect((node.itemListElement as { position: number }[]).map((i) => i.position)).toEqual([1, 2]);
  });

  it("puts every FAQ question in the FAQPage, answers without markdown", () => {
    const node = faqPage(FAQ);
    const questions = node.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(questions.length).toBe(FAQ.flatMap((g) => g.items).length);
    for (const q of questions) {
      expect(q.acceptedAnswer.text).not.toMatch(/\]\(|\*\*/);
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(40);
    }
  });

  it("keeps link words when flattening an answer", () => {
    expect(answerText("Se [tjeklisten](/guide/bryllup-tjekliste).")).toBe("Se tjeklisten.");
  });

  it("cannot be broken out of its script tag", () => {
    const out = serializeJsonLd(graph({ ...organization(), description: "</script><script>alert(1)</script>" }));
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)["@graph"][0].description).toContain("</script>");
  });
});
