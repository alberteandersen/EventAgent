import type { SupabaseClient } from "@supabase/supabase-js";

/* Turning a partner invitation into a shared wedding.
 *
 * The token in the link is the whole of the access, as it was when the
 * invitation only led to signup (0024): whoever holds it and signs in joins
 * the wedding it was sent from. Deliberately not tied to the address it was
 * mailed to, since people sign in with whichever Google account is to hand.
 */

export const INVITE_COOKIE = "kalas_partner_invite";

type Invite = { id: string; user_id: string; event_id: string | null; status: string };

export type AcceptDecision =
  | { kind: "join" }
  /** The inviter opened their own link: nothing to join. */
  | { kind: "own" }
  /** Revoked, or accepted by someone else. */
  | { kind: "spent" };

export function acceptDecision(invite: Invite, userId: string, acceptedBy: string | null): AcceptDecision {
  if (invite.user_id === userId) return { kind: "own" };
  if (invite.status === "revoked") return { kind: "spent" };
  if (invite.status === "accepted" && acceptedBy !== userId) return { kind: "spent" };
  return { kind: "join" };
}

/**
 * Accept the invitation behind `token` for `userId`, with the service role.
 * Resolves to the wedding they joined, or null when there was nothing to
 * join. Never throws for a bad token: the caller only needs to know where to
 * send the person next.
 */
export async function acceptPartnerInvite(
  admin: SupabaseClient,
  userId: string,
  token: string,
): Promise<string | null> {
  const { data } = await admin
    .from("partner_invites")
    .select("id, user_id, event_id, status, accepted_by")
    .eq("token", token)
    .maybeSingle();
  const invite = data as (Invite & { accepted_by: string | null }) | null;
  if (!invite || acceptDecision(invite, userId, invite.accepted_by).kind !== "join") return null;

  // Invitations sent from onboarding predate the wedding they belong to.
  let eventId = invite.event_id;
  if (!eventId) {
    const { data: inviter } = await admin
      .from("profiles").select("active_event_id").eq("user_id", invite.user_id).maybeSingle();
    eventId = (inviter as { active_event_id: string | null } | null)?.active_event_id ?? null;
  }
  if (!eventId) {
    const { data: latest } = await admin
      .from("events").select("id").eq("user_id", invite.user_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    eventId = (latest as { id: string } | null)?.id ?? null;
  }
  if (!eventId) return null;

  const { error: memberError } = await admin
    .from("event_members")
    .upsert({ event_id: eventId, user_id: userId, role: "partner" }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  // Without the membership, pointing their profile at the wedding would only
  // show them an empty one. Leave everything as it was.
  if (memberError) {
    console.error("acceptPartnerInvite: membership not written", memberError.message);
    return null;
  }

  const [{ data: inviterProfile }, { data: ownProfile }] = await Promise.all([
    admin.from("profiles").select("display_name, partner_name").eq("user_id", invite.user_id).maybeSingle(),
    admin.from("profiles").select("display_name, partner_name").eq("user_id", userId).maybeSingle(),
  ]);
  const inviter = inviterProfile as { display_name: string | null; partner_name: string | null } | null;
  const own = ownProfile as { display_name: string | null; partner_name: string | null } | null;

  await Promise.all([
    admin.from("partner_invites").update({
      status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString(), event_id: eventId,
    }).eq("id", invite.id),
    // They join a wedding that is already set up, so the interview is skipped,
    // and the names are the inviter's pair seen from the other side.
    admin.from("profiles").upsert({
      user_id: userId,
      active_event_id: eventId,
      onboarded: true,
      display_name: own?.display_name || inviter?.partner_name || null,
      partner_name: own?.partner_name || inviter?.display_name || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }),
  ]);

  return eventId;
}
