import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invitationBuildBlocked } from "@/lib/invitations/access";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { findFormat } from "@/kalas/invitations/card/formats";
import type { EventRow } from "@/lib/db/types";

export const maxDuration = 120;

/**
 * POST /api/invitations/design — Juno makes the card from the chosen vibe and
 * their words: designs the type and paints the artwork. Body: { eventId,
 * styleDirection?, format? }; a format other than the card's repaints it.
 * Unlocked by the same purchase as the website designer (402 without it).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; styleDirection?: string; format?: string };
  const eventId = body.eventId ?? "";
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  const event = eventData as EventRow | null;
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const blocked = await invitationBuildBlocked(supabase, eventId);
  if (blocked) return blocked;

  // Can outrun a request: a background job in production (src/lib/jobs).
  return dispatchJob(request, "invitation.build", {
    eventId,
    userId: user.id,
    payload: { styleDirection: (body.styleDirection ?? "").trim().slice(0, 1000), format: findFormat(body.format).id },
  });
}
