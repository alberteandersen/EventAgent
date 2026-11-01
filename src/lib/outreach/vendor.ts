// Shared guards for contacting a single vendor. Both the prepare (compose a
// preview) and send routes need the same four checks in the same order, and
// both should fail before doing expensive work — so the mailbox is verified
// up front rather than after a Gemini call.

import type { SupabaseClient } from "@supabase/supabase-js";
import { GmailNotConnectedError } from "@/lib/gmail/oauth";
import { getPlatformAccessToken, getPlatformEmail } from "@/lib/gmail/platform";
import type { EventRow, VenueRow } from "@/lib/db/types";

export interface VendorOutreachContext {
  venue: VenueRow;
  event: EventRow;
  accessToken: string;
  platformEmail: string | null;
}

/** A ready-to-return refusal: the vendor can't be contacted right now. */
export interface OutreachBlock {
  status: number;
  payload: Record<string, unknown>;
}

export type VendorOutreachResult =
  | { ctx: VendorOutreachContext; block?: undefined }
  | { block: OutreachBlock; ctx?: undefined };

/**
 * Load a vendor and its event (RLS scopes both to the caller), refuse if the
 * vendor has already been reached, and hold a live platform-mailbox token.
 * A failed or still-queued send does NOT count as contacted, so retries work.
 */
export async function loadVendorOutreach(
  supabase: SupabaseClient,
  venueId: string
): Promise<VendorOutreachResult> {
  const { data: venueData } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .maybeSingle();
  const venue = venueData as VenueRow | null;
  if (!venue) {
    return { block: { status: 404, payload: { error: "Vendor not found" } } };
  }

  const { data: eventData } = await supabase
    .from("events")
    .select("*")
    .eq("id", venue.event_id)
    .maybeSingle();
  const event = eventData as EventRow | null;
  if (!event) {
    return { block: { status: 404, payload: { error: "Event not found" } } };
  }

  const { data: alreadySent } = await supabase
    .from("outbound_emails")
    .select("id")
    .eq("venue_id", venue.id)
    .eq("kind", "outreach")
    .in("status", ["sent", "replied"])
    .limit(1)
    .maybeSingle();
  if (alreadySent) {
    return {
      block: {
        status: 409,
        payload: {
          error: "already_contacted",
          message: `Juno har allerede skrevet til ${venue.name}.`,
        },
      },
    };
  }

  try {
    const accessToken = await getPlatformAccessToken();
    const platformEmail = await getPlatformEmail();
    return { ctx: { venue, event, accessToken, platformEmail } };
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return {
        block: {
          status: 503,
          payload: {
            error: "outreach_unavailable",
            message: "Junos postkasse er ved at blive sat op, prøv igen om lidt.",
          },
        },
      };
    }
    throw err;
  }
}

/**
 * The vendor's contact address, looking one up on the fly when it's missing
 * and caching whatever we learn back onto the row (same behaviour as the
 * bulk send). Returns null when no address could be found.
 */
export async function ensureVendorEmail(
  supabase: SupabaseClient,
  venue: VenueRow,
  lookup: (name: string, website: string | null) => Promise<string | null>
): Promise<string | null> {
  if (venue.email) return venue.email;
  let found: string | null = null;
  try {
    found = await lookup(venue.name, venue.website);
  } catch {
    return null;
  }
  await supabase
    .from("venues")
    .update({
      email: found ?? undefined,
      email_lookup_status: found ? "found" : "not_found",
    })
    .eq("id", venue.id);
  return found;
}
