/* The paywall for the AI designers. One purchase (website_orders) unlocks
   both the website and the invitation card; see lib/invitations/access.ts. */

import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the event may use the AI designer: a paid order exists, or
    Stripe isn't configured (dev/preview environments run unlocked). */
export async function hasWebsiteAccess(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY) return true;
  const { count } = await supabase
    .from("website_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "paid");
  return (count ?? 0) > 0;
}
