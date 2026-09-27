import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { invitationBuildBlocked } from "@/lib/invitations/access";
import type { EventRow } from "@/lib/db/types";

export const maxDuration = 120;

/**
 * POST /api/invitations/design/refine — a change request ("flere blomster",
 * "mindre navne") against the active card; saves a new version, repainted
 * only when the change is to the painting.
 * Body: { eventId, instruction }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; instruction?: string };
  const eventId = body.eventId ?? "";
  const instruction = (body.instruction ?? "").trim();
  if (!eventId || !instruction) {
    return Response.json({ error: "eventId and instruction are required" }, { status: 400 });
  }

  const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  const event = eventData as EventRow | null;
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const blocked = await invitationBuildBlocked(supabase, eventId);
  if (blocked) return blocked;

  const { count } = await supabase
    .from("invitation_designs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("active", true);
  if ((count ?? 0) === 0) {
    return Response.json({ error: "Vælg en stemning først." }, { status: 409 });
  }

  // Can outrun a request: a background job in production (src/lib/jobs).
  return dispatchJob(request, "invitation.refine", {
    eventId,
    userId: user.id,
    payload: { instruction: instruction.slice(0, 1000) },
  });
}
