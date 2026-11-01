import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseInviteContent } from "@/kalas/invitations/content";
import type { EventRow, InvitationRow, ProfileRow } from "@/lib/db/types";

/**
 * POST /api/invitations — save what the couple's card says (InviteContent,
 * plus their own wording over Juno's). The look is its own record,
 * invitation_designs. Body: { id?, data, publish? }. `publish` marks the card
 * as out of their hands: exported for print, which is what the journey's
 * "Send the invites" step and the planning signals read as done.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { id?: string; data?: Record<string, unknown>; publish?: boolean };
  const data = parseInviteContent(body.data) as unknown as Record<string, unknown>;
  const now = new Date().toISOString();

  if (body.id) {
    // RLS scopes the update to the wedding's members.
    const { data: row, error } = await supabase
      .from("invitations")
      .update({ data, updated_at: now, ...(body.publish ? { status: "published" } : {}) })
      .eq("id", body.id)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(row as InvitationRow);
  }

  // Resolve the couple's active event (profile pointer, else most recent).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_event_id")
    .eq("user_id", user.id)
    .maybeSingle();
  let eventId = (profileRow as Pick<ProfileRow, "active_event_id"> | null)?.active_event_id ?? null;
  if (!eventId) {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    eventId = (ev as Pick<EventRow, "id"> | null)?.id ?? null;
  }
  if (!eventId) return Response.json({ error: "No wedding found" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("invitations")
    // template_id is kept for the column; the design lives in invitation_designs.
    .insert({ event_id: eventId, user_id: user.id, template_id: "card", data, status: body.publish ? "published" : "draft", updated_at: now })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(row as InvitationRow);
}
