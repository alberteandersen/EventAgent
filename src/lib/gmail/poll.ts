// Poll the platform Kalas mailbox for vendor replies across ALL users,
// extract quotes, pull attachments into Storage, and queue an Ava reply
// proposal for each new reply.
//
// Matching priority per inbox message:
//   1. thread — the Gmail thread id belongs to one of our outreach sends
//   2. tag    — a recipient header carries an event's plus-address reply tag
//               (mailbox+<tag>@domain) and the sender resolves to one of
//               that event's venues
//   3. sender — no tag, but the sender maps to exactly one contacted
//               (event, venue) pair across all users
// Mail with a Kalas signal that still can't be attributed is labeled
// kalas/unmatched in the mailbox for manual triage; mail with no signal at
// all (newsletters, notices) is left untouched.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { GmailNotConnectedError } from "./oauth";
import { getPlatformAccessToken, getPlatformEmail } from "./platform";
import { saveReplyAttachments } from "./attachments";
import { applyLabels, ensureLabel } from "./labels";
import { bareEmail, extractReplyTags, resolveVenueByEmail } from "./match";
import { notifyNewReplies } from "@/lib/notifications/replies";
import {
  extractQuote,
  quoteStatusFromExtraction,
  generateReplyProposal,
} from "@/lib/gemini/agent";
import type { EmailReplyRow, OutboundEmailRow, QuoteExtraction } from "@/lib/db/types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const UNMATCHED_LABEL = "kalas/unmatched";

interface GmailMessageMeta {
  id: string;
  threadId: string;
}

interface GmailMessageFull {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

function header(msg: GmailMessageFull, name: string): string | null {
  return (
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  );
}

/** Walk the MIME tree for the first text/plain part (fall back to text/html). */
function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";
  const findByMime = (p: GmailPart, mime: string): string | null => {
    if (p.mimeType === mime && p.body?.data) {
      return Buffer.from(p.body.data, "base64url").toString("utf8");
    }
    for (const child of p.parts ?? []) {
      const found = findByMime(child, mime);
      if (found) return found;
    }
    return null;
  };
  const plain = findByMime(part, "text/plain");
  if (plain) return plain;
  const html = findByMime(part, "text/html");
  if (html) return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Every inbox message in the poll window, across all result pages. */
async function listInboxMessages(accessToken: string): Promise<GmailMessageMeta[]> {
  const metas: GmailMessageMeta[] = [];
  let pageToken: string | undefined;
  do {
    const page = await gmailGet<{
      messages?: GmailMessageMeta[];
      nextPageToken?: string;
    }>(
      accessToken,
      `/messages?q=${encodeURIComponent("in:inbox newer_than:7d")}&maxResults=100` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "")
    );
    metas.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return metas;
}

export interface PollSummary {
  checked: number;
  newReplies: number;
  attachmentsSaved: number;
  proposalsCreated: number;
  tagMatched: number;
  senderMatched: number;
  unmatchedLabeled: number;
  notificationsSent: number;
  notificationsFailed: number;
  error?: string;
}

interface IngestContext {
  eventId: string;
  userId: string;
  venueId: string;
  /** Outbound row the reply hangs off; null for tag-matched mail from a
   *  vendor we never emailed (status flip + proposal are skipped then). */
  anchor: OutboundEmailRow | null;
  matchedVia: EmailReplyRow["matched_via"];
}

/** Persist one inbound message: reply row, quote, attachments, proposal. */
async function ingestReply(
  admin: SupabaseClient,
  accessToken: string,
  full: GmailMessageFull,
  ctx: IngestContext,
  summary: PollSummary
): Promise<void> {
  const body = extractBody(full.payload);
  const fromEmail = bareEmail(header(full, "From"));
  const rfc822MessageId = header(full, "Message-ID");

  // Quote extraction is best-effort; store the reply even if it fails.
  let quote: QuoteExtraction | null = null;
  let quoteStatus: string | null = null;
  try {
    const { data: venue } = await admin
      .from("venues")
      .select("name")
      .eq("id", ctx.venueId)
      .single();
    const extraction = await extractQuote({
      venueName: venue?.name ?? "the venue",
      replyBody: body || full.snippet || "",
    });
    quote = extraction;
    quoteStatus = quoteStatusFromExtraction(extraction);
  } catch (err) {
    console.error(`Quote extraction failed for message ${full.id}:`, err);
  }

  const { data: inserted, error: insertError } = await admin
    .from("email_replies")
    .insert({
      outbound_email_id: ctx.anchor?.id ?? null,
      venue_id: ctx.venueId,
      event_id: ctx.eventId,
      user_id: ctx.userId,
      gmail_message_id: full.id,
      from_email: fromEmail,
      snippet: full.snippet ?? null,
      body: body || null,
      received_at: full.internalDate
        ? new Date(Number(full.internalDate)).toISOString()
        : null,
      quote,
      quote_status: quoteStatus,
      rfc822_message_id: rfc822MessageId,
      matched_via: ctx.matchedVia,
    })
    .select()
    .single();
  if (insertError || !inserted) {
    // Unique violation on gmail_message_id = concurrent poll; ignore.
    if (insertError && !insertError.message.includes("duplicate")) {
      console.error("Failed to insert reply:", insertError.message);
    }
    return;
  }
  const reply = inserted as EmailReplyRow;

  if (ctx.anchor) {
    await admin
      .from("outbound_emails")
      .update({ status: "replied" })
      .eq("id", ctx.anchor.id);
  }
  summary.newReplies++;
  if (ctx.matchedVia === "tag") summary.tagMatched++;
  if (ctx.matchedVia === "sender") summary.senderMatched++;

  // Attachments → Storage (best-effort).
  summary.attachmentsSaved += await saveReplyAttachments(
    accessToken,
    admin,
    reply,
    full.payload
  );

  // Ava's proposed response needs our last outbound message for context.
  if (ctx.anchor) {
    const proposal = await generateReplyProposal(admin, reply);
    if (proposal) summary.proposalsCreated++;
  }
}

/**
 * One pass over the platform inbox: match new messages to outreach threads,
 * reply tags, or known senders (any user), persist replies + attachments,
 * queue Ava's reply proposals, and label unattributable Kalas mail.
 */
export async function pollPlatformReplies(): Promise<PollSummary> {
  const admin = createAdminClient();
  const summary: PollSummary = {
    checked: 0,
    newReplies: 0,
    attachmentsSaved: 0,
    proposalsCreated: 0,
    tagMatched: 0,
    senderMatched: 0,
    unmatchedLabeled: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
  };

  // All in-flight outreach threads, across every user. The thread anchor is
  // the initial outreach row; the message-id set covers our replies too, so
  // we never re-ingest our own messages.
  const { data: outbound } = await admin
    .from("outbound_emails")
    .select("*")
    .in("status", ["sent", "replied"])
    .not("gmail_thread_id", "is", null);
  const outboundRows = (outbound ?? []) as OutboundEmailRow[];
  const outboundByThread = new Map<string, OutboundEmailRow>();
  const outboundBySender = new Map<string, OutboundEmailRow[]>();
  const ourMessageIds = new Set<string>();
  for (const row of outboundRows) {
    if (row.gmail_message_id) ourMessageIds.add(row.gmail_message_id);
    if (row.kind === "outreach" && row.gmail_thread_id) {
      outboundByThread.set(row.gmail_thread_id, row);
    }
    const to = row.to_email.toLowerCase();
    const forSender = outboundBySender.get(to);
    if (forSender) forSender.push(row);
    else outboundBySender.set(to, [row]);
  }
  // Reply-kind rows whose thread has no outreach anchor loaded (shouldn't
  // happen, but anchor on them as fallback).
  for (const row of outboundRows) {
    if (row.gmail_thread_id && !outboundByThread.has(row.gmail_thread_id)) {
      outboundByThread.set(row.gmail_thread_id, row);
    }
  }

  let accessToken: string;
  try {
    accessToken = await getPlatformAccessToken();
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return { ...summary, error: "platform_mailbox_not_connected" };
    }
    throw err;
  }
  const platformEmail = (await getPlatformEmail())?.toLowerCase() ?? null;

  // Resolve the triage label up front so already-labeled mail is skipped
  // from the first run of a fresh process. Both calls are best-effort.
  await ensureLabel(accessToken, "kalas"); // parent, so the child label nests
  const unmatchedLabelId = await ensureLabel(accessToken, UNMATCHED_LABEL);

  const metas = await listInboxMessages(accessToken);

  // Already-ingested ids in a few batch queries instead of one per message.
  const ingested = new Set<string>();
  const listedIds = metas.map((m) => m.id);
  for (let i = 0; i < listedIds.length; i += 300) {
    const { data } = await admin
      .from("email_replies")
      .select("gmail_message_id")
      .in("gmail_message_id", listedIds.slice(i, i + 300));
    for (const row of data ?? []) {
      ingested.add((row as { gmail_message_id: string }).gmail_message_id);
    }
  }

  const fresh = metas.filter(
    (m) => !ourMessageIds.has(m.id) && !ingested.has(m.id)
  );
  summary.checked = fresh.length;

  const markUnmatched = async (threadId: string) => {
    if (!unmatchedLabelId) return;
    await applyLabels(accessToken, threadId, [unmatchedLabelId]);
    summary.unmatchedLabeled++;
  };

  // Per-event venue contact cache for tag matching.
  const venuesByEvent = new Map<string, { venueId: string; email: string | null }[]>();
  const loadEventVenues = async (eventId: string) => {
    const cached = venuesByEvent.get(eventId);
    if (cached) return cached;
    const { data } = await admin
      .from("venues")
      .select("id,email")
      .eq("event_id", eventId);
    const list = (data ?? []).map((v) => ({
      venueId: v.id as string,
      email: (v.email as string | null) ?? null,
    }));
    venuesByEvent.set(eventId, list);
    return list;
  };

  // Newest outbound row for a vendor, preferring the outreach anchor —
  // proposals and the replied-flip hang off it.
  const sentAt = (r: OutboundEmailRow) => Date.parse(r.sent_at ?? r.created_at) || 0;
  const beatsAnchor = (row: OutboundEmailRow, best: OutboundEmailRow | null): boolean => {
    if (!best) return true;
    const rowOutreach = row.kind === "outreach";
    const bestOutreach = best.kind === "outreach";
    if (rowOutreach !== bestOutreach) return rowOutreach;
    return sentAt(row) > sentAt(best);
  };
  const latestAnchor = (eventId: string, venueId: string): OutboundEmailRow | null => {
    let best: OutboundEmailRow | null = null;
    for (const row of outboundRows) {
      if (row.event_id !== eventId || row.venue_id !== venueId) continue;
      if (beatsAnchor(row, best)) best = row;
    }
    return best;
  };

  // Pass A — thread-id matches (replies inside our own outreach threads).
  for (const meta of fresh) {
    const anchor = outboundByThread.get(meta.threadId);
    if (!anchor) continue;
    try {
      const full = await gmailGet<GmailMessageFull>(
        accessToken,
        `/messages/${meta.id}?format=full`
      );
      if (full.labelIds?.includes("SENT")) continue; // sent by us, not a reply
      await ingestReply(
        admin,
        accessToken,
        full,
        {
          eventId: anchor.event_id,
          userId: anchor.user_id,
          venueId: anchor.venue_id,
          anchor,
          matchedVia: "thread",
        },
        summary
      );
    } catch (err) {
      console.error(`Failed to process message ${meta.id}:`, err);
    }
  }

  // Pass B — new threads: reply-tag routing, then the sender heuristic.
  if (platformEmail) {
    for (const meta of fresh) {
      if (outboundByThread.has(meta.threadId)) continue; // pass A territory
      try {
        const msgMeta = await gmailGet<GmailMessageFull>(
          accessToken,
          `/messages/${meta.id}?format=metadata` +
            "&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc" +
            "&metadataHeaders=Delivered-To&metadataHeaders=X-Original-To" +
            "&metadataHeaders=Message-ID"
        );
        if (msgMeta.labelIds?.includes("SENT")) continue;
        if (unmatchedLabelId && msgMeta.labelIds?.includes(unmatchedLabelId)) {
          continue; // already triaged to the mailbox operator
        }

        const fromEmail = bareEmail(header(msgMeta, "From"));
        if (fromEmail && fromEmail === platformEmail) continue;

        const tags = extractReplyTags(
          [
            header(msgMeta, "To"),
            header(msgMeta, "Cc"),
            header(msgMeta, "Delivered-To"),
            header(msgMeta, "X-Original-To"),
          ],
          platformEmail
        );

        let ctx: IngestContext | null = null;
        for (const tag of tags) {
          const { data: event } = await admin
            .from("events")
            .select("id,user_id")
            .eq("reply_tag", tag)
            .maybeSingle();
          if (!event) continue;
          const eventId = event.id as string;
          const venues = await loadEventVenues(eventId);
          const eventOutbound = outboundRows
            .filter((r) => r.event_id === eventId)
            .map((r) => ({ venueId: r.venue_id, toEmail: r.to_email }));
          const resolved = resolveVenueByEmail(fromEmail, venues, eventOutbound);
          if (resolved) {
            ctx = {
              eventId,
              userId: event.user_id as string,
              venueId: resolved.venueId,
              anchor: latestAnchor(eventId, resolved.venueId),
              matchedVia: "tag",
            };
            break;
          }
        }

        // Sender heuristic: a known vendor address that maps to exactly one
        // tenant. Ambiguity across users must never be guessed.
        let ambiguousSender = false;
        if (!ctx && fromEmail) {
          const rows = outboundBySender.get(fromEmail) ?? [];
          const pairs = new Set(rows.map((r) => `${r.event_id}:${r.venue_id}`));
          if (pairs.size === 1) {
            const row = rows[0];
            ctx = {
              eventId: row.event_id,
              userId: row.user_id,
              venueId: row.venue_id,
              anchor: latestAnchor(row.event_id, row.venue_id),
              matchedVia: "sender",
            };
          } else if (pairs.size > 1) {
            ambiguousSender = true;
          }
        }

        if (ctx) {
          const full = await gmailGet<GmailMessageFull>(
            accessToken,
            `/messages/${meta.id}?format=full`
          );
          if (full.labelIds?.includes("SENT")) continue;
          await ingestReply(admin, accessToken, full, ctx, summary);
        } else if (tags.length > 0 || ambiguousSender) {
          // Carried a Kalas signal but couldn't be attributed safely.
          await markUnmatched(meta.threadId);
        }
        // No signal at all → leave untouched (newsletters, notices).
      } catch (err) {
        console.error(`Failed to process message ${meta.id}:`, err);
      }
    }
  }

  await admin
    .from("platform_gmail_tokens")
    .update({ last_polled_at: new Date().toISOString() })
    .eq("id", 1);

  // Tell the couples what just came in. Also picks up anything a failed
  // earlier pass left unnotified, so it runs even when this pass found none.
  try {
    const notified = await notifyNewReplies(admin, { accessToken, fromEmail: platformEmail });
    summary.notificationsSent = notified.notificationsSent;
    summary.notificationsFailed = notified.notificationsFailed;
  } catch (err) {
    console.error("Reply notifications failed:", err);
  }

  return summary;
}
