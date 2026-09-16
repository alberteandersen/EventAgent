import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DatePrecision } from "@/lib/db/types";
import { eventDetailsPatch } from "@/lib/wedding-details";

const DATE_PRECISIONS: DatePrecision[] = ["exact", "month", "season", "undecided"];

/**
 * PATCH /api/events/[eventId] — journey facts (choose venue, set date, manual
 * stage overrides) and the wedding details Settings edits: place, guest count,
 * budget, a rough date, and the names the title is built from. Everything else
 * goes through the chat agent.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    chosen_venue_id?: string | null;
    journey_overrides?: Record<string, string>;
    event_date?: string | null;
    date_precision?: DatePrecision;
  } & Record<string, unknown>;

  const details = eventDetailsPatch(body);
  if (details.error) return Response.json({ error: details.error }, { status: 400 });
  const patch: Record<string, unknown> = { ...details.patch };

  if (body.chosen_venue_id !== undefined) {
    if (body.chosen_venue_id !== null) {
      // The venue must belong to this event (RLS already scopes to the user).
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("id", body.chosen_venue_id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (!venue) {
        return Response.json({ error: "Venue not found on this event" }, { status: 400 });
      }
    }
    patch.chosen_venue_id = body.chosen_venue_id;
  }

  if (body.journey_overrides && typeof body.journey_overrides === "object") {
    const { data: current } = await supabase
      .from("events")
      .select("journey_overrides")
      .eq("id", eventId)
      .maybeSingle();
    patch.journey_overrides = {
      ...((current?.journey_overrides as Record<string, string>) ?? {}),
      ...body.journey_overrides,
    };
  }

  if (body.event_date !== undefined) {
    if (body.event_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.event_date))) {
      return Response.json({ error: "event_date must be YYYY-MM-DD" }, { status: 400 });
    }
    patch.event_date = body.event_date;
  }
  if (body.date_precision && DATE_PRECISIONS.includes(body.date_precision)) {
    patch.date_precision = body.date_precision;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data);
}
