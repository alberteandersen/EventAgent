import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureReplyTag, plusAddress } from "@/lib/gmail/platform";
import { sendEmail } from "@/lib/gmail/send";
import { labelOutreachThread } from "@/lib/gmail/labels";
import { loadVendorOutreach } from "@/lib/outreach/vendor";
import type { EventStatus } from "@/lib/db/types";

export const maxDuration = 60;

// Statuses a first send should move forward; a finished wedding stays put.
const ADVANCEABLE: EventStatus[] = [
  "gathering",
  "searching",
  "swiping",
  "drafting",
  "sending",
];

/**
 * POST /api/venues/[venueId]/outreach/send — send the approved outreach
 * email to ONE vendor from the platform mailbox. Body: { subject, body },
 * as edited by the couple in the preview.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, body } = (await request.json()) as {
    subject?: string;
    body?: string;
  };
  if (!subject?.trim() || !body?.trim()) {
    return Response.json({ error: "subject and body are required" }, { status: 400 });
  }

  const { venueId } = await params;
  const { ctx, block } = await loadVendorOutreach(supabase, venueId);
  if (block) return Response.json(block.payload, { status: block.status });

  const toEmail = ctx.venue.email;
  if (!toEmail) {
    return Response.json(
      { error: "no_contact_email", message: `Ingen mailadresse på ${ctx.venue.name}.` },
      { status: 422 }
    );
  }

  const replyTag = await ensureReplyTag(supabase, ctx.event);
  const replyTo = ctx.platformEmail
    ? plusAddress(ctx.platformEmail, replyTag)
    : undefined;

  // Record the attempt before sending, so a send that succeeds but fails to
  // record still leaves a row we can reconcile against the mailbox.
  const { data: outbound, error: insertError } = await supabase
    .from("outbound_emails")
    .insert({
      event_id: ctx.event.id,
      venue_id: ctx.venue.id,
      draft_id: null,
      user_id: user.id,
      to_email: toEmail,
      subject: subject.trim(),
      body: body.trim(),
      kind: "outreach",
    })
    .select("id")
    .single();
  if (insertError || !outbound) {
    return Response.json(
      { error: insertError?.message ?? "Could not record the email" },
      { status: 500 }
    );
  }

  try {
    const sent = await sendEmail(ctx.accessToken, {
      to: toEmail,
      subject: subject.trim(),
      body: body.trim(),
      fromName: "Juno at Kalas",
      fromEmail: ctx.platformEmail ?? undefined,
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
      .eq("id", outbound.id);
    await labelOutreachThread(ctx.accessToken, sent.threadId, replyTag);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Send failed";
    await supabase
      .from("outbound_emails")
      .update({ status: "failed", error: reason })
      .eq("id", outbound.id);
    return Response.json({ error: reason }, { status: 502 });
  }

  if (ADVANCEABLE.includes(ctx.event.status)) {
    await supabase
      .from("events")
      .update({ status: "awaiting_replies" })
      .eq("id", ctx.event.id);
  }

  // Keep Juno's transcript a complete record of what went out in the couple's name.
  await supabase.from("chat_messages").insert({
    event_id: ctx.event.id,
    user_id: user.id,
    role: "assistant",
    content: `I've written to ${ctx.venue.name} from my Kalas mailbox, their reply comes straight to me and I'll flag it for you in the outreach inbox.`,
    payload: { kind: "send_report", sent: 1, failed: 0, skipped: 0 },
  });

  return Response.json({ outboundId: outbound.id, toEmail });
}
