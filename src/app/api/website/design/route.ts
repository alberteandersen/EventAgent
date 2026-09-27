import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasWebsiteAccess } from "@/lib/website/generate";
import { dispatchJob } from "@/lib/jobs/dispatch";
import type { EventRow } from "@/lib/db/types";

export const maxDuration = 120; // structured design gen + optional hero artwork

const MAX_GENERATIONS_PER_DAY = 20; // cost guard

/**
 * POST /api/website/design — Ava designs (or redesigns) the couple's wedding
 * website. Body: { eventId, styleDirection?, vibes? }. Paid feature: 402
 * when Stripe is configured and no paid website order exists.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    eventId?: string;
    styleDirection?: string;
    vibes?: string[];
    fresh?: boolean;
  };
  const eventId = body.eventId ?? "";
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  const event = eventData as EventRow | null;
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  if (!(await hasWebsiteAccess(supabase, eventId))) {
    return Response.json({ error: "payment_required" }, { status: 402 });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("website_designs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_GENERATIONS_PER_DAY) {
    return Response.json(
      { error: "design_limit", message: "I har nået dagens grænse for nye designs, prøv igen i morgen." },
      { status: 429 }
    );
  }

  // Minutes of work: a background job in production (src/lib/jobs).
  return dispatchJob(request, "website.build", {
    eventId,
    userId: user.id,
    payload: { styleDirection: (body.styleDirection ?? "").trim() },
  });
}
