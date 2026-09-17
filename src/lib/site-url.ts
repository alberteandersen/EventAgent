/* The public origin for canonical URLs, the sitemap and structured data.
   Search engines need one absolute, stable origin. NEXT_PUBLIC_SITE_URL
   overrides it (say, when kalas.dk becomes the main domain); otherwise a
   production build uses the live domain, and development its own server. */
const PRODUCTION_ORIGIN = "https://kalas-weddings.com";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
).replace(/\/+$/, "");

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
