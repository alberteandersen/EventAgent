import { describe, it, expect } from "vitest";
import { buildRawMessage, escapeHtml, textToHtml } from "./send";

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("buildRawMessage", () => {
  it("includes threading + reply headers when provided", () => {
    const msg = decode(
      buildRawMessage({
        to: "venue@example.com",
        subject: "Re: your wedding",
        body: "hello",
        fromName: "Juno at Kalas",
        fromEmail: "kalas@example.com",
        replyTo: "kalas+abcд1234@example.com".replace("д", "d"),
        inReplyTo: "<msg-1@example.com>",
        references: "<msg-1@example.com>",
      })
    );
    expect(msg).toContain("From: Juno at Kalas <kalas@example.com>");
    expect(msg).toContain("Reply-To: kalas+abcd1234@example.com");
    expect(msg).toContain("In-Reply-To: <msg-1@example.com>");
    expect(msg).toContain("References: <msg-1@example.com>");
    expect(msg).toContain("To: venue@example.com");
  });

  it("omits the From header when fromEmail is missing", () => {
    const msg = decode(
      buildRawMessage({ to: "a@b.com", subject: "hi", body: "x", fromName: "Juno" })
    );
    expect(msg).not.toContain("From:");
  });

  it("RFC 2047-encodes non-ASCII subjects", () => {
    const msg = decode(buildRawMessage({ to: "a@b.com", subject: "Rødvig café", body: "x" }));
    expect(msg).toContain("Subject: =?UTF-8?B?");
  });

  it("sends both a plain-text and an HTML alternative", () => {
    const msg = decode(buildRawMessage({ to: "a@b.com", subject: "hi", body: "Kære kro\n\nHar I ledigt?" }));
    const boundary = msg.match(/boundary="([^"]+)"/)?.[1];
    expect(boundary).toBeTruthy();
    expect(msg).toContain("Content-Type: multipart/alternative");
    expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(msg).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(msg.trimEnd().endsWith(`--${boundary}--`)).toBe(true);

    // Both parts carry the body and a signature.
    const parts = msg.split(`--${boundary}`).slice(1, 3).map((p) => {
      const encoded = p.split("\r\n\r\n")[1] ?? "";
      return Buffer.from(encoded, "base64").toString("utf8");
    });
    const [text, html] = parts;
    expect(text).toContain("Har I ledigt?");
    expect(text).toContain("-- \nJuno · Wedding Orchestrator");
    expect(html).toContain("<p style=\"margin:0 0 12px\">Har I ledigt?</p>");
    expect(html).toContain("Kalas ApS");
  });

  it("omits both signatures when asked", () => {
    const msg = decode(
      buildRawMessage({ to: "a@b.com", subject: "hi", body: "x", omitSignature: true })
    );
    expect(msg).not.toContain(Buffer.from("Kalas ApS", "utf8").toString("base64").slice(0, 8));
  });
});

describe("textToHtml", () => {
  it("turns blank-line blocks into paragraphs and single breaks into <br>", () => {
    expect(textToHtml("Kære kro,\n\nVenlig hilsen\nJuno")).toBe(
      '<p style="margin:0 0 12px">Kære kro,</p>\n' +
        '<p style="margin:0 0 12px">Venlig hilsen<br>Juno</p>'
    );
  });

  it("escapes HTML so a vendor name with & or < can't break the markup", () => {
    expect(escapeHtml('Smith & Sons <"the barn">')).toBe(
      "Smith &amp; Sons &lt;&quot;the barn&quot;&gt;"
    );
    expect(textToHtml("Smith & Sons")).toContain("Smith &amp; Sons");
  });
});
