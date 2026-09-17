import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { ogImagePath } from "./schema";

interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Key of the generated share image under /og. */
  og: string;
  locale?: "da_DK" | "en_US";
  article?: { published: string; modified: string; section: string };
}

/* Canonical, Open Graph and Twitter tags for a public page, in one place so
   every page gets all three. Set per page rather than in the root layout: a
   canonical inherited from the layout would point the couples' own wedding
   sites and every app screen at the landing page. */
export function pageMetadata({ title, description, path, og, locale = "da_DK", article }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const images = [{ url: absoluteUrl(ogImagePath(og)), width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: {
      title,
      description,
      url,
      siteName: "Kalas",
      locale,
      images,
      ...(article
        ? { type: "article", publishedTime: article.published, modifiedTime: article.modified, section: article.section }
        : { type: "website" }),
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}
