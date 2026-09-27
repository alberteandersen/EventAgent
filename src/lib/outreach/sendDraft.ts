/* Sending an approved outreach draft: one email per liked vendor in the
   draft's category not yet contacted, each composed in the vendor's own
   language and sent from the platform Kalas mailbox, then a summary in the
   chat. Composing and sending run one vendor at a time, so a long list runs
   for minutes: in production this is a background job (src/lib/jobs/run.ts).

   The approve route has already checked the draft, the recipients and the
   mailbox, and marked the draft approved; this is the part after that. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformAccessToken, getPlatformEmail, ensureReplyTag, plusAddress } from "@/lib/gmail/platform";
import { sendEmail } from "@/lib/gmail/send";
import { labelOutreachThread } from "@/lib/gmail/labels";
import { composeOutreachEmail, findVenueEmail } from "@/lib/gemini/agent";
import type { EmailDraftRow, EventRow, VenueRow } from "@/lib/db/types";

export interface VenueResult {
  venueId: string;
  venueName: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

/** Liked vendors in the draft's category that no email has reached yet. */
export async function uncontactedVenues(supabase: SupabaseClient, draft: EmailDraftRow): Promise<VenueRow[]> {
  const [{ data: venuesData }, { data: contactedData }] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("event_id", draft.event_id)
      .eq("swipe_status", "liked")
      .eq("category", draft.category),
    supabase
      .from("outbound_emails")
      .select("venue_id")
      .eq("event_id", draft.event_id)
      .in("status", ["sent", "replied"]),
  ]);
  const contacted = new Set(((contactedData ?? []) as { venue_id: string }[]).map((r) => r.venue_id));
  return ((venuesData ?? []) as VenueRow[]).filter((v) => !contacted.has(v.id));
}

export async function sendApprovedDraft(args: {
  supabase: SupabaseClient;
  draftId: string;
  userId: string;
}): Promise<{ results: VenueResult[] }> {
  const { supabase, draftId, userId } = args;

  const { data: draftData } = await supabase.from("email_drafts").select("*").eq("id", draftId).single();
  const draft = draftData as EmailDraftRow | null;
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  const { data: eventData } = await supabase.from("events").select("*").eq("id", draft.event_id).single();
  const event = eventData as EventRow | null;
  if (!event) throw new Error(`Event ${draft.event_id} not found`);

  const venues = await uncontactedVenues(supabase, draft);
  const accessToken = await getPlatformAccessToken();
  const platformEmail = await getPlatformEmail();
  const replyTag = await ensureReplyTag(supabase, event);
  const replyTo = platformEmail ? plusAddress(platformEmail, replyTag) : undefined;

  const results: VenueResult[] = [];
  for (const venue of venues) {
    // Last-chance email lookup for liked vendors still missing one.
    let toEmail = venue.email;
    if (!toEmail) {
      try {
        toEmail = await findVenueEmail(venue.name, venue.website);
        await supabase
          .from("venues")
          .update({
            email: toEmail ?? undefined,
            email_lookup_status: toEmail ? "found" : "not_found",
          })
          .eq("id", venue.id);
      } catch {
        // fall through to skip
      }
    }
    if (!toEmail) {
      results.push({
        venueId: venue.id,
        venueName: venue.name,
        status: "skipped",
        reason: "No contact email found",
      });
      continue;
    }

    // Composed per vendor, in the vendor's own language — subject included,
    // so a German venue doesn't get a Danish subject line.
    const { subject, body } = await composeOutreachEmail({
      template: draft.body_template,
      subject: draft.subject,
      event,
      venue,
    });

    const { data: outboundData } = await supabase
      .from("outbound_emails")
      .insert({
        event_id: draft.event_id,
        venue_id: venue.id,
        draft_id: draft.id,
        user_id: userId,
        to_email: toEmail,
        subject,
        body,
        kind: "outreach",
      })
      .select("id")
      .single();

    try {
      const sent = await sendEmail(accessToken, {
        to: toEmail,
        subject,
        body,
        fromName: "Ava at Kalas",
        fromEmail: platformEmail ?? undefined,
        replyTo,
      });
      await supabase
        .from("outbound_emails")
        .update({
          gmail_message_id: sent.messageId,
          gmail_thread_id: sent.threadId,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", outboundData!.id);
      await labelOutreachThread(accessToken, sent.threadId, replyTag);
      results.push({ venueId: venue.id, venueName: venue.name, status: "sent" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Send failed";
      await supabase
        .from("outbound_emails")
        .update({ status: "failed", error: reason })
        .eq("id", outboundData!.id);
      results.push({ venueId: venue.id, venueName: venue.name, status: "failed", reason });
    }
    // Gentle pacing between sends.
    await new Promise((r) => setTimeout(r, 500));
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  await supabase.from("email_drafts").update({ status: "sent" }).eq("id", draftId);
  await supabase
    .from("events")
    .update({ status: sentCount > 0 ? "awaiting_replies" : "drafting" })
    .eq("id", draft.event_id);

  // Drop a summary into the chat so the transcript reflects what happened.
  await supabase.from("chat_messages").insert({
    event_id: draft.event_id,
    user_id: userId,
    role: "assistant",
    content:
      sentCount > 0
        ? `I've reached out to ${sentCount} ${draft.category}${sentCount === 1 ? "" : "s"} from my Kalas mailbox, replies come straight to me and I'll flag each one for you in the outreach inbox.`
        : "I couldn't send any emails, check the contact details and approve again.",
    payload: {
      kind: "send_report",
      sent: sentCount,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    },
  });

  return { results };
}
