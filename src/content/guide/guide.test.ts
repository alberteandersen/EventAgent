import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { linksIn, parseMarkdown, wordCount } from "@/lib/guide/markdown";
import { FAQ } from "../faq";
import { ARTICLES, CATEGORIES, getArticle } from "./index";

/* Guardrails for every article that gets added: the hub, sitemap and search
   snippets all break quietly when a slug, a link or a length is off. */

const SITE_PATHS = new Set(["/", "/guide", "/guide/faq", "/login"]);
const resolves = (href: string) =>
  href.startsWith("https://") ||
  SITE_PATHS.has(href.split("#")[0]) ||
  (href.startsWith("/guide/") && Boolean(getArticle(href.slice("/guide/".length).split("#")[0])));

describe("guide articles", () => {
  it("have unique slugs in URL-safe form", () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("put every category to use", () => {
    for (const c of CATEGORIES) expect(ARTICLES.some((a) => a.category === c.id)).toBe(true);
  });

  for (const a of ARTICLES) {
    describe(a.slug, () => {
      const blocks = parseMarkdown(a.body);

      it("fits search result lengths", () => {
        expect(a.seoTitle.length).toBeLessThanOrEqual(60);
        expect(a.description.length).toBeGreaterThanOrEqual(120);
        expect(a.description.length).toBeLessThanOrEqual(160);
      });

      it("answers in a summary that stands on its own", () => {
        const words = wordCount(a.summary);
        expect(words).toBeGreaterThanOrEqual(40);
        expect(words).toBeLessThanOrEqual(80);
      });

      it("is long enough to be worth indexing", () => {
        expect(wordCount(a.body)).toBeGreaterThanOrEqual(600);
      });

      it("has sections, and no H1 of its own", () => {
        expect(blocks.filter((b) => b.type === "h2").length).toBeGreaterThanOrEqual(3);
        expect(a.body).not.toMatch(/^# /m);
      });

      it("leads to Kalas once in the body, with a card that fits", () => {
        expect(blocks.filter((b) => b.type === "kalas").length).toBe(1);
        expect(a.kalas.points.length).toBe(3);
        for (const p of a.kalas.points) expect(p.length).toBeLessThanOrEqual(50);
        expect(a.kalas.cta.length).toBeLessThanOrEqual(26);
      });

      it("links only to pages that exist", () => {
        for (const href of linksIn(blocks)) expect(resolves(href), href).toBe(true);
        for (const s of a.sources ?? []) expect(s.url).toMatch(/^https:\/\//);
      });

      it("relates to other real articles", () => {
        expect(a.related.length).toBeGreaterThan(0);
        for (const r of a.related) {
          expect(r).not.toBe(a.slug);
          expect(getArticle(r), r).toBeDefined();
        }
      });

      it("has valid dates and an image that ships", () => {
        expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(a.updated >= a.published).toBe(true);
        expect(existsSync(join(process.cwd(), "public", a.image.src))).toBe(true);
        expect(a.image.alt.length).toBeGreaterThan(10);
      });
    });
  }

  it("leaves no article without a link to it from another article", () => {
    const linked = new Set(ARTICLES.flatMap((a) => [...a.related, ...linksIn(parseMarkdown(a.body)).map((h) => h.replace("/guide/", ""))]));
    for (const a of ARTICLES) expect(linked.has(a.slug), a.slug).toBe(true);
  });
});

describe("FAQ", () => {
  const items = FAQ.flatMap((g) => g.items);

  it("asks each question once", () => {
    const qs = items.map((i) => i.q);
    expect(new Set(qs).size).toBe(qs.length);
  });

  it("links only to pages that exist", () => {
    for (const i of items) for (const href of linksIn(parseMarkdown(i.a))) expect(resolves(href), href).toBe(true);
  });
});
