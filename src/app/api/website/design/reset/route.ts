import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SitePhotoRow } from "@/lib/db/types";

/**
 * POST /api/website/design/reset — wipe all designs (and Juno-generated
 * section/artwork photos) for an event so the couple can start over from
 * template pick. Couple-uploaded photos are kept.
 * Body: { eventId }.
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

  // Juno-made images only — uploads stay for the next build.
  const { data: generated } = await supabase
    .from("site_photos")
    .select("*")
    .eq("event_id", eventId)
    .or("kind.eq.generated,role.eq.section");
  const genPhotos = (generated ?? []) as SitePhotoRow[];

  if (genPhotos.length > 0) {
    const admin = createAdminClient();
    await admin.storage.from("site-photos").remove(genPhotos.map((p) => p.storage_path));
    const ids = genPhotos.map((p) => p.id);
    const { error: photoErr } = await supabase.from("site_photos").delete().in("id", ids);
    if (photoErr) return Response.json({ error: photoErr.message }, { status: 500 });
  }

  const { error } = await supabase.from("website_designs").delete().eq("event_id", eventId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
