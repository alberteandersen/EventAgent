import type { GuideArticle, GuideCategory, GuideCategoryId } from "./types";
import { article as tjekliste } from "./articles/bryllup-tjekliste";
import { article as budget } from "./articles/hvad-koster-et-bryllup";
import { article as vielse } from "./articles/saadan-bliver-i-gift";
import { article as lokale } from "./articles/find-bryllupslokale";
import { article as gaesteliste } from "./articles/gaesteliste-til-bryllup";
import { article as bordplan } from "./articles/bordplan-til-bryllup";
import { article as invitationer } from "./articles/save-the-date-og-invitationer";
import { article as hjemmeside } from "./articles/bryllupshjemmeside";
import { article as program } from "./articles/program-for-bryllupsdagen";

/* To publish an article: write it under articles/, import it here, and add it
   to ARTICLES. The sitemap, the hub, related links and the OG image all read
   from this list, and guide.test.ts checks the new article's links and lengths. */

export const CATEGORIES: GuideCategory[] = [
  { id: "planlaegning", name: "Planlægning", description: "Hvad I skal gøre hvornår, fra forlovelsen til dagen efter." },
  { id: "oekonomi", name: "Budget og økonomi", description: "Hvad et bryllup koster, og hvordan I får pengene til at slå til." },
  { id: "vielse", name: "Vielsen", description: "Prøvelsesattest, rådhus, kirke og alt det praktiske omkring at blive gift." },
  { id: "festen", name: "Lokale og festen", description: "Find stedet, og planlæg dagen fra vielse til natmad." },
  { id: "gaester", name: "Gæster og invitationer", description: "Gæsteliste, invitationer, bordplan og bryllupshjemmeside." },
];

/** Hub order: the article to start with first. */
export const ARTICLES: GuideArticle[] = [
  tjekliste, budget, vielse, lokale, gaesteliste, invitationer, bordplan, hjemmeside, program,
];

export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);

export const getCategory = (id: GuideCategoryId) => CATEGORIES.find((c) => c.id === id)!;

export const articlesIn = (id: GuideCategoryId) => ARTICLES.filter((a) => a.category === id);

export const relatedTo = (article: GuideArticle) =>
  article.related.map(getArticle).filter((a): a is GuideArticle => Boolean(a));

/** The hub's "Start her" card: the first guides a couple needs, in order. */
export const START_PATH: { label: string; slug: string }[] = [
  { label: "Læg budgettet", slug: "hvad-koster-et-bryllup" },
  { label: "Find og book lokalet", slug: "find-bryllupslokale" },
  { label: "Lav gæstelisten", slug: "gaesteliste-til-bryllup" },
  { label: "Søg om at blive gift", slug: "saadan-bliver-i-gift" },
];

/** Latest change across the guide, for the hub's sitemap entry. */
export const guideUpdated = () => ARTICLES.map((a) => a.updated).sort().at(-1)!;
