/* The guide articles are written in a small Markdown subset, so a new article
   is prose in a template string rather than JSX. Parsing to blocks instead of
   HTML keeps internal links on next/link, gives the article page its table of
   contents from the same headings the reader sees, and lets a test check every
   link in every article.

   Supported: ## and ### headings, paragraphs, "- " and "1. " lists, "> "
   callouts, pipe tables, inline **bold** and [text](href), and a {{kalas}}
   line where the article's product card goes. */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { type: "h2" | "h3"; text: string; id: string }
  | { type: "p" | "callout"; inline: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][]; start: number }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] }
  | { type: "kalas" };

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "strong", v: m[1] });
    else out.push({ t: "link", v: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

/** Heading anchors: lower case, Danish letters spelled out, hyphens. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => parseInline(c.trim()));

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const used = new Map<string, number>();
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  const anchor = (text: string) => {
    const base = slugify(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };
  // A paragraph, list or callout runs until a blank line or another block starts.
  const startsBlock = (l: string) => /^(#{2,3} |- |\d+\. |> |\||\{\{kalas\}\}$)/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    if (line === "{{kalas}}") {
      blocks.push({ type: "kalas" });
      i++;
      continue;
    }

    const heading = line.match(/^(#{2,3}) (.+)$/);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ type: heading[1] === "##" ? "h2" : "h3", text, id: anchor(text) });
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++].trim());
      const body = rows.slice(1).filter((r) => !/^\|[\s:|-]+\|?$/.test(r));
      blocks.push({ type: "table", head: cells(rows[0]), rows: body.map(cells) });
      continue;
    }

    const list = line.match(/^(- |\d+\. )/);
    if (list) {
      const ordered = list[1] !== "- ";
      const marker = ordered ? /^\d+\. / : /^- /;
      const items: Inline[][] = [];
      // A numbered list split by subheadings keeps counting from where it was.
      const start = ordered ? parseInt(line, 10) : 1;
      while (i < lines.length && marker.test(lines[i].trim())) {
        items.push(parseInline(lines[i++].trim().replace(marker, "")));
      }
      blocks.push(ordered ? { type: "ol", items, start } : { type: "ul", items });
      continue;
    }

    if (line.startsWith("> ")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i++].trim().replace(/^>\s?/, ""));
      }
      blocks.push({ type: "callout", inline: parseInline(parts.join(" ")) });
      continue;
    }

    const parts: string[] = [];
    while (i < lines.length && lines[i].trim() && (parts.length === 0 || !startsBlock(lines[i]))) {
      parts.push(lines[i++].trim());
    }
    blocks.push({ type: "p", inline: parseInline(parts.join(" ")) });
  }

  return blocks;
}

export function plainText(inline: Inline[]): string {
  return inline.map((n) => n.v).join("");
}

/** Every href in a document, for link checks. */
export function linksIn(blocks: Block[]): string[] {
  const hrefs = (inline: Inline[]) => inline.flatMap((n) => (n.t === "link" ? [n.href] : []));
  return blocks.flatMap((b) => {
    switch (b.type) {
      case "p": case "callout": return hrefs(b.inline);
      case "ul": case "ol": return b.items.flatMap(hrefs);
      case "table": return [...b.head, ...b.rows.flat()].flatMap(hrefs);
      default: return [];
    }
  });
}

export function wordCount(src: string): number {
  return src.replace(/\{\{kalas\}\}|[#>|*\-[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
}

/** Minutes at a relaxed 200 words a minute, never less than one. */
export function readingMinutes(src: string): number {
  return Math.max(1, Math.round(wordCount(src) / 200));
}
