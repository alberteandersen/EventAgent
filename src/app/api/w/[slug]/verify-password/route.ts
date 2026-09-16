import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteCookieName, siteCookieValue } from "@/lib/site-auth";
import type { WeddingSiteRow } from "@/lib/db/types";

/**
 * POST /api/w/[slug]/verify-password — checks a password-protected site's code
 * server-side and, on success, sets a signed httpOnly cookie granting access.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { password } = (await request.json()) as { password?: string };

  const admin = createAdminClient();
  const { data: siteRow } = await admin
    .from("wedding_sites").select("config, published").ilike("domain", slug).maybeSingle();
  const site = siteRow as Pick<WeddingSiteRow, "config" | "published"> | null;
  if (!site || !site.published) return Response.json({ error: "Site not found" }, { status: 404 });

  const stored = typeof site.config?.sitePassword === "string" ? (site.config.sitePassword as string) : "";
  if (!stored || password !== stored) {
    return Response.json({ error: "wrong_password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const cookie = {
    httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
  // The page, and the guest-hub routes it calls (seat lookup, guestbook),
  // which check the same cookie and live under /api.
  res.cookies.set(siteCookieName(slug), siteCookieValue(slug, stored), { ...cookie, path: `/w/${slug}` });
  res.headers.append(
    "Set-Cookie",
    `${siteCookieName(slug)}=${siteCookieValue(slug, stored)}; Path=/api/w/${slug}; Max-Age=${cookie.maxAge}; HttpOnly; SameSite=Lax${cookie.secure ? "; Secure" : ""}`,
  );
  return res;
}
