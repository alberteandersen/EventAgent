import { randomBytes } from "crypto";
import { appendSignature, kalasSignatureHtml } from "./signature";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Encode a header value as RFC 2047 UTF-8 base64 word when non-ASCII. */
function encodeHeader(value: string): string {
  if (/^[ -~]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export interface OutgoingMessage {
  to: string;
  subject: string;
  body: string;
  /** Display name for the From header, e.g. "Juno at Kalas". */
  fromName?: string;
  /** Address of the authenticated account; required for fromName to be honored. */
  fromEmail?: string;
  /** Per-event plus-address vendors should reply to, e.g. kalas+tag@domain. */
  replyTo?: string;
  /** Gmail thread to send into (replies). */
  threadId?: string;
  /** RFC 822 Message-ID of the message being replied to. */
  inReplyTo?: string;
  references?: string;
  /** Opt out of Juno's signature block (default: appended). */
  omitSignature?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Juno writes plain text; this renders it as HTML without inventing any
 * structure — blank-line-separated blocks become paragraphs, single breaks
 * stay breaks, so the greeting and sign-off keep their shape.
 */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 12px">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
}

/**
 * Build an RFC 2822 multipart/alternative message (plain text + HTML) and
 * base64url-encode it for the Gmail API. The plain part is the real fallback
 * for text-only clients, not an afterthought — it carries the same content
 * and the text form of the signature.
 */
export function buildRawMessage(args: OutgoingMessage): string {
  // Appended here rather than at compose time so it can't be edited away,
  // and so the stored outbound_emails.body stays clean copy — which is what
  // the reply-proposal prompt reads back as "our last message".
  const textBody = args.omitSignature ? args.body : appendSignature(args.body);
  const htmlBody = args.omitSignature
    ? textToHtml(args.body)
    : `${textToHtml(args.body)}\n<div style="margin-top:18px">${kalasSignatureHtml()}</div>`;

  // Underscores/hyphens can't appear in base64 output, so the boundary can
  // never collide with the encoded parts.
  const boundary = `----=_Kalas_${randomBytes(12).toString("hex")}`;

  const headers = [
    // Gmail rewrites From addresses that don't match the account, so the
    // display name only survives when fromEmail is the authenticated address.
    args.fromName && args.fromEmail
      ? `From: ${encodeHeader(args.fromName)} <${args.fromEmail}>`
      : null,
    `To: ${args.to}`,
    args.replyTo ? `Reply-To: ${args.replyTo}` : null,
    args.inReplyTo ? `In-Reply-To: ${args.inReplyTo}` : null,
    args.references ? `References: ${args.references}` : null,
    `Subject: ${encodeHeader(args.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((h): h is string => Boolean(h));

  const part = (mime: string, content: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${mime}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(content, "utf8").toString("base64"),
    ].join("\r\n");

  const message = [
    ...headers,
    "",
    part("text/plain", textBody),
    part("text/html", `<html><body>${htmlBody}</body></html>`),
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

/** Send via Gmail API. Pass threadId to send a reply into an existing thread. */
export async function sendEmail(
  accessToken: string,
  args: OutgoingMessage
): Promise<SendResult> {
  const payload: { raw: string; threadId?: string } = { raw: buildRawMessage(args) };
  if (args.threadId) payload.threadId = args.threadId;

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail send failed (${res.status}): ${data.error?.message ?? "unknown error"}`);
  }
  return { messageId: data.id as string, threadId: data.threadId as string };
}
