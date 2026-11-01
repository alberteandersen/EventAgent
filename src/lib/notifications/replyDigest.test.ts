import { describe, expect, it } from "vitest";
import { buildReplyDigest, decodeEntities, groupByVendor, type DigestReply } from "./replyDigest";

const urls = {
  inboxUrl: "https://kalas-weddings.com/home?screen=inbox",
  settingsUrl: "https://kalas-weddings.com/settings",
};

const reply = (over: Partial<DigestReply> = {}): DigestReply => ({
  vendor: "Skovsgaard Gods",
  summary: "Ledig 14. juni, 45.000 kr for lokalet.",
  snippet: "Hej, tak for jeres henvendelse",
  hasProposal: false,
  ...over,
});

describe("buildReplyDigest", () => {
  it("names the vendor and quotes Juno's summary for a single reply", () => {
    const msg = buildReplyDigest({ name: "Alberte", replies: [reply()], lang: "da", ...urls });
    expect(msg.subject).toBe("Skovsgaard Gods har svaret");
    expect(msg.body).toContain("Hej Alberte,");
    expect(msg.body).toContain('"Ledig 14. juni, 45.000 kr for lokalet."');
    expect(msg.body).toContain(urls.inboxUrl);
    expect(msg.body).toContain(urls.settingsUrl);
  });

  it("lists each vendor when several replied", () => {
    const msg = buildReplyDigest({
      name: "",
      replies: [reply(), reply({ vendor: "Blomsterbinderiet", summary: "Sender et tilbud i morgen." })],
      lang: "en",
      ...urls,
    });
    expect(msg.subject).toBe("2 vendors have replied");
    expect(msg.body.startsWith("Hi,\n")).toBe(true);
    expect(msg.body).toContain("• Skovsgaard Gods: Ledig 14. juni");
    expect(msg.body).toContain("• Blomsterbinderiet: Sender et tilbud i morgen.");
    expect(msg.body).toContain("Read the replies in your Kalas inbox:");
  });

  it("counts two mails from one vendor as one reply", () => {
    const msg = buildReplyDigest({
      name: "",
      replies: [reply({ summary: "Første" }), reply({ summary: "Anden" })],
      lang: "da",
      ...urls,
    });
    expect(msg.subject).toBe("Skovsgaard Gods har svaret");
    expect(msg.body).toContain('"Anden"');
    expect(msg.body).not.toContain("Første");
  });

  it("mentions a waiting draft only when there is one", () => {
    const without = buildReplyDigest({ name: "", replies: [reply()], lang: "da", ...urls });
    const withDraft = buildReplyDigest({ name: "", replies: [reply({ hasProposal: true })], lang: "da", ...urls });
    expect(without.body).not.toContain("udkast");
    expect(withDraft.body).toContain("et svar til Skovsgaard Gods. Intet bliver sendt, før I har godkendt det.");
  });

  it("falls back to the decoded snippet, clipped, when Juno made no summary", () => {
    const long = "We don&#39;t have June free &amp; " + "more words ".repeat(40);
    const msg = buildReplyDigest({ name: "", replies: [reply({ summary: null, snippet: long })], lang: "en", ...urls });
    expect(msg.body).toContain("We don't have June free & more");
    expect(msg.body).toMatch(/…"/);
  });

  it("leaves out the quote line when there is nothing to quote", () => {
    const msg = buildReplyDigest({ name: "", replies: [reply({ summary: null, snippet: null })], lang: "da", ...urls });
    expect(msg.body).not.toContain('"');
  });
});

describe("groupByVendor", () => {
  it("keeps a proposal flagged on any of a vendor's mails", () => {
    const grouped = groupByVendor([reply({ hasProposal: true }), reply({ hasProposal: false })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].hasProposal).toBe(true);
  });
});

describe("decodeEntities", () => {
  it("undoes Gmail's snippet escaping", () => {
    expect(decodeEntities("Tom &amp; Jerry&#39;s &quot;fest&quot;")).toBe('Tom & Jerry\'s "fest"');
  });
});
