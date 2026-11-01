import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GmailNotConnectedError } from "@/lib/gmail/oauth";
import { getPlatformAccessToken, getPlatformEmail } from "@/lib/gmail/platform";
import { sendEmail } from "@/lib/gmail/send";
import {
  buildPartnerInvite,
  generateInviteToken,
  inviteUrl,
  isPlausibleEmail,
} from "@/lib/invites/partner";
import type { ProfileRow } from "@/lib/db/types";

/**
 * POST /api/partner/invite — email the other half of the couple from Juno's
 * mailbox. Body: { email, inviter_name?, partner_name?, language? }.
 *
 * Called from the last onboarding step, which runs before the event exists, so
 * the invite is minted against the user and adopted by the event later. Names
 * come from the request because the form holds them before anything is
 * persisted; the profile is the fallback for a resend from elsewhere.
 *
 * Re-inviting the same address updates the row and mints a fresh token, so an
 * older link stops working — the natural reading of "send it again".
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    inviter_name?: string;
    partner_name?: string;
    language?: string;
  };

  // Lowercased so the (user_id, email) unique index de-duplicates resends that
  // differ only in case, the way the recipient's mail server would.
  const email = (body.email ?? "").trim().toLowerCase();
  if (!isPlausibleEmail(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  if (email === (user.email ?? "").toLowerCase()) {
    return Response.json({ error: "own_address" }, { status: 400 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;

  const lang = (body.language ?? profile?.language) === "en" ? "en" : "da";
  const inviterName = (body.inviter_name ?? profile?.display_name ?? "").trim();
  const partnerName = (body.partner_name ?? profile?.partner_name ?? "").trim();

  // Juno's mailbox first: no point writing a row for a mail that cannot go out.
  let accessToken: string;
  let platformEmail: string | null;
  try {
    accessToken = await getPlatformAccessToken();
    platformEmail = await getPlatformEmail();
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return Response.json(
        { error: "mailbox_unavailable", message: "Juno's mailbox is unavailable, try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }

  const token = generateInviteToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const message = buildPartnerInvite({
    inviterName,
    partnerName,
    url: inviteUrl(appUrl, token),
    lang,
  });

  // Service-role for the upsert: an RLS-bound insert that collides with an
  // existing row cannot see the row it conflicts with, so the resend fails
  // instead of refreshing. The user_id written is the authenticated one.
  const admin = createAdminClient();
  const { data: inviteData, error: inviteError } = await admin
    .from("partner_invites")
    .upsert(
      {
        user_id: user.id,
        event_id: profile?.active_event_id ?? null,
        email,
        token,
        status: "sent",
        accepted_by: null,
        accepted_at: null,
        opened_at: null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email" },
    )
    .select("id")
    .maybeSingle();

  if (inviteError || !inviteData) {
    return Response.json({ error: "invite_not_saved" }, { status: 500 });
  }

  try {
    await sendEmail(accessToken, {
      to: email,
      subject: message.subject,
      body: message.body,
      fromName: "Juno at Kalas",
      fromEmail: platformEmail ?? undefined,
    });
  } catch (err) {
    // The row would otherwise claim an invitation that never left the building.
    await admin.from("partner_invites").delete().eq("id", inviteData.id);
    console.error("partner invite send failed", err);
    return Response.json(
      { error: "send_failed", message: "The invitation could not be sent, try again shortly." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, email });
}
