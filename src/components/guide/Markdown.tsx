import Link from "next/link";
import type { Block, Inline } from "@/lib/guide/markdown";

const linkClass =
  "font-semibold text-ink underline decoration-sage decoration-2 underline-offset-4 transition-colors hover:decoration-ink";

/** Given inside the app, where a link to another guide should open it in
    place rather than leave for the public website. */
export type InternalLinkHandler = (href: string) => void;

export function InlineText({ nodes, onInternalLink }: { nodes: Inline[]; onInternalLink?: InternalLinkHandler }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === "strong") return <strong key={i} className="font-semibold text-ink">{n.v}</strong>;
        if (n.t === "link") {
          if (onInternalLink && n.href.startsWith("/guide")) {
            return (
              <button key={i} type="button" onClick={() => onInternalLink(n.href)} className={`${linkClass} cursor-pointer`}>
                {n.v}
              </button>
            );
          }
          return n.href.startsWith("/") ? (
            <Link key={i} href={n.href} className={linkClass}>{n.v}</Link>
          ) : (
            <a key={i} href={n.href} className={linkClass} rel="noopener">{n.v}</a>
          );
        }
        return n.v;
      })}
    </>
  );
}

/** `productCard` renders where the article has its {{kalas}} line. */
export function Markdown({
  blocks,
  productCard,
  onInternalLink,
}: {
  blocks: Block[];
  productCard?: React.ReactNode;
  onInternalLink?: InternalLinkHandler;
}) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "kalas":
            return productCard ? <div key={i}>{productCard}</div> : null;
          case "h2":
            return (
              <h2 key={i} id={b.id} className="mb-4 mt-14 scroll-mt-24 text-[2rem] font-semibold leading-[1.1] text-ink sm:text-[2.25rem]">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={b.id} className="mb-3 mt-9 scroll-mt-24 text-[1.5rem] font-semibold leading-tight text-ink">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="my-5 text-[1.0625rem] leading-[1.75] text-ink-soft">
                <InlineText nodes={b.inline} onInternalLink={onInternalLink} />
              </p>
            );
          case "callout":
            return (
              <div key={i} className="my-8 rounded-[22px] border border-line bg-sage-tint/45 px-6 py-5 text-[1.0625rem] leading-[1.7] text-ink-soft">
                <InlineText nodes={b.inline} onInternalLink={onInternalLink} />
              </div>
            );
          case "ul":
            return (
              <ul key={i} className="my-5 list-disc space-y-2.5 pl-6 text-[1.0625rem] leading-[1.7] text-ink-soft marker:text-sage">
                {b.items.map((item, j) => <li key={j} className="pl-1"><InlineText nodes={item} onInternalLink={onInternalLink} /></li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} start={b.start} className="my-5 list-decimal space-y-2.5 pl-6 text-[1.0625rem] leading-[1.7] text-ink-soft marker:font-bold marker:text-sage-strong">
                {b.items.map((item, j) => <li key={j} className="pl-1"><InlineText nodes={item} onInternalLink={onInternalLink} /></li>)}
              </ol>
            );
          case "table":
            return (
              <div key={i} className="my-8 overflow-x-auto rounded-[22px] border border-line bg-card">
                <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">
                  <thead className="bg-shell">
                    <tr>
                      {b.head.map((cell, j) => (
                        <th key={j} scope="col" className="px-4 py-3 font-semibold text-ink">
                          <InlineText nodes={cell} onInternalLink={onInternalLink} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j} className="border-t border-line">
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-3 align-top leading-relaxed text-ink-soft">
                            <InlineText nodes={cell} onInternalLink={onInternalLink} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}
