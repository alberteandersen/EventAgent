import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseConfig } from "@/kalas/site/config";
import { parseSiteDesign, DEFAULT_DESIGN, type SiteDesign } from "@/kalas/site/design";
import { googleFontsHref, SITE_FONTS } from "@/kalas/site/fonts";
import { urlMapForDesign } from "@/lib/website/buildSite";
import { resolveHtml, familiesInHtml } from "@/lib/website/resolveHtml";
import { siteCookieName, siteCookieValue } from "@/lib/site-auth";
import { publicCouple, siteLanguage, siteTitle } from "@/lib/website/publicCouple";
import type {
  EventRow, ProfileRow, RegistryItemRow, RegistryClaimRow, WeddingSiteRow,
  WebsiteDesignRow, SitePhotoRow, VenueRow, AppLanguage,
} from "@/lib/db/types";
import { PublicSite } from "./PublicSite";

export const dynamic = "force-dynamic";

/* A wedding site is an invitation, not a website. The couple sends a link to
   the people they want there — they are not publishing their full names, the
   date and the venue's address for anyone who searches. Nothing about the
   page said so, and with pwProtected off by default it was indexable as it
   stood. noindex on every one of them; the guests have the link.
   Folded into generateMetadata because Next allows only one of the two. */
const ROBOTS = { index: false, follow: false, nocache: true } as const;

/* What the link looks like when it lands in the family group chat. Without
   this it inherited the root layout's metadata and previewed as Kalas'
   marketing pitch — the couple's own invitation, advertising the tool that
   made it. */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: siteRow } = await admin
    .from("wedding_sites").select("*").ilike("domain", slug).maybeSingle();
  const site = siteRow as WeddingSiteRow | null;
  // An unpublished or missing site says nothing about whose it is.
  if (!site || !site.published) return { robots: ROBOTS, title: "Kalas" };

  const [{ data: eventRow }, { data: profileRow }] = await Promise.all([
    admin.from("events").select("*").eq("id", site.event_id).maybeSingle(),
    admin.from("profiles").select("*").eq("user_id", site.user_id).maybeSingle(),
  ]);
  const event = eventRow as EventRow | null;
  if (!event) return { robots: ROBOTS, title: "Kalas" };

  const profile = profileRow as ProfileRow | null;
  const couple = publicCouple(event, profile);
  const title = siteTitle(couple, siteLanguage(profile));

  return {
    robots: ROBOTS,
    title,
    description: couple.dateLabel || undefined,
    openGraph: { title, description: couple.dateLabel || undefined, type: "website" },
    twitter: { card: "summary_large_image", title, description: couple.dateLabel || undefined },
  };
}


export default async function PublicWeddingSite({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string }>;
}) {
  const { slug } = await params;
  const { rsvp: rsvpToken } = await searchParams;
  const admin = createAdminClient();

  // Look up the published site by its (case-insensitive) domain.
  const { data: siteRow } = await admin
    .from("wedding_sites")
    .select("*")
    .ilike("domain", slug)
    .maybeSingle();
  const site = siteRow as WeddingSiteRow | null;
  if (!site || !site.published) notFound();

  // One more guest has opened it. The couple checking their own page is not a
  // visit, and a failed count must never cost a guest the page.
  const { data: { user: viewer } } = await (await createClient()).auth.getUser();
  if (viewer?.id !== site.user_id) {
    void admin.rpc("increment_site_view", { site_id: site.id }).then(() => undefined, () => undefined);
  }

  const [{ data: eventRow }, { data: profileRow }, { data: items }, { data: claims }, { data: designRow }, { data: photoRows }] = await Promise.all([
    admin.from("events").select("*").eq("id", site.event_id).maybeSingle(),
    admin.from("profiles").select("*").eq("user_id", site.user_id).maybeSingle(),
    admin.from("registry_items").select("*").eq("event_id", site.event_id).order("sort"),
    admin.from("registry_claims").select("item_id, quantity").eq("event_id", site.event_id),
    admin.from("website_designs").select("*").eq("event_id", site.event_id).eq("active", true).maybeSingle(),
    admin.from("site_photos").select("*").eq("event_id", site.event_id).order("sort"),
  ]);
  const event = eventRow as EventRow | null;
  if (!event) notFound();
  const profile = (profileRow as ProfileRow | null) ?? null;

  const config = parseConfig(site.config); // strips sitePassword by construction
  const couple = publicCouple(event, profile);
  const lang: AppLanguage = siteLanguage(profile);
  const registryItems = (items as RegistryItemRow[] | null) ?? [];
  const claimedByItem: Record<string, number> = {};
  for (const c of (claims as Pick<RegistryClaimRow, "item_id" | "quantity">[] | null) ?? []) {
    claimedByItem[c.item_id] = (claimedByItem[c.item_id] ?? 0) + (c.quantity ?? 1);
  }

  // Ava's design + per-request signed URLs. The page is force-dynamic, so
  // 1-hour URLs are always fresh for guests while the bucket stays private.
  const activeDesign = designRow as WebsiteDesignRow | null;
  const design: SiteDesign = activeDesign ? parseSiteDesign(activeDesign.design) : DEFAULT_DESIGN;
  const photos = (photoRows as SitePhotoRow[] | null) ?? [];

  // Model-built HTML path: substitute image aliases with fresh URLs.
  let siteHtml: string | null = null;
  let htmlFamilies: string[] = [];
  if (activeDesign?.html) {
    let venue: VenueRow | null = null;
    if (event.chosen_venue_id) {
      const { data: v } = await admin.from("venues").select("*").eq("id", event.chosen_venue_id).maybeSingle();
      venue = v as VenueRow | null;
    }
    const urlMap = await urlMapForDesign(activeDesign, photos, venue);
    siteHtml = resolveHtml(activeDesign.html, urlMap);
    htmlFamilies = familiesInHtml(activeDesign.html, SITE_FONTS.map((f) => f.family));
  }

  // Token-renderer fallback: signed URLs for photos the design references.
  const referenced = new Set([design.images.heroPhotoId, ...design.images.galleryPhotoIds].filter(Boolean));
  const photoUrls: Record<string, string> = {};
  if (!siteHtml) {
    await Promise.all(
      photos
        .filter((p) => referenced.has(p.id))
        .map(async (p) => {
          const { data } = await admin.storage.from("site-photos").createSignedUrl(p.storage_path, 3600);
          if (data?.signedUrl) photoUrls[p.id] = data.signedUrl;
        })
    );
  }

  // Password gate: the raw password never leaves the server; we compare the
  // signed cookie against the expected value.
  const rawPassword = typeof site.config?.sitePassword === "string" ? (site.config.sitePassword as string) : "";
  let locked = false;
  if (config.pwProtected && rawPassword) {
    const jar = await cookies();
    locked = jar.get(siteCookieName(slug))?.value !== siteCookieValue(slug, rawPassword);
  }

  // Fonts vary per site, so they resolve at request time — next/font can't.
  const fontIds = siteHtml
    ? SITE_FONTS.filter((f) => htmlFamilies.includes(f.family)).map((f) => f.id)
    : [design.typography.displayFont, design.typography.bodyFont];

  return (
    <>
      {fontIds.length > 0 && <link rel="stylesheet" href={googleFontsHref(fontIds)} />}
      <PublicSite
        slug={slug}
        couple={couple}
        config={config}
        design={design}
        siteHtml={siteHtml}
        photoUrls={photoUrls}
        registryItems={registryItems}
        claimedByItem={claimedByItem}
        lang={lang}
        locked={locked}
        rsvpToken={rsvpToken ?? null}
      />
    </>
  );
}
