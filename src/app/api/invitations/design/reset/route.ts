import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ART_BUCKET } from "@/lib/invitations/buildCard";

/**
 * POST /api/invitations/design/reset — drop every version of the card, and
 * Ava's paintings with them, so the couple can start again from the vibes.
 * The card's words stay. Body: { eventId }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId ?? "";
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const { data: rows } = await supabase.from("invitation_designs").select("design").eq("event_id", eventId);
  const paths = ((rows ?? []) as { design: { art?: { path?: unknown } } }[])
    .map((r) => r.design?.art?.path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length > 0) await createAdminClient().storage.from(ART_BUCKET).remove(paths);

  const { error } = await supabase.from("invitation_designs").delete().eq("event_id", eventId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
