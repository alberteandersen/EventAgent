/* The couple's words to Juno in step 3 of the website builder, and the ideas
   shown above the box so they have somewhere to start. Tapping an idea adds
   it to the text as its own item; tapping it again takes that item back out.
   Whatever they typed themselves is left as it was. */

/** Danish source strings, shown through t(). None may contain a separator
    (, . ; : ! ?): an idea is read back out of the text as one whole item. */
export const BRIEF_IDEAS = [
  'Store billeder af os',
  'Blomster og grønt',
  'Varme farver',
  'Enkelt og rent',
  'Lidt mere festligt',
  'Ikke for højtideligt',
  'Lidt humor i teksterne',
  'Programmet skal være let at finde',
] as const;

const SEPARATOR = '[,.;:!?\\n]';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The idea as a whole item: at the start or right after a separator, and
    running to the next separator or the end. Inside a longer sentence of
    their own, it does not count. */
const itemPattern = (idea: string) =>
  new RegExp(`(^|${SEPARATOR})\\s*${escapeRegExp(idea.trim())}\\s*(?=${SEPARATOR}|$)`, 'i');

export function hasIdea(brief: string, idea: string): boolean {
  return itemPattern(idea).test(brief);
}

/** Adds the idea as the next item of the brief, or takes it out if it is one. */
export function toggleIdea(brief: string, idea: string): string {
  const match = itemPattern(idea).exec(brief);

  if (!match) {
    const base = brief.replace(/[\s,;]+$/, '');
    if (!base) return idea;
    if (/[.!?]$/.test(base)) return `${base} ${idea}`;
    return `${base}${base.endsWith(':') ? '' : ','} ${lowerFirst(idea)}`;
  }

  const [whole, separator] = match;
  const before = brief.slice(0, match.index);
  const after = brief.slice(match.index + whole.length);
  const rest = after.replace(/^[\s,.;:!?]+/, '');

  // It was the first item: whatever followed moves up to the start.
  if (!separator) return upperFirst(rest);
  // A full stop or a colon belongs to the sentence before it, so it stays.
  if (/[.:!?]/.test(separator)) {
    if (!rest) return before + separator;
    return `${before}${separator} ${separator === ':' ? rest : upperFirst(rest)}`;
  }
  // A comma or a line break goes out with the item.
  return before + after;
}
