import { createHmac } from "crypto";

/** Cookie name for a verified password-protected public site. */
export const siteCookieName = (slug: string) => `kalas_site_${slug}`;

/**
 * Deterministic, unforgeable cookie value for a (slug, password) pair, keyed by
 * a server-only secret. The public page recomputes this from the stored
 * password and compares; a guest can't fabricate it without the secret.
 */
export function siteCookieValue(slug: string, password: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "kalas-dev-secret";
  return createHmac("sha256", secret).update(`${slug}:${password}`).digest("hex");
}

/**
 * Whether a request may read a site's guest-only data. Open sites always may;
 * a password-protected one needs the signed cookie. The cookie is scoped to
 * the page and to its API routes (see verify-password), so both can check it.
 */
export function siteUnlocked(
  slug: string,
  config: Record<string, unknown> | null | undefined,
  cookieValue: string | undefined,
): boolean {
  const password = typeof config?.sitePassword === "string" ? config.sitePassword : "";
  if (config?.pwProtected !== true || !password) return true;
  return cookieValue === siteCookieValue(slug, password);
}
