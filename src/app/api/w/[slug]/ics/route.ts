import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig } from "@/kalas/site/config";
import { buildIcs } from "@/lib/ics";
import type { EventRow, ProfileRow, VenueRow, WeddingSiteRow } from "@/lib/db/types";

/**
 * GET /api/w/[slug]/ics — the wedding as a calendar file.
 *
 * Served as a file rather than a data: URI so it works on iOS, where Safari
 * hands text/calendar straight to Calendar.app. Public and unauthenticated,
 * like the site itself: a guest with the link is the intended audience. It
 * carries only what the couple already published on that page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: siteRow } = await admin
    .from("wedding_sites").select("*").ilike("domain", slug).maybeSingle();
  const site = siteRow as WeddingSiteRow | null;
  if (!site || !site.published) {
    return new Response("Not found", { status: 404 });
  }

  const [{ data: eventRow }, { data: profileRow }] = await Promise.all([
    admin.from("events").select("*").eq("id", site.event_id).maybeSingle(),
    admin.from("profiles").select("*").eq("user_id", site.user_id).maybeSingle(),
  ]);
  const event = eventRow as EventRow | null;
  if (!event) return new Response("Not found", { status: 404 });

  // No firm date, nothing to put in a calendar. A "spring 2028" entry would be
  // a lie in a place people trust to be exact.
  if (!event.event_date) {
    return new Response("The wedding has no confirmed date yet", { status: 404 });
  }

  const profile = profileRow as ProfileRow | null;
  const config = parseConfig(site.config);
  const lang = profile?.language === "en" ? "en" : "da";

  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const names = a && b ? `${a} & ${b}` : a || event.title;
  const title = lang === "en" ? `${names}'s wedding` : `${names}s bryllup`;

  // The venue they chose is the address a guest needs; the couple's own
  // location line is the fallback while no venue is booked.
  let location = event.location;
  if (event.chosen_venue_id) {
    const { data: venueRow } = await admin
      .from("venues").select("name, address")
      .eq("id", event.chosen_venue_id).maybeSingle();
    const venue = venueRow as Pick<VenueRow, "name" | "address"> | null;
    if (venue) location = [venue.name, venue.address].filter(Boolean).join(", ");
  }

  /* The programme is the couple's own timing, so the entry starts when the day
     starts. Its last item is a START time though ("Fest, musik & dans 22:00"),
     so ending there would close the entry as the party begins — three hours
     covers the one item that never states an end. buildIcs rolls anything past
     midnight onto the next day. */
  const times = config.program.map((p) => p.time).filter(Boolean).sort();
  const plusThree = (time: string): string | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return null;
    return `${String((Number(m[1]) + 3) % 24).padStart(2, "0")}:${m[2]}`;
  };
  const origin = new URL(_request.url).origin;

  const ics = buildIcs({
    uid: `wedding-${event.id}@kalas`,
    title,
    dateISO: event.event_date,
    startTime: times[0] ?? null,
    endTime: times.length > 1 ? plusThree(times[times.length - 1]) : null,
    location,
    description: config.heroTagline || null,
    url: `${origin}/w/${slug}`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      // The couple can move the date; a stale cached file would be worse than
      // a second request.
      "Cache-Control": "no-store",
    },
  });
}
