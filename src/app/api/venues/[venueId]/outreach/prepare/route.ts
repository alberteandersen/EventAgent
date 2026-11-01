import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { composeOutreachEmail, findVenueEmail } from "@/lib/gemini/agent";
import { resolveBriefForVendor } from "@/lib/outreach/brief";
import { ensureVendorEmail, loadVendorOutreach } from "@/lib/outreach/vendor";

export const maxDuration = 60; // email lookup + one compose

/**
 * POST /api/venues/[venueId]/outreach/prepare — compose (but do not send)
 * the outreach email for ONE vendor, in that vendor's own language, so the
 * couple can read and edit it before it goes out. Nothing is persisted here
 * except a contact address discovered along the way.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { venueId } = await params;
  const { ctx, block } = await loadVendorOutreach(supabase, venueId);
  if (block) return Response.json(block.payload, { status: block.status });

  const toEmail = await ensureVendorEmail(supabase, ctx.venue, findVenueEmail);
  if (!toEmail) {
    return Response.json(
      {
        error: "no_contact_email",
        message: `Juno kunne ikke finde en mailadresse til ${ctx.venue.name}. Tilføj den manuelt og prøv igen.`,
      },
      { status: 422 }
    );
  }

  const brief = await resolveBriefForVendor(supabase, ctx.event, ctx.venue.category);
  const composed = await composeOutreachEmail({
    template: brief.body_template,
    subject: brief.subject,
    event: ctx.event,
    venue: ctx.venue,
  });

  return Response.json({
    venueId: ctx.venue.id,
    venueName: ctx.venue.name,
    toEmail,
    subject: composed.subject,
    body: composed.body,
    language: composed.language,
  });
}
