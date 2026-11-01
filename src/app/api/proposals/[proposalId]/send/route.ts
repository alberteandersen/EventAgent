import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GmailNotConnectedError } from "@/lib/gmail/oauth";
import {
  getPlatformAccessToken,
  getPlatformEmail,
  plusAddress,
} from "@/lib/gmail/platform";
import { sendEmail } from "@/lib/gmail/send";
import type {
  EmailReplyRow,
  EventRow,
  OutboundEmailRow,
  ReplyProposalRow,
} from "@/lib/db/types";

/**
 * POST /api/proposals/[proposalId]/send — approve Juno's proposed reply (with
 * optional edits) and send it into the vendor's Gmail thread from the Kalas
 * mailbox. Body: { body?: string }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { body: edited } = (await request.json().catch(() => ({}))) as { body?: string };

  const { data: proposalData } = await supabase
    .from("reply_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  const proposal = proposalData as ReplyProposalRow | null;
  if (!proposal) return Response.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status !== "proposed") {
    return Response.json({ error: `Proposal already ${proposal.status}` }, { status: 409 });
  }
  const body = (edited ?? proposal.body).trim();
  if (!body) return Response.json({ error: "Empty reply" }, { status: 400 });

  const [{ data: replyData }, { data: anchorData }, { data: eventData }] = await Promise.all([
    supabase.from("email_replies").select("*").eq("id", proposal.email_reply_id).single(),
    supabase.from("outbound_emails").select("*").eq("id", proposal.outbound_email_id).single(),
    supabase.from("events").select("*").eq("id", proposal.event_id).single(),
  ]);
  const reply = replyData as EmailReplyRow | null;
  const anchor = anchorData as OutboundEmailRow | null;
  const event = eventData as EventRow | null;
  if (!reply || !anchor || !event) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  let accessToken: string;
  let platformEmail: string | null;
  try {
    accessToken = await getPlatformAccessToken();
    platformEmail = await getPlatformEmail();
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return Response.json(
        { error: "outreach_unavailable", message: "Juno's mailbox is unavailable, try again shortly." },
        { status: 503 }
      );
    }
    throw err;
  }

  const replyTo =
    platformEmail && event.reply_tag ? plusAddress(platformEmail, event.reply_tag) : undefined;
  const subject = anchor.subject.startsWith("Re:") ? anchor.subject : `Re: ${anchor.subject}`;

  let sent;
  try {
    sent = await sendEmail(accessToken, {
      to: anchor.to_email,
      subject,
      body,
      fromName: "Juno at Kalas",
      fromEmail: platformEmail ?? undefined,
      replyTo,
      threadId: anchor.gmail_thread_id ?? undefined,
      inReplyTo: reply.rfc822_message_id ?? undefined,
      references: reply.rfc822_message_id ?? undefined,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 }
    );
  }

  const { data: outbound } = await supabase
    .from("outbound_emails")
    .insert({
      event_id: proposal.event_id,
      venue_id: proposal.venue_id,
      draft_id: null,
      user_id: proposal.user_id,
      to_email: anchor.to_email,
      subject,
      body,
      gmail_message_id: sent.messageId,
      gmail_thread_id: sent.threadId,
      status: "sent",
      sent_at: new Date().toISOString(),
      kind: "reply",
      in_reply_to_reply_id: reply.id,
    })
    .select("id")
    .single();

  await supabase
    .from("reply_proposals")
    .update({ status: "sent", sent_outbound_id: outbound?.id ?? null, body })
    .eq("id", proposalId);
  if (!reply.read_at) {
    await supabase
      .from("email_replies")
      .update({ read_at: new Date().toISOString() })
      .eq("id", reply.id);
  }

  return Response.json({ ok: true, outboundId: outbound?.id });
}
