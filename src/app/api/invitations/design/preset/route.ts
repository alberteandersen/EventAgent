import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CARD_VIBES, starterSpec } from "@/kalas/invitations/card/vibes";
import { findFormat } from "@/kalas/invitations/card/formats";
import { parseInviteContent } from "@/kalas/invitations/content";
import type { InvitationRow } from "@/lib/db/types";

/**
 * POST /api/invitations/design/preset — make a vibe, at a paper size, the
 * card's active design: its sample painting and its own typesetting. Free
 * and instant, no AI; Ava's build then starts from it.
 * Body: { eventId, vibe, format? }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; vibe?: string; format?: string };
  const eventId = body.eventId ?? "";
  const vibe = CARD_VIBES.find((v) => v.id === body.vibe);
  if (!eventId || !vibe) {
    return Response.json({ error: "eventId and a valid vibe are required" }, { status: 400 });
  }

  const { data: ev } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });

  // The vibe's wording in the card's language.
  const { data: inv } = await supabase.from("invitations").select("data").eq("event_id", eventId).limit(1).maybeSingle();
  const language = parseInviteContent((inv as Pick<InvitationRow, "data"> | null)?.data).language;
  const spec = starterSpec(vibe, findFormat(body.format), language);

  await supabase.from("invitation_designs").update({ active: false }).eq("event_id", eventId).eq("active", true);
  const { data: row, error } = await supabase
    .from("invitation_designs")
    .insert({
      event_id: eventId,
      user_id: user.id,
      brief: { vibe: vibe.id, format: spec.format, mode: "card" },
      design: spec as unknown as Record<string, unknown>,
      active: true,
    })
    .select()
    .single();
  if (error || !row) return Response.json({ error: error?.message ?? "Failed to apply vibe" }, { status: 500 });
  return Response.json({ designId: row.id });
}
