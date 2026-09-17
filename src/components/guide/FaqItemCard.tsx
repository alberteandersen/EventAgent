import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/content/guide/types";
import { parseMarkdown, slugify } from "@/lib/guide/markdown";
import { Markdown } from "./Markdown";

/* A question that opens in place. The answer is in the HTML either way, so
   search engines and AI crawlers read it whether or not it is open. */
export function FaqItemCard({ item, open = false }: { item: FaqItem; open?: boolean }) {
  return (
    <details id={slugify(item.q)} open={open} className="group scroll-mt-24 rounded-[22px] border border-line bg-card transition-colors open:border-sage">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[1.3rem] font-semibold leading-snug text-ink">{item.q}</h3>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-transform group-open:rotate-180">
          <ChevronDown size={16} aria-hidden />
        </span>
      </summary>
      <div className="-mt-4 px-5 pb-2">
        <Markdown blocks={parseMarkdown(item.a)} />
      </div>
    </details>
  );
}
