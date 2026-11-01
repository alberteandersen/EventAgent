import { describe, it, expect } from "vitest";
import { appendSignature, kalasSignatureHtml, KALAS_SIGNATURE } from "./signature";

describe("appendSignature", () => {
  it("appends the block after a blank line", () => {
    const out = appendSignature("Kære kro,\n\nHar I ledigt?\n\nVenlig hilsen\nJuno");
    expect(out).toBe(
      "Kære kro,\n\nHar I ledigt?\n\nVenlig hilsen\nJuno\n\n" + KALAS_SIGNATURE
    );
  });

  it("uses the RFC 3676 delimiter so clients fold it away", () => {
    expect(appendSignature("hi")).toContain("\n-- \nJuno · Wedding Orchestrator");
  });

  it("is idempotent, a re-sent draft never stacks two copies", () => {
    const once = appendSignature("hi");
    expect(appendSignature(once)).toBe(once);
  });

  it("normalizes trailing whitespace before appending", () => {
    expect(appendSignature("hi\n\n  \n")).toBe("hi\n\n" + KALAS_SIGNATURE);
  });
});

describe("kalasSignatureHtml", () => {
  it("renders the identity block", () => {
    const html = kalasSignatureHtml("https://cdn.example.com/k.png");
    expect(html).toContain("Juno");
    expect(html).toContain("Wedding Orchestrator<br>Kalas ApS");
    expect(html).toContain('href="https://kalas-weddings.com"');
  });

  it("includes the logo when a URL is configured", () => {
    const html = kalasSignatureHtml("https://cdn.example.com/k.png");
    expect(html).toContain('<img src="https://cdn.example.com/k.png"');
  });

  it("omits the image entirely when no logo is configured", () => {
    // A broken-image icon in a stranger's inbox is worse than no logo.
    const html = kalasSignatureHtml("");
    expect(html).not.toContain("<img");
    expect(html).toContain("Kalas ApS");
  });
});
