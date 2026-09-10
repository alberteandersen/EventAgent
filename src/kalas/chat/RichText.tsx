"use client";

/* Ava's messages, rendered as something you can skim.
 *
 * The bubble used to be `whitespace-pre-line` and nothing else, so a reply
 * listing four things arrived as one unbroken block of text. This turns the
 * plain text Gemini already writes into structure: blank line = paragraph,
 * lines starting with "-" or "•" = a list, **…** = bold. Deliberately not a
 * markdown library — Ava writes prose, not documents, and a full parser would
 * bring headings, tables and code blocks that have no place in a chat bubble.
 */

import { Fragment, type ReactNode } from 'react';

const BULLET = /^\s*([-*•])\s+/;

/** `**bold**` → <strong>. Nothing else: no links, no italics, no code. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  );
}

export default function RichText({ text }: { text: string }) {
  // Paragraphs are separated by a blank line; a single newline inside one is
  // just a wrap, except in a list, where every line is its own item.
  const blocks = text.trim().split(/\n\s*\n/);

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, b) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        const bullets = lines.filter((l) => BULLET.test(l));

        // A block counts as a list once most of it is bullets, so a lead-in
        // line above the items doesn't break the rendering.
        if (bullets.length >= 2 && bullets.length >= lines.length - 1) {
          const lead = BULLET.test(lines[0]) ? null : lines[0];
          return (
            <div key={b} className="flex flex-col gap-1.5">
              {lead && <p>{inline(lead, `${b}-lead`)}</p>}
              <ul className="flex flex-col gap-1">
                {bullets.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-current opacity-45" />
                    <span className="min-w-0">{inline(line.replace(BULLET, ''), `${b}-${i}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return <p key={b}>{inline(lines.join(' '), `${b}-p`)}</p>;
      })}
    </div>
  );
}
