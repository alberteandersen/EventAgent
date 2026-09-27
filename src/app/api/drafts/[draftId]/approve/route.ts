import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GmailNotConnectedError } from "@/lib/gmail/oauth";
import { getPlatformAccessToken, getPlatformEmail } from "@/lib/gmail/platform";
import { uncontactedVenues } from "@/lib/outreach/sendDraft";
import { dispatchJob } from "@/lib/jobs/dispatch";
import type { EmailDraftRow } from "@/lib/db/types";

export const maxDuration = 300; // compose + send per vendor, sequentially

/**
 * POST /api/drafts/[draftId]/approve — approve the master draft, then compose
 * and send an individual email to every liked vendor in the draft's category,
 * from the platform Kalas mailbox. The checks run here; the sending is
 * src/lib/outreach/sendDraft.ts, a background job in production because it
 * goes one vendor at a time (202 { jobId } then, see src/lib/jobs).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await params;
  const { data: draftData } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", draftId)
    .single();
  const draft = draftData as EmailDraftRow | null;
  if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "proposed") {
    return Response.json({ error: `Draft already ${draft.status}` }, { status: 409 });
  }

  // RLS-scoped: the draft is theirs, so its event is too.
  const venues = await uncontactedVenues(supabase, draft);
  if (venues.length === 0) {
    return Response.json(
      { error: `No uncontacted liked ${draft.category}s to reach out to` },
      { status: 400 }
    );
  }

  // Verify the platform mailbox before marking anything approved.
  try {
    await getPlatformAccessToken();
    await getPlatformEmail();
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return Response.json(
        {
          error: "outreach_unavailable",
          message: "Ava's outreach mailbox is being set up, try again shortly.",
        },
        { status: 503 }
      );
    }
    throw err;
  }

  await supabase.from("email_drafts").update({ status: "approved" }).eq("id", draftId);
  await supabase.from("events").update({ status: "sending" }).eq("id", draft.event_id);

  return dispatchJob(request, "outreach.send", {
    eventId: draft.event_id,
    userId: user.id,
    payload: { draftId },
  });
}
