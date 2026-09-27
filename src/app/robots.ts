import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/* The landing page and the guide are for everyone, search engines and AI
   answer engines included. The app, its API and the dev harnesses are not.
   Wedding sites (/w) and shared programmes (/p) stay
   crawlable on purpose: their pages carry noindex, and a crawler that is
   blocked here would never see it and could still list the bare URL. */
const DISALLOW = ["/api/", "/auth/", "/dev/", "/home", "/onboarding", "/settings", "/invite/"];

// Named so the permission is explicit: these fetch pages to cite them in answers.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // A crawler that matches a named group ignores the * group, so the rules are repeated.
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
