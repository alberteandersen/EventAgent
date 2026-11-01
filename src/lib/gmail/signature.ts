// Juno's signature block, appended to every outgoing message at the transport
// layer, in both the plain-text and HTML parts.
//
// Two reasons it lives in code rather than in Gmail's settings:
//   · Gmail's own signature only applies to mail composed in the Gmail web
//     UI — it is never added to messages sent through users.messages.send,
//     which is how Kalas sends everything.
//   · The model must never write it. Brand name and contact details are not
//     things to translate, paraphrase or hallucinate; the per-language
//     sign-off ("Venlig hilsen, Juno …") is the model's job, this is not.
//
// Deliberately language-neutral (a name, a role, a company, a domain) so it
// reads correctly under a Danish, Italian or English email alike.

/** Address vendors see. Replies route via the Reply-To header instead, so
 *  the per-event plus tag is never exposed here. */
export const KALAS_FROM_ADDRESS = "juno@kalas-weddings.com";
export const KALAS_DOMAIN = "kalas-weddings.com";

const NAME = "Juno";
const ROLE = "Wedding Orchestrator";
const COMPANY = "Kalas ApS";

/** Burgundy sampled from the Kalas "K" mark. */
const BRAND = "#7d1b2e";
const MUTED = "#666666";

/**
 * Logo shown in the HTML signature. Host it alongside the other brand assets
 * and set the env var; when unset the signature renders text-only rather
 * than showing a broken-image icon in a stranger's inbox.
 */
export const KALAS_LOGO_URL = process.env.NEXT_PUBLIC_KALAS_LOGO_URL ?? "";

/** RFC 3676 delimiter — "-- " on its own line. Mail clients recognise it and
 *  fold or grey out everything below, so the signature reads as chrome. */
const SIG_DELIMITER = "-- ";

export const KALAS_SIGNATURE = [
  SIG_DELIMITER,
  `${NAME} · ${ROLE}`,
  COMPANY,
  `${KALAS_FROM_ADDRESS} · ${KALAS_DOMAIN}`,
].join("\n");

/**
 * The HTML signature. Table-based with inline styles — the only layout
 * approach mail clients render consistently. Widths are fixed and the image
 * keeps its aspect ratio, since Outlook ignores `height:auto` on a bare img.
 */
export function kalasSignatureHtml(logoUrl = KALAS_LOGO_URL): string {
  const logoCell = logoUrl
    ? `<td style="vertical-align:top;padding:0 15px 0 0">` +
      `<img src="${logoUrl}" width="96" alt="${COMPANY}" ` +
      `style="display:block;border:0;outline:none;text-decoration:none;height:auto"></td>`
    : "";
  return (
    `<table cellpadding="0" cellspacing="0" border="0" ` +
    `style="font-size:13px;color:#333333;font-family:Arial,Helvetica,sans-serif">` +
    `<tbody><tr>${logoCell}` +
    `<td style="vertical-align:top">` +
    `<p style="line-height:1.38;margin:0 0 2pt">` +
    `<span style="font-size:10.5pt;color:${BRAND}">${NAME}</span></p>` +
    `<p style="line-height:1.38;margin:0 0 2pt">` +
    `<span style="font-size:8.5pt;font-weight:700">${ROLE}<br>${COMPANY}</span></p>` +
    `<p style="line-height:1.38;margin:0">` +
    `<span style="font-size:8.5pt;color:${MUTED}">` +
    `<a href="https://${KALAS_DOMAIN}" style="color:${MUTED};text-decoration:none">${KALAS_DOMAIN}</a>` +
    `</span></p>` +
    `</td></tr></tbody></table>`
  );
}

/**
 * Body with the plain-text signature appended, separated by a blank line.
 * Idempotent: a body that already carries it is returned as-is, so a re-sent
 * draft never stacks two copies.
 */
export function appendSignature(body: string, signature = KALAS_SIGNATURE): string {
  const trimmed = body.replace(/\s+$/, "");
  if (trimmed.endsWith(signature)) return trimmed;
  return `${trimmed}\n\n${signature}`;
}
