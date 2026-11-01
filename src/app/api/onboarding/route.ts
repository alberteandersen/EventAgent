import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_BANDS, weddingTitle, type OnboardingDate } from "@/lib/onboarding";
import { countryLabel, globeCountry } from "@/kalas/onboarding/countries";

interface OnboardingBody {
  name?: string;
  partner_name?: string | null;
  city?: string;
  date?: OnboardingDate;
  /** Direct guest count (Kalas interview) — takes precedence over guest_band. */
  guest_count?: number | null;
  guest_band?: string | null;
  budget?: string | null;
  vibes?: string[];
  /** "City, Country" places hearted on the old onboarding globe. */
  loved_destinations?: string[];
  /** Free-text dream description (Kalas interview) → requirements. */
  description?: string | null;
  /** Co-planner email (Kalas interview) → requirements. */
  partner_email?: string | null;
  /** UI + assistant language chosen during onboarding. */
  language?: string;
}

/**
 * POST /api/onboarding — complete onboarding in one shot:
 * seed the wedding event, drop a welcome message into its chat, and mark
 * the profile onboarded with the event as its active wedding.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as OnboardingBody;
  const name = (body.name ?? "").trim();
  const partner = (body.partner_name ?? "").trim() || null;
  // Empty when they chose "we're not sure yet" on the where step.
  const city = (body.city ?? "").trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const band = GUEST_BANDS.find((b) => b.key === body.guest_band);
  const guestCount =
    typeof body.guest_count === "number" && body.guest_count > 0
      ? Math.round(body.guest_count)
      : band?.count ?? null;
  const vibes = (body.vibes ?? []).filter((v) => typeof v === "string").slice(0, 12);
  const lovedDestinations = (body.loved_destinations ?? [])
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim().slice(0, 80))
    .slice(0, 20);
  const date = body.date ?? { precision: "undecided" as const };
  const description = (body.description ?? "").trim();
  const partnerEmail = (body.partner_email ?? "").trim();
  const language = body.language === "en" ? "en" : "da";

  const requirements: Record<string, unknown> = {};
  if (vibes.length > 0) requirements.vibes = vibes;
  if (lovedDestinations.length > 0) requirements.loved_destinations = lovedDestinations;
  if (band) requirements.guest_band = band.label;
  if (description) requirements.description = description;
  if (partnerEmail) requirements.partner_email = partnerEmail;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      user_id: user.id,
      title: weddingTitle(name, partner),
      event_type: "wedding",
      location: city || null,
      guest_count: guestCount,
      event_date: date.precision === "exact" ? date.iso ?? null : null,
      date_precision: date.precision,
      date_hint: date.precision === "season" ? date.hint ?? null : null,
      budget: (body.budget ?? "").trim() || null,
      requirements,
    })
    .select()
    .single();
  if (eventError || !event) {
    return Response.json(
      { error: eventError?.message ?? "Could not create wedding" },
      { status: 500 }
    );
  }

  // Welcome so Juno's chat opens mid-conversation, matching the app language.
  const firstName = name.split(" ")[0];
  const partnerFirst = partner ? partner.split(" ")[0] : null;
  const names = `${firstName}${partnerFirst ? ` & ${partnerFirst}` : ""}`;
  const dateKnown = date.precision === "exact" ? date.iso : date.hint;
  const styleHint = description
    ? language === "en"
      ? `your style: "${description.slice(0, 80)}"`
      : `jeres stil: "${description.slice(0, 80)}"`
    : null;
  /* The first thing the couple ever reads from Juno. It used to be one long
     run-on sentence with their answers comma-joined into the middle of it —
     written out as a short greeting, a bulleted read-back they can check at a
     glance, and one question. RichText in the chat renders the bullets. */
  /* One place ("Tuscany, Italy") or, when they are still choosing between
     countries, the list of them. Country names go out in the couple's
     language; a town is theirs as typed. */
  const inTheirLanguage = (p: string) =>
    p.split(",").map((part) => {
      const country = globeCountry(part);
      return country ? countryLabel(country, language) : part.trim();
    }).join(", ");
  const places = (lovedDestinations.length > 1 ? lovedDestinations : city ? [city] : []).map(inTheirLanguage);
  const place =
    places.length > 1
      ? `${places.slice(0, -1).join(", ")} ${language === "en" ? "or" : "eller"} ${places[places.length - 1]}`
      : places[0] ?? null;
  const facts = [
    place,
    dateKnown,
    guestCount
      ? language === "en"
        ? `around ${guestCount} guests`
        : `omkring ${guestCount} gæster`
      : null,
    styleHint,
  ].filter(Boolean);
  const bullets = facts.map((f) => `- ${f}`).join("\n");

  // The venue is the natural first move once they know where; when they
  // don't yet, the place itself is.
  const closing =
    language === "en"
      ? place
        ? `The venue anchors everything else — flowers, music and catering are all local to it, so it's the first thing worth locking down.

Shall I start researching venues in ${place}?`
        : `Where you'll marry is still open, and that's fine. It's the choice everything else hangs on, so it's a good one to settle first.

Shall I suggest a few places that suit your date and guest count?`
      : place
        ? `Venuet forankrer alt det andet — blomster, musik og catering er alle lokale til det, så det er det første, der er værd at få på plads.

Skal jeg begynde at researche venues i ${place}?`
        : `Hvor I skal giftes er stadig åbent, og det er helt fint. Det er det valg, alt det andet hænger på, så det er et godt sted at starte.

Skal jeg foreslå et par steder, der passer til jeres dato og antal gæster?`;

  const welcome =
    language === "en"
      ? `Hi ${names}! I'm Juno, your wedding planner.

Here's what I have so far:

${bullets}

${closing}`
      : `Hej ${names}! Jeg er Juno, jeres bryllupsplanlægger.

Her er hvad jeg har indtil videre:

${bullets}

${closing}`;

  await supabase.from("chat_messages").insert({
    event_id: event.id,
    user_id: user.id,
    role: "assistant",
    content: welcome,
  });

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: name,
      partner_name: partner,
      home_city: city || null,
      active_event_id: event.id,
      onboarded: true,
      language,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  return Response.json({ eventId: event.id });
}
