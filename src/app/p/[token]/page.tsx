import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { coupleNames, publicCouple, siteLanguage } from "@/lib/website/publicCouple";
import { parseSiteDesign } from "@/kalas/site/design";
import { translate } from "@/kalas/i18n";
import type { DayProgramItemRow, EventRow, ProfileRow, SitePhotoRow, WebsiteDesignRow } from "@/lib/db/types";
import { PublicProgram } from "./PublicProgram";

export const dynamic = "force-dynamic";

/* The wedding day's programme, for the people who run it. Reached only by a
   token the couple hands out, so it is never indexed, and it shows the day
   and nothing else: no guest list, no budget, no address beyond what the
   couple wrote into a moment themselves. */
const ROBOTS = { index: false, follow: false, nocache: true } as const;

async function load(token: string) {
  // A token is 32 url-safe characters; anything else is not worth a query.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: eventRow } = await admin.from("events").select("*").eq("program_share_token", token).maybeSingle();
  const event = eventRow as EventRow | null;
  if (!event) return null;
  const [{ data: profileRow }, { data: itemRows }, { data: designRow }, { data: photoRows }] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", event.user_id).maybeSingle(),
    admin.from("day_program_items").select("*").eq("event_id", event.id),
    admin.from("website_designs").select("*").eq("event_id", event.id).eq("active", true).maybeSingle(),
    admin.from("site_photos").select("*").eq("event_id", event.id).order("sort"),
  ]);
  const profile = (profileRow as ProfileRow | null) ?? null;

  // The couple's own cover photo when their site has one; the page works
  // without it, on the Kalas ground.
  let photoUrl: string | null = null;
  const photos = (photoRows as SitePhotoRow[] | null) ?? [];
  const heroId = designRow ? parseSiteDesign((designRow as WebsiteDesignRow).design).images.heroPhotoId : "";
  const hero = photos.find((p) => p.id === heroId) ?? photos[0];
  if (hero) {
    const { data } = await admin.storage.from("site-photos").createSignedUrl(hero.storage_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return {
    event,
    profile,
    items: (itemRows as DayProgramItemRow[] | null) ?? [],
    photoUrl,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data) return { robots: ROBOTS, title: "Kalas" };
  const lang = siteLanguage(data.profile);
  const names = coupleNames(publicCouple(data.event, data.profile));
  const title = names
    ? translate(lang, "Program for {names}s bryllup", { names })
    : translate(lang, "Bryllupsdagen");
  return { robots: ROBOTS, title };
}

export default async function SharedProgramPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  const couple = publicCouple(data.event, data.profile);
  return (
    <PublicProgram
      lang={siteLanguage(data.profile)}
      names={coupleNames(couple)}
      dateISO={couple.dateISO}
      dateLabel={couple.dateLabel}
      items={data.items.map(({ id, time, title, subtitle, duration_min, owner, notes }) => ({
        id, time, title, subtitle, duration_min, owner, notes,
      }))}
      photoUrl={data.photoUrl}
    />
  );
}
