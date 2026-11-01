import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findPreset } from "@/kalas/site/presets";

/**
 * POST /api/website/design/preset — apply a hand-crafted template as the
 * active design. Instant and free (no AI call); Juno's refinements then
 * build on it. Body: { eventId, presetId }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; presetId?: string };
  const eventId = body.eventId ?? "";
  const preset = findPreset(body.presetId ?? "");
  if (!eventId || !preset) {
    return Response.json({ error: "eventId and a valid presetId are required" }, { status: 400 });
  }

  // RLS-scoped ownership check.
  const { data: ev } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });

  await supabase.from("website_designs").update({ active: false }).eq("event_id", eventId).eq("active", true);
  const { data: row, error } = await supabase
    .from("website_designs")
    .insert({
      event_id: eventId,
      user_id: user.id,
      brief: { preset: preset.id },
      design: preset.design as unknown as Record<string, unknown>,
      active: true,
    })
    .select()
    .single();
  if (error || !row) return Response.json({ error: error?.message ?? "Failed to apply template" }, { status: 500 });
  return Response.json({ designId: row.id });
}
