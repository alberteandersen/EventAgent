/* The trust boundary for model-built site HTML. Everything Gemini emits
   passes through here before storage: an allowlist sanitizer (no scripts,
   frames, forms, handlers or real URLs) plus a CSS scrub of the style block.
   Images may only be {{img:ALIAS}} tokens, real URLs are substituted
   per-request at serve time (resolveHtml.ts), so stored markup never fetches
   anything the platform didn't mint. */

import sanitizeHtml from "sanitize-html";

/** Alias token: {{img:P1}}, {{img:V3}}, {{img:S-dresscode}}, {{img:<uuid>}} */
export const IMG_ALIAS_RE = /^\{\{img:[A-Za-z0-9-]{1,40}\}\}$/;
const IMG_ALIAS_INLINE = /\{\{img:[A-Za-z0-9-]{1,40}\}\}/;

const ALLOWED_TAGS = [
  "style",
  "div", "section", "header", "footer", "main", "nav", "article", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "strong", "em", "b", "i",
  "small", "blockquote", "q", "cite", "hr", "br",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tr", "td", "th",
  "figure", "figcaption", "img", "a", "button", "time", "address",
];

const GLOBAL_ATTRS = ["class", "id", "style", "data-kalas", "aria-label", "aria-hidden", "role"];

/** Scrub the contents of <style> blocks: no imports, no expressions, and no
    url() that isn't an image alias or a data: image. */
export function scrubCss(css: string): string {
  let out = css;
  out = out.replace(/@import[^;]*;?/gi, "");
  out = out.replace(/expression\s*\(/gi, "invalid(");
  out = out.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (_m, _q, target: string) => {
    const t = target.trim();
    if (IMG_ALIAS_INLINE.test(t) && /^\{\{img:[A-Za-z0-9-]{1,40}\}\}$/.test(t)) return `url(${t})`;
    return "none";
  });
  // Belt-and-braces: no protocol handlers should survive inside CSS values.
  out = out.replace(/javascript\s*:/gi, "");
  return out;
}

/**
 * Sanitize a model-built HTML fragment. Returns the safe markup, or null when
 * the result is implausibly small (failed generation — keep the old version).
 * The floor defaults to a whole site; an invitation card is one screen.
 */
export function sanitizeSiteHtml(
  raw: string,
  floor: { markup: number; text: number } = { markup: 800, text: 120 },
): string | null {
  // Strip markdown fences the model might add despite instructions.
  const unfenced = raw.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "");

  const clean = sanitizeHtml(unfenced, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": GLOBAL_ATTRS,
      img: [...GLOBAL_ATTRS, "src", "alt", "width", "height", "loading"],
      a: [...GLOBAL_ATTRS, "href", "target", "rel"],
      button: [...GLOBAL_ATTRS, "type"],
      time: [...GLOBAL_ATTRS, "datetime"],
      td: [...GLOBAL_ATTRS, "colspan", "rowspan"],
      th: [...GLOBAL_ATTRS, "colspan", "rowspan"],
    },
    // Anchors may only link within the page; images only via alias tokens.
    allowedSchemes: [],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        const src = frame.attribs.src ?? "";
        return !IMG_ALIAS_RE.test(src);
      }
      return false;
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        // In-page anchors only — external links can't be model-authored.
        const safeHref = href.startsWith("#") ? href : undefined;
        return {
          tagName,
          attribs: {
            ...Object.fromEntries(Object.entries(attribs).filter(([k]) => k !== "href" && k !== "target" && k !== "rel")),
            ...(safeHref ? { href: safeHref } : {}),
          },
        };
      },
    },
    textFilter: (text, tagName) => (tagName === "style" ? scrubCss(text) : text),
  });

  // Inline style attributes: strip any url()/expression/behavior payloads.
  const withSafeInline = clean.replace(/style="([^"]*)"/gi, (_m, value: string) => {
    let v = value as string;
    v = v.replace(/expression\s*\(/gi, "invalid(");
    v = v.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (_mm, _q, target: string) => {
      const t = target.trim();
      return /^\{\{img:[A-Za-z0-9-]{1,40}\}\}$/.test(t) ? `url(${t})` : "none";
    });
    v = v.replace(/javascript\s*:/gi, "");
    return `style="${v}"`;
  });

  const textLength = withSafeInline.replace(/<[^>]*>/g, "").trim().length;
  if (withSafeInline.length < floor.markup || textLength < floor.text) return null;
  return withSafeInline;
}
