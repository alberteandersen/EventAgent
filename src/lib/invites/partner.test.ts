import { describe, expect, it } from "vitest";
import {
  buildPartnerInvite,
  generateInviteToken,
  inviteUrl,
  isPlausibleEmail,
} from "./partner";

describe("generateInviteToken", () => {
  it("is URL-safe and long enough to be unguessable", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInviteToken));
    expect(tokens.size).toBe(50);
  });
});

describe("isPlausibleEmail", () => {
  it("accepts an ordinary address", () => {
    expect(isPlausibleEmail("partner@email.dk")).toBe(true);
    expect(isPlausibleEmail("  partner@email.dk  ")).toBe(true);
  });

  it("rejects what the old UI let through", () => {
    // The button only checked for '@', so all of these counted as valid.
    expect(isPlausibleEmail("@")).toBe(false);
    expect(isPlausibleEmail("partner@")).toBe(false);
    expect(isPlausibleEmail("partner@email")).toBe(false);
    expect(isPlausibleEmail("two @ signs@email.dk")).toBe(false);
  });
});

describe("inviteUrl", () => {
  it("joins without doubling the slash", () => {
    expect(inviteUrl("https://example.test/", "abc")).toBe(
      "https://example.test/invite/abc",
    );
    expect(inviteUrl("https://example.test", "abc")).toBe(
      "https://example.test/invite/abc",
    );
  });
});

describe("buildPartnerInvite", () => {
  const base = { inviterName: "Alberte", partnerName: "Mads", url: "https://k.dk/invite/t" };

  it("greets the partner by name and names the inviter", () => {
    const { subject, body } = buildPartnerInvite({ ...base, lang: "da" });
    expect(subject).toContain("Alberte");
    expect(body).toContain("Hej Mads,");
    expect(body).toContain("https://k.dk/invite/t");
  });

  it("stays unaddressed when the partner's name is unknown", () => {
    const { body } = buildPartnerInvite({ ...base, partnerName: "", lang: "da" });
    expect(body).toContain("Hej,");
    expect(body).not.toContain("Hej ,");
  });

  it("falls back to a generic inviter rather than an empty sentence", () => {
    const da = buildPartnerInvite({ ...base, inviterName: "  ", lang: "da" });
    expect(da.subject).toContain("Din partner");
    const en = buildPartnerInvite({ ...base, inviterName: "", lang: "en" });
    expect(en.subject).toContain("Your partner");
  });

  it("says the link joins them to the same wedding", () => {
    expect(buildPartnerInvite({ ...base, lang: "da" }).body).toMatch(/samme bryllup/);
    expect(buildPartnerInvite({ ...base, lang: "en" }).body).toMatch(/same wedding/);
  });

  it("writes its own sign-off, the transport signature is only chrome", () => {
    expect(buildPartnerInvite({ ...base, lang: "da" }).body).toContain("Kærlig hilsen");
    expect(buildPartnerInvite({ ...base, lang: "en" }).body).toContain("Warmly,");
  });
});
