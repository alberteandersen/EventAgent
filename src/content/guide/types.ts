export type GuideCategoryId = "planlaegning" | "oekonomi" | "vielse" | "gaester" | "festen";

export interface GuideCategory {
  id: GuideCategoryId;
  name: string;
  description: string;
}

export interface GuideSource {
  label: string;
  url: string;
}

export interface GuideArticle {
  slug: string;
  category: GuideCategoryId;
  /** The H1. */
  title: string;
  /** The <title>, at most 60 characters. */
  seoTitle: string;
  /** Meta description, 120-160 characters. */
  description: string;
  /** The answer in a few sentences, set above the article. This is the passage
      search and AI answers lift, so it has to stand on its own. */
  summary: string;
  published: string;
  updated: string;
  /** A photo from public/landing, with its alt text. */
  image: { src: string; alt: string };
  related: string[];
  /** What Kalas does about the article's problem. Shown where the body has a
      {{kalas}} line, and again in the sidebar and at the end of the article:
      every guide is a way into the product. */
  kalas: {
    title: string;
    body: string;
    /** Three short, true statements about the product, one line each. */
    points: string[];
    /** Button label, an action rather than "Sign up". */
    cta: string;
  };
  sources?: GuideSource[];
  body: string;
}

export interface FaqItem {
  q: string;
  /** Markdown-subset paragraphs, blank-line separated. */
  a: string;
}

export interface FaqGroup {
  id: string;
  name: string;
  items: FaqItem[];
}
