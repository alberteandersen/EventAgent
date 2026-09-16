import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig } from "@/kalas/site/config";
import { readGuestbookEntry } from "@/lib/website/hub";
import { siteCookieName, siteUnlocked } from "@/lib/site-auth";
import type { GuestbookEntryRow, WeddingSiteRow } from "@/lib/db/types";

/* The public guestbook. Guests have no account, so both directions go through
   the service role here, gated the same way as the rest of the guest hub: the
   section must be on, and the site's password passed when it has one. */

async function openSite(request: NextRequest, slug: string) {
  const admin = createAdminClient();
  const { data: siteRow } = await admin.from("wedding_sites").select("*").ilike("domain", slug).maybeSingle();
  const site = siteRow as WeddingSiteRow | null;
  if (!site || !site.published) return { error: Response.json({ error: "Site not found" }, { status: 404 }) };
  if (!parseConfig(site.config).sections.some((s) => s.id === "guestbook" && s.enabled)) {
    return { error: Response.json({ error: "Not available" }, { status: 404 }) };
  }
  if (!siteUnlocked(slug, site.config, request.cookies.get(siteCookieName(slug))?.value)) {
    return { error: Response.json({ error: "locked" }, { status: 401 }) };
  }
  return { admin, site };
}

/** GET — the messages the couple has not hidden, newest first. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const open = await openSite(request, slug);
  if ("error" in open) return open.error;
  const { data } = await open.admin
    .from("guestbook_entries")
    .select("id, name, message, created_at")
    .eq("event_id", open.site.event_id)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(200);
  return Response.json({ entries: (data as Pick<GuestbookEntryRow, "id" | "name" | "message" | "created_at">[] | null) ?? [] });
}

/** POST { name, message } — a guest leaves a message. A honeypot field rejects bots. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.company) return Response.json({ ok: true }); // honeypot, pretend success

  const entry = readGuestbookEntry(body);
  if ("error" in entry) return Response.json({ error: entry.error }, { status: 400 });

  const open = await openSite(request, slug);
  if ("error" in open) return open.error;
  const { data, error } = await open.admin
    .from("guestbook_entries")
    .insert({ event_id: open.site.event_id, user_id: open.site.user_id, ...entry })
    .select("id, name, message, created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ entry: data });
}
