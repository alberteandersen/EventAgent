import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE, acceptPartnerInvite } from "@/lib/invites/accept";

/**
 * GET /invite/<token> — where the link in Juno's partner invitation lands.
 *
 * Signed in: join the wedding and go to it. Not signed in: remember the token
 * in a short-lived cookie and go to login; once they are in, the proxy sends
 * them back here, whichever way they signed in, and they join then.
 *
 * Service role by necessity: the recipient is not the inviter, and the RLS
 * policy on partner_invites answers to the inviter.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = request.nextUrl.origin;
  const admin = createAdminClient();

  const { data } = await admin.from("partner_invites").select("id, status").eq("token", token).maybeSingle();
  if (data && data.status === "sent") {
    await admin.from("partner_invites").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", data.id);
  }

  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) {
    // An unknown token still goes to signup: saying "no such invite" to an
    // anonymous visitor only confirms which tokens are live.
    const res = NextResponse.redirect(`${origin}/login?invited=1`);
    if (data) {
      res.cookies.set(INVITE_COOKIE, token, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  }

  const joined = await acceptPartnerInvite(admin, user.id, token);
  const res = NextResponse.redirect(`${origin}${joined ? "/home?joined=1" : "/home"}`);
  res.cookies.delete(INVITE_COOKIE);
  return res;
}
