import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveEvent } from "@/lib/active-event";

/**
 * POST /api/day-program/share — the read-only link to the wedding day's
 * programme. Returns the existing token, or mints one; `{ rotate: true }`
 * replaces it, which is how a link that went too far is switched off.
 * DELETE stops sharing altogether.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const event = await getActiveEvent(supabase, user.id);
  if (!event) return Response.json({ error: "No wedding" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { rotate?: boolean };
  const current = event.program_share_token ?? null;
  if (current && !body.rotate) return Response.json({ token: current });

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("events").update({ program_share_token: token }).eq("id", event.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ token });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const event = await getActiveEvent(supabase, user.id);
  if (!event) return Response.json({ error: "No wedding" }, { status: 404 });

  const { error } = await supabase.from("events").update({ program_share_token: null }).eq("id", event.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ token: null });
}
