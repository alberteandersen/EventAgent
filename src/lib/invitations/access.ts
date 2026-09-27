/* Who may have Ava build an invitation, and how often. The website's
   purchase unlocks both designers; the cap is the website's cost guard. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hasWebsiteAccess } from "@/lib/website/generate";

/** Builds and change requests per wedding per day. */
const MAX_INVITATION_BUILDS_PER_DAY = 20;

/** A response to send instead of building, or null when the build may run. */
export async function invitationBuildBlocked(supabase: SupabaseClient, eventId: string): Promise<Response | null> {
  if (!(await hasWebsiteAccess(supabase, eventId))) {
    return Response.json({ error: "payment_required" }, { status: 402 });
  }
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("invitation_designs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .not("html", "is", null)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_INVITATION_BUILDS_PER_DAY) {
    return Response.json(
      { error: "design_limit", message: "I har nået dagens grænse for nye invitationer, prøv igen i morgen." },
      { status: 429 },
    );
  }
  return null;
}
