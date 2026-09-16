import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig } from "@/kalas/site/config";
import { readPlan } from "@/kalas/screens/seating/model";
import { findSeat } from "@/lib/website/hub";
import { siteCookieName, siteUnlocked } from "@/lib/site-auth";
import type { GuestRow, WeddingSiteRow } from "@/lib/db/types";

/**
 * GET /api/w/[slug]/seat?name=…&token=… — "Find min plads". A guest's table
 * name and nothing else, only when the couple has switched the section on,
 * and only past the site's password when it has one.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = request.nextUrl.searchParams.get("name");
  const token = request.nextUrl.searchParams.get("token");

  const admin = createAdminClient();
  const { data: siteRow } = await admin.from("wedding_sites").select("*").ilike("domain", slug).maybeSingle();
  const site = siteRow as WeddingSiteRow | null;
  if (!site || !site.published) return Response.json({ error: "Site not found" }, { status: 404 });

  const config = parseConfig(site.config);
  if (!config.sections.some((s) => s.id === "seat" && s.enabled)) {
    return Response.json({ error: "Not available" }, { status: 404 });
  }
  if (!siteUnlocked(slug, site.config, request.cookies.get(siteCookieName(slug))?.value)) {
    return Response.json({ error: "locked" }, { status: 401 });
  }

  const [{ data: guestRows }, { data: planRow }] = await Promise.all([
    admin.from("guests").select("id, name, email, rsvp_token").eq("event_id", site.event_id),
    admin.from("seating_plans").select("data").eq("event_id", site.event_id).maybeSingle(),
  ]);
  const guests = (guestRows as Pick<GuestRow, "id" | "name" | "email" | "rsvp_token">[] | null) ?? [];
  return Response.json(findSeat(guests, readPlan(planRow?.data), { name, token }));
}
