import { describe, expect, it } from "vitest";
import { linksIn, parseInline, parseMarkdown, readingMinutes, slugify } from "./markdown";

describe("parseInline", () => {
  it("splits bold and links out of running text", () => {
    expect(parseInline("Læs **først** [tjeklisten](/guide/bryllup-tjekliste) her.")).toEqual([
      { t: "text", v: "Læs " },
      { t: "strong", v: "først" },
      { t: "text", v: " " },
      { t: "link", v: "tjeklisten", href: "/guide/bryllup-tjekliste" },
      { t: "text", v: " her." },
    ]);
  });

  it("leaves plain text alone", () => {
    expect(parseInline("32.624 par")).toEqual([{ t: "text", v: "32.624 par" }]);
  });
});

describe("slugify", () => {
  it("spells out æ, ø and å", () => {
    expect(slugify("Hvornår søger I om prøvelsesattest?")).toBe("hvornaar-soeger-i-om-proevelsesattest");
    expect(slugify("Gæster & bordplan")).toBe("gaester-bordplan");
  });
});

describe("parseMarkdown", () => {
  const doc = `
## Hvad koster det?
Et afsnit
over to linjer.

### Mad
- én
- to

1. først
2. så

> Tip: book **tidligt**.

| Post | Andel |
|---|---|
| Mad | 40 % |

## Hvad koster det?
`;
  const blocks = parseMarkdown(doc);

  it("reads every block type in order", () => {
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "h3", "ul", "ol", "callout", "table", "h2"]);
  });

  it("joins a paragraph's lines with a space", () => {
    expect(blocks[1]).toEqual({ type: "p", inline: [{ t: "text", v: "Et afsnit over to linjer." }] });
  });

  it("gives repeated headings distinct anchors", () => {
    expect(blocks[0]).toMatchObject({ id: "hvad-koster-det" });
    expect(blocks[7]).toMatchObject({ id: "hvad-koster-det-2" });
  });

  it("drops the table's separator row", () => {
    const table = blocks[6];
    expect(table.type === "table" && table.rows).toEqual([[[{ t: "text", v: "Mad" }], [{ t: "text", v: "40 %" }]]]);
  });

  it("does not swallow a list that follows a paragraph line", () => {
    expect(parseMarkdown("Husk:\n- a\n- b").map((b) => b.type)).toEqual(["p", "ul"]);
  });

  it("reads the product card marker as its own block", () => {
    expect(parseMarkdown("Tekst\n{{kalas}}\n\n## Næste").map((b) => b.type)).toEqual(["p", "kalas", "h2"]);
  });

  it("keeps a numbered list's first number", () => {
    expect(parseMarkdown("8. otte\n9. ni")[0]).toMatchObject({ type: "ol", start: 8 });
  });
});

describe("linksIn", () => {
  it("finds links in paragraphs, lists and tables", () => {
    const blocks = parseMarkdown("[a](/a)\n\n- [b](/b)\n\n| x |\n|---|\n| [c](/c) |");
    expect(linksIn(blocks)).toEqual(["/a", "/b", "/c"]);
  });
});

describe("readingMinutes", () => {
  it("never rounds down to zero", () => {
    expect(readingMinutes("kort")).toBe(1);
    expect(readingMinutes("ord ".repeat(1000))).toBe(5);
  });
});
