import { describe, it, expect } from "vitest";
import {
  extractReplyTags,
  bareEmail,
  isFreemailDomain,
  resolveVenueByEmail,
} from "./match";

const PLATFORM = "events@venli.ai";

describe("extractReplyTags", () => {
  it("finds a tag in a To header with a display name", () => {
    expect(
      extractReplyTags(['"Kalas (Juno)" <events+abcd2345@venli.ai>'], PLATFORM)
    ).toEqual(["abcd2345"]);
  });

  it("finds a tag when only Delivered-To carries it", () => {
    expect(
      extractReplyTags([null, undefined, "events+xyzw6789@venli.ai"], PLATFORM)
    ).toEqual(["xyzw6789"]);
  });

  it("handles multiple recipients in one header value", () => {
    expect(
      extractReplyTags(
        ["someone@else.dk, events+tag23456@venli.ai, other@x.com"],
        PLATFORM
      )
    ).toEqual(["tag23456"]);
  });

  it("dedupes across headers preserving first-seen order", () => {
    expect(
      extractReplyTags(
        [
          "events+first234@venli.ai",
          "events+second34@venli.ai, events+first234@venli.ai",
        ],
        PLATFORM
      )
    ).toEqual(["first234", "second34"]);
  });

  it("is case-insensitive and lowercases the tag", () => {
    expect(extractReplyTags(["Events+ABCD2345@Venli.AI"], PLATFORM)).toEqual([
      "abcd2345",
    ]);
  });

  it("escapes regex-special characters in the local part", () => {
    expect(
      extractReplyTags(["book.ings+tag23456@venli.ai"], "book.ings@venli.ai")
    ).toEqual(["tag23456"]);
    // The "." must not act as a wildcard.
    expect(
      extractReplyTags(["bookXings+tag23456@venli.ai"], "book.ings@venli.ai")
    ).toEqual([]);
  });

  it("ignores other domains, lookalike locals, and domain suffixes", () => {
    expect(extractReplyTags(["events+tag23456@gmail.com"], PLATFORM)).toEqual([]);
    expect(extractReplyTags(["otherevents+tag23456@venli.ai"], PLATFORM)).toEqual([]);
    expect(
      extractReplyTags(["events+tag23456@venli.ai.evil.com"], PLATFORM)
    ).toEqual([]);
  });

  it("rejects tags outside the expected shape", () => {
    expect(extractReplyTags(["events+ab@venli.ai"], PLATFORM)).toEqual([]);
    expect(extractReplyTags(["events@venli.ai"], PLATFORM)).toEqual([]);
    expect(extractReplyTags([], PLATFORM)).toEqual([]);
  });
});

describe("bareEmail", () => {
  it("extracts and lowercases an angled address", () => {
    expect(bareEmail('"Fru Larsen" <Booking@Slottet.DK>')).toBe("booking@slottet.dk");
  });

  it("extracts a bare address", () => {
    expect(bareEmail("booking@slottet.dk")).toBe("booking@slottet.dk");
  });

  it("returns null for garbage or missing input", () => {
    expect(bareEmail("not an email")).toBeNull();
    expect(bareEmail(null)).toBeNull();
    expect(bareEmail(undefined)).toBeNull();
  });
});

describe("isFreemailDomain", () => {
  it("flags shared providers, passes business domains", () => {
    expect(isFreemailDomain("gmail.com")).toBe(true);
    expect(isFreemailDomain("Hotmail.DK")).toBe(true);
    expect(isFreemailDomain("slottet.dk")).toBe(false);
  });
});

describe("resolveVenueByEmail", () => {
  const venues = [
    { venueId: "v1", email: "booking@slottet.dk" },
    { venueId: "v2", email: "hello@kro.dk" },
    { venueId: "v3", email: null },
  ];
  const outbound = [
    { venueId: "v2", toEmail: "old-address@kro.dk" },
    { venueId: "v3", toEmail: "info@laden.dk" },
  ];

  it("matches exact venue email first (case-insensitive)", () => {
    expect(resolveVenueByEmail("Booking@Slottet.DK", venues, outbound)).toEqual({
      venueId: "v1",
      via: "venue_email",
    });
  });

  it("falls back to outbound to_email", () => {
    expect(resolveVenueByEmail("old-address@kro.dk", venues, outbound)).toEqual({
      venueId: "v2",
      via: "outbound_to",
    });
  });

  it("falls back to a unique non-freemail domain match", () => {
    expect(resolveVenueByEmail("chef@laden.dk", venues, outbound)).toEqual({
      venueId: "v3",
      via: "domain",
    });
  });

  it("never domain-matches freemail providers", () => {
    const freemail = [{ venueId: "v9", email: "somevenue@gmail.com" }];
    expect(resolveVenueByEmail("other@gmail.com", freemail, [])).toBeNull();
  });

  it("returns null when the domain is shared by two venues", () => {
    const shared = [
      { venueId: "a", email: "info@slottet.dk" },
      { venueId: "b", email: "booking@slottet.dk" },
    ];
    expect(resolveVenueByEmail("chef@slottet.dk", shared, [])).toBeNull();
  });

  it("returns null on duplicate exact matches", () => {
    const dupes = [
      { venueId: "a", email: "info@slottet.dk" },
      { venueId: "b", email: "info@slottet.dk" },
    ];
    expect(resolveVenueByEmail("info@slottet.dk", dupes, [])).toBeNull();
  });

  it("returns null for missing or unparseable senders", () => {
    expect(resolveVenueByEmail(null, venues, outbound)).toBeNull();
    expect(resolveVenueByEmail("nonsense", venues, outbound)).toBeNull();
  });
});
