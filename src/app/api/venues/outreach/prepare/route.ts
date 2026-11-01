import { createClient } from "@/lib/supabase/server";
import { generateBrief } from "@/lib/outreach/brief";
import type { EventRow, ProfileRow, VenueRow, EmailDraftRow } from "@/lib/db/types";

/**
 * POST /api/venues/outreach/prepare
 *
 * Prepares (without the chat agent) a single master outreach draft for the
 * couple's listed venues, so the Venues "review & approve" page can show what
 * Juno will send and to whom. Idempotent: if a proposed venue draft already
 * exists it is returned as-is. Approving is the existing
 * POST /api/drafts/[draftId]/approve flow.
 */

async function resolveEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<EventRow | null> {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_event_id")
    .eq("user_id", userId)
    .maybeSingle();
  const activeId = (profileRow as Pick<ProfileRow, "active_event_id"> | null)?.active_event_id;
  if (activeId) {
    const { data } = await supabase.from("events").select("*").eq("id", activeId).maybeSingle();
    if (data) return data as EventRow;
  }
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EventRow | null) ?? null;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const event = await resolveEvent(supabase, user.id);
  if (!event) return Response.json({ error: "No wedding found" }, { status: 404 });

  // Idempotent — reuse an existing unsent venue draft.
  const { data: existing } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("event_id", event.id)
    .eq("category", "venue")
    .eq("status", "proposed")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return Response.json({ draft: existing as EmailDraftRow, reused: true });

  // Who would be contacted: liked venues not yet reached out to.
  const { data: venueRows } = await supabase
    .from("venues")
    .select("id, name, swipe_status, category")
    .eq("event_id", event.id)
    .eq("category", "venue")
    .eq("swipe_status", "liked");
  const liked = (venueRows as Pick<VenueRow, "id" | "name">[] | null) ?? [];
  if (liked.length === 0) {
    return Response.json({ error: "no_venues", message: "Ingen venues på listen at kontakte endnu." }, { status: 400 });
  }

  // The brief the couple reviews. Each recipient's actual email is written
  // from this per vendor, in the vendor's own language, at send time.
  const { subject, body_template: body } = await generateBrief(event, "venue");

  const { data: latest } = await supabase
    .from("email_drafts")
    .select("version")
    .eq("event_id", event.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest as { version?: number } | null)?.version ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("email_drafts")
    .insert({
      event_id: event.id,
      user_id: event.user_id,
      subject,
      body_template: body,
      version,
      category: "venue",
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase.from("events").update({ status: "drafting" }).eq("id", event.id);
  return Response.json({ draft: inserted as EmailDraftRow, reused: false, recipients: liked.length });
}
