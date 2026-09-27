import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasWebsiteAccess } from "@/lib/website/access";
import { dispatchJob } from "@/lib/jobs/dispatch";
import type { EventRow } from "@/lib/db/types";

export const maxDuration = 120;

/**
 * POST /api/website/design/refine — apply a change request ("gør den
 * mørkere", "større forsidebillede") to the active design; saves a new
 * version. Body: { eventId, instruction } or { eventId, syncContent: true },
 * which brings the built texts up to date with Indhold and keeps the design.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; instruction?: string; syncContent?: boolean };
  const eventId = body.eventId ?? "";
  const instruction = (body.instruction ?? "").trim();
  const syncContent = body.syncContent === true;
  if (!eventId || (!instruction && !syncContent)) {
    return Response.json({ error: "eventId and instruction are required" }, { status: 400 });
  }

  const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  const event = eventData as EventRow | null;
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  if (!(await hasWebsiteAccess(supabase, eventId))) {
    return Response.json({ error: "payment_required" }, { status: 402 });
  }

  const { data: active } = await supabase
    .from("website_designs")
    .select("id, html")
    .eq("event_id", eventId)
    .eq("active", true)
    .maybeSingle();
  // New words need a built site to go into; without one this would be a
  // whole new build under another name.
  if (!active || (syncContent && !active.html)) {
    return Response.json({ error: "Ingen aktivt design at justere, generér først." }, { status: 409 });
  }

  // Minutes of work: a background job in production (src/lib/jobs).
  return dispatchJob(request, "website.refine", {
    eventId,
    userId: user.id,
    payload: syncContent ? { syncContent: true } : { instruction: instruction.slice(0, 1000) },
  });
}
