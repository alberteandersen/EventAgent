import Image from "next/image";
import Link from "next/link";
import { getCategory } from "@/content/guide";
import type { GuideArticle } from "@/content/guide/types";
import { readingMinutes } from "@/lib/guide/markdown";
import { ArrowDot, eyebrowClass } from "./kalas";

export function ArticleCard({ article, className = "" }: { article: GuideArticle; className?: string }) {
  return (
    <Link
      href={`/guide/${article.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-card transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(36,65,58,0.28)] ${className}`}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-shell">
        <Image
          src={article.image.src}
          alt=""
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className={`${eyebrowClass} text-sage`}>{getCategory(article.category).name}</p>
        <h3 className="mt-3 text-[1.55rem] font-semibold leading-[1.1] text-ink">{article.title}</h3>
        <p className="mt-3 line-clamp-3 flex-1 text-[0.9375rem] leading-relaxed text-ink-soft">{article.description}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">{readingMinutes(article.body)} min. læsning</span>
          <ArrowDot />
        </div>
      </div>
    </Link>
  );
}
