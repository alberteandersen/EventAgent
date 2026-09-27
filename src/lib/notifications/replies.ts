// Email the couple when vendors write back. Runs at the end of every mailbox
// poll (src/lib/gmail/poll.ts), from the same Kalas mailbox Ava writes to
// vendors from, so it needs no mail provider or secrets of its own.
//
// One digest per wedding member per poll. A reply is claimed by setting
// email_replies.notified_at before anything is sent, so two overlapping
// polls (the scheduled worker and the manual cron route) can never both mail
// it. If every send for a wedding fails, its claims are released and the
// next poll tries again.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/gmail/send";
import { absoluteUrl } from "@/lib/site-url";
import type { AppLanguage, QuoteExtraction } from "@/lib/db/types";
import { buildReplyDigest, type DigestReply } from "./replyDigest";

/** Replies older than this are never notified: better silence than a mail
 *  about something the couple saw in the app days ago. */
const CLAIM_WINDOW_MS = 48 * 60 * 60 * 1000;

interface ClaimedReply {
  id: string;
  event_id: string;
  venue_id: string;
  snippet: string | null;
  quote: QuoteExtraction | null;
  created_at: string;
}

interface Recipient {
  userId: string;
  email: string;
  name: string;
  lang: AppLanguage;
}

export interface NotifySummary {
  notificationsSent: number;
  notificationsFailed: number;
}

export async function notifyNewReplies(
  admin: SupabaseClient,
  mailbox: { accessToken: string; fromEmail: string | null }
): Promise<NotifySummary> {
  const summary: NotifySummary = { notificationsSent: 0, notificationsFailed: 0 };

  const { data: claimedData, error: claimError } = await admin
    .from("email_replies")
    .update({ notified_at: new Date().toISOString() })
    .is("notified_at", null)
    .gte("created_at", new Date(Date.now() - CLAIM_WINDOW_MS).toISOString())
    .select("id,event_id,venue_id,snippet,quote,created_at");
  if (claimError) {
    // Most likely 0041 is not applied here yet; the poll itself is unaffected.
    console.error("[notify] could not claim replies:", claimError.message);
    return summary;
  }
  const claimed = ((claimedData ?? []) as ClaimedReply[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  if (claimed.length === 0) return summary;

  const byEvent = new Map<string, ClaimedReply[]>();
  for (const reply of claimed) {
    const list = byEvent.get(reply.event_id);
    if (list) list.push(reply);
    else byEvent.set(reply.event_id, [reply]);
  }
  const eventIds = [...byEvent.keys()];
  const replyIds = claimed.map((r) => r.id);

  const [venues, proposals, members, owners] = await Promise.all([
    admin.from("venues").select("id,name").in("id", [...new Set(claimed.map((r) => r.venue_id))]),
    admin
      .from("reply_proposals")
      .select("email_reply_id")
      .in("email_reply_id", replyIds)
      .eq("status", "proposed"),
    admin.from("event_members").select("event_id,user_id").in("event_id", eventIds),
    admin.from("events").select("id,user_id").in("id", eventIds),
  ]);
  const venueName = new Map(
    ((venues.data ?? []) as { id: string; name: string }[]).map((v) => [v.id, v.name])
  );
  const proposed = new Set(
    ((proposals.data ?? []) as { email_reply_id: string }[]).map((p) => p.email_reply_id)
  );

  // Owner from events.user_id as well as event_members, so a database
  // without 0036 still reaches the person who made the wedding.
  const membersByEvent = new Map<string, Set<string>>();
  const addMember = (eventId: string, userId: string) => {
    const set = membersByEvent.get(eventId) ?? new Set<string>();
    set.add(userId);
    membersByEvent.set(eventId, set);
  };
  for (const m of (members.data ?? []) as { event_id: string; user_id: string }[]) {
    addMember(m.event_id, m.user_id);
  }
  for (const e of (owners.data ?? []) as { id: string; user_id: string }[]) {
    addMember(e.id, e.user_id);
  }

  const recipients = await loadRecipients(
    admin,
    [...new Set([...membersByEvent.values()].flatMap((s) => [...s]))],
    mailbox.fromEmail
  );

  const inboxUrl = absoluteUrl("/home?screen=inbox");
  const settingsUrl = absoluteUrl("/settings");

  for (const [eventId, replies] of byEvent) {
    const digest: DigestReply[] = replies.map((r) => ({
      vendor: venueName.get(r.venue_id) ?? "",
      summary: r.quote?.summary ?? null,
      snippet: r.snippet,
      hasProposal: proposed.has(r.id),
    }));

    let sent = 0;
    let failed = 0;
    for (const userId of membersByEvent.get(eventId) ?? []) {
      const to = recipients.get(userId);
      if (!to) continue;
      const message = buildReplyDigest({
        name: to.name,
        replies: digest.map((d) => ({
          ...d,
          vendor: d.vendor || (to.lang === "en" ? "A vendor" : "En leverandør"),
        })),
        inboxUrl,
        settingsUrl,
        lang: to.lang,
      });
      try {
        await sendEmail(mailbox.accessToken, {
          to: to.email,
          subject: message.subject,
          body: message.body,
          fromName: "Ava at Kalas",
          fromEmail: mailbox.fromEmail ?? undefined,
          // Ava's signature is for vendors; the couple already knows her.
          omitSignature: true,
        });
        sent++;
      } catch (err) {
        failed++;
        console.error(`[notify] mail to ${userId} for event ${eventId} failed:`, err);
      }
    }
    summary.notificationsSent += sent;
    summary.notificationsFailed += failed;

    // Nobody heard about these; hand them back to the next poll.
    if (failed > 0 && sent === 0) {
      await admin
        .from("email_replies")
        .update({ notified_at: null })
        .in("id", replies.map((r) => r.id));
    }
  }

  return summary;
}

/**
 * Who can be mailed: members with an address who have not turned the mails
 * off. Never the Kalas mailbox itself (the platform admin may also be a
 * test couple).
 */
async function loadRecipients(
  admin: SupabaseClient,
  userIds: string[],
  platformEmail: string | null
): Promise<Map<string, Recipient>> {
  const out = new Map<string, Recipient>();
  if (userIds.length === 0) return out;

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,display_name,language,email_notifications")
    .in("user_id", userIds);
  const profileById = new Map(
    ((profiles ?? []) as {
      user_id: string;
      display_name: string | null;
      language: AppLanguage | null;
      email_notifications: boolean | null;
    }[]).map((p) => [p.user_id, p])
  );

  for (const userId of userIds) {
    const profile = profileById.get(userId);
    if (profile?.email_notifications === false) continue;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email?.trim();
    if (error || !email) continue;
    if (platformEmail && email.toLowerCase() === platformEmail.toLowerCase()) continue;
    out.set(userId, {
      userId,
      email,
      name: (profile?.display_name ?? "").trim().split(/\s+/)[0] ?? "",
      lang: profile?.language === "en" ? "en" : "da",
    });
  }
  return out;
}
