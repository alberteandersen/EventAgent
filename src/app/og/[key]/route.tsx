import { ImageResponse } from "next/og";
import { ARTICLES, getArticle, getCategory } from "@/content/guide";

/* Share images for the public pages: what a link to Kalas or a guide article
   looks like in Messenger, Slack or a search result. Drawn at build time from
   the same titles as the pages, so an article never ships without one. */

const CARDS: Record<string, { eyebrow: string; title: string }> = {
  kalas: { eyebrow: "Kalas", title: "Plan the wedding. Skip the stress." },
  guide: { eyebrow: "Kalas · Bryllupsguide", title: "Råd til hele brylluppet, fra tjekliste til brudevals" },
  faq: { eyebrow: "Kalas · Bryllupsguide", title: "Spørgsmål og svar om bryllupsplanlægning" },
};

function card(key: string) {
  if (CARDS[key]) return CARDS[key];
  const article = getArticle(key);
  return article && { eyebrow: `Bryllupsguide · ${getCategory(article.category).name}`, title: article.title };
}

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...Object.keys(CARDS), ...ARTICLES.map((a) => a.slug)].map((key) => ({ key }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const content = card((await params).key);
  if (!content) return new Response("Not found", { status: 404 });

  const size = content.title.length > 60 ? 64 : content.title.length > 40 ? 76 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f4f5f3",
          color: "#24413a",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: "#7d938a" }}>
          {content.eyebrow}
        </div>
        <div style={{ display: "flex", fontSize: size, lineHeight: 1.05, fontWeight: 700, maxWidth: 1000 }}>
          {content.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>Kalas</div>
          <div style={{ display: "flex", width: 120, height: 8, borderRadius: 4, background: "#7d938a" }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
