/* The mail Juno sends the couple when vendors write back.
 *
 * Composition lives here rather than in the notifier so the wording is
 * testable without a Gmail token or a database, and so the two languages stay
 * side by side where a change to one is an obvious prompt to change the other.
 * It is a digest: one mail per poll per person, however many replies came in. */

export interface DigestReply {
  vendor: string;
  /** Juno's one-line reading of the reply (quote.summary), when she made one. */
  summary: string | null;
  /** Gmail's snippet of the message, the fallback when there is no summary. */
  snippet: string | null;
  /** Juno has drafted a response that waits for the couple's approval. */
  hasProposal: boolean;
}

export interface ReplyDigestMessage {
  subject: string;
  body: string;
}

const MAX_LINE = 220;

/** Gmail snippets arrive HTML-escaped ("don&#39;t"); undo the common ones. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** "A", "A and B", "A, B and C" (no Oxford comma; Danish has none). */
function listNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= MAX_LINE) return flat;
  return `${flat.slice(0, MAX_LINE - 1).replace(/\s+\S*$/, "")}…`;
}

/** What to say about one reply: Juno's summary, else the start of the mail. */
function gist(reply: DigestReply): string | null {
  const text = reply.summary?.trim() || (reply.snippet ? decodeEntities(reply.snippet) : "");
  return text ? clip(text) : null;
}

/**
 * Several mails from one vendor in the same poll read as one entry: the
 * newest gist (replies arrive oldest first), and a proposal if any has one.
 */
export function groupByVendor(replies: DigestReply[]): DigestReply[] {
  const byVendor = new Map<string, DigestReply>();
  for (const reply of replies) {
    const seen = byVendor.get(reply.vendor);
    if (!seen) {
      byVendor.set(reply.vendor, { ...reply });
      continue;
    }
    byVendor.set(reply.vendor, {
      vendor: reply.vendor,
      summary: reply.summary ?? seen.summary,
      snippet: reply.snippet ?? seen.snippet,
      hasProposal: seen.hasProposal || reply.hasProposal,
    });
  }
  return [...byVendor.values()];
}

/**
 * `name` is the recipient's first name and may be empty, in which case the
 * greeting stays unaddressed. `replies` must not be empty.
 */
export function buildReplyDigest({
  name,
  replies,
  inboxUrl,
  settingsUrl,
  lang,
}: {
  name: string;
  replies: DigestReply[];
  inboxUrl: string;
  settingsUrl: string;
  lang: "da" | "en";
}): ReplyDigestMessage {
  const entries = groupByVendor(replies);
  const one = entries.length === 1 ? entries[0] : null;
  const drafted = entries.filter((e) => e.hasProposal).map((e) => e.vendor);
  const greetName = name.trim();

  const lines = (label: (e: DigestReply) => string) =>
    entries.map((e) => {
      const said = gist(e);
      return said ? `• ${label(e)}: ${said}` : `• ${label(e)}`;
    });

  if (lang === "en") {
    const intro = one
      ? `${one.vendor} has replied to your enquiry.`
      : `${entries.length} vendors have replied to your enquiries.`;
    const detail = one
      ? gist(one) ? [`"${gist(one)}"`] : []
      : lines((e) => e.vendor);
    return {
      subject: one ? `${one.vendor} has replied` : `${entries.length} vendors have replied`,
      body: [
        greetName ? `Hi ${greetName},` : "Hi,",
        "",
        intro,
        ...(detail.length ? ["", detail.join("\n")] : []),
        ...(drafted.length
          ? ["", `I've drafted a reply to ${listNames(drafted, "and")}. Nothing goes out until you approve it.`]
          : []),
        "",
        one ? "Read the full reply in your Kalas inbox:" : "Read the replies in your Kalas inbox:",
        inboxUrl,
        "",
        "Warmly,",
        "Juno",
        "",
        `You get these emails when a vendor writes back. Turn them off in Settings: ${settingsUrl}`,
      ].join("\n"),
    };
  }

  const intro = one
    ? `${one.vendor} har svaret på jeres forespørgsel.`
    : `${entries.length} leverandører har svaret på jeres forespørgsler.`;
  const detail = one
    ? gist(one) ? [`"${gist(one)}"`] : []
    : lines((e) => e.vendor);
  return {
    subject: one ? `${one.vendor} har svaret` : `${entries.length} leverandører har svaret`,
    body: [
      greetName ? `Hej ${greetName},` : "Hej,",
      "",
      intro,
      ...(detail.length ? ["", detail.join("\n")] : []),
      ...(drafted.length
        ? ["", `Jeg har skrevet et udkast til et svar til ${listNames(drafted, "og")}. Intet bliver sendt, før I har godkendt det.`]
        : []),
      "",
      one ? "Læs hele svaret i jeres Kalas-indbakke:" : "Læs svarene i jeres Kalas-indbakke:",
      inboxUrl,
      "",
      "Kærlig hilsen",
      "Juno",
      "",
      `Du får disse mails, når en leverandør svarer. Du kan slå dem fra under Indstillinger: ${settingsUrl}`,
    ].join("\n"),
  };
}
