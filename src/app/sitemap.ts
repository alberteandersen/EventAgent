import type { MetadataRoute } from "next";
import { ARTICLES, guideUpdated } from "@/content/guide";
import { FAQ_UPDATED } from "@/content/faq";
import { PRIVACY_POLICY_LIVE } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site-url";

/* Only pages meant to be found: the landing page and the guide. The app sits
   behind a login, and the couples' sites are noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const guide = guideUpdated();
  return [
    { url: absoluteUrl("/"), lastModified: guide, changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/guide"), lastModified: guide, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/guide/faq"), lastModified: FAQ_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    ...ARTICLES.map((a) => ({
      url: absoluteUrl(`/guide/${a.slug}`),
      lastModified: a.updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...(PRIVACY_POLICY_LIVE
      ? [{ url: absoluteUrl("/privatliv"), changeFrequency: "yearly" as const, priority: 0.3 }]
      : []),
  ];
}
