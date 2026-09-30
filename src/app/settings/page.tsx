import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import type { CoupleMember } from "@/components/settings/PlanTogetherSetting";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveEvent } from "@/lib/active-event";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { getPlatformConnection, isPlatformAdmin } from "@/lib/gmail/platform";

export const metadata: Metadata = { title: "Indstillinger · Kalas", robots: { index: false } };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform_connected?: string; gmail_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const profile = await getOrCreateProfile(supabase, user.id);
  const admin = isPlatformAdmin(user.email);
  const platform = admin ? await getPlatformConnection() : null;
  const event = await getActiveEvent(supabase, user.id);

  /* Who is on this wedding, by name. Profiles only answer to their owner, so
     the other half's name is read with the service role, and only for people
     who share this wedding with the signed-in user. Before migration 0036 the
     members table does not exist; the couple is then just this user. */
  let members: CoupleMember[] = [{ name: profile.display_name ?? "", you: true }];
  let pendingEmail: string | null = null;
  if (event) {
    const admin = createAdminClient();
    const { data: memberRows, error: membersError } = await admin
      .from("event_members").select("user_id").eq("event_id", event.id);
    const ids = membersError ? [] : ((memberRows as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
    if (ids.includes(user.id)) {
      const { data: names } = await admin.from("profiles").select("user_id, display_name").in("user_id", ids);
      const byId = new Map(((names as { user_id: string; display_name: string | null }[] | null) ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      members = ids.map((id) => ({ name: byId.get(id) ?? "", you: id === user.id }));
    }
    const { data: invite } = await supabase
      .from("partner_invites").select("email, status").eq("user_id", user.id)
      .in("status", ["sent", "opened"]).order("sent_at", { ascending: false }).limit(1).maybeSingle();
    pendingEmail = (invite as { email: string } | null)?.email ?? null;
  }

  return (
    <SettingsScreen
      lang={profile.language ?? "da"}
      email={user.email ?? null}
      notifications={profile.email_notifications ?? true}
      wedding={event ? {
        eventId: event.id,
        name: profile.display_name ?? "",
        partner: profile.partner_name ?? "",
        eventDate: event.event_date,
        datePrecision: event.date_precision,
        dateHint: event.date_hint,
        location: event.location,
        guestCount: event.guest_count,
        budget: event.budget,
      } : null}
      members={members}
      pendingEmail={pendingEmail}
      platform={admin && platform ? { connected: platform.connected, email: platform.email ?? null } : null}
      flash={{ connected: Boolean(params.platform_connected), gmailError: params.gmail_error }}
    />
  );
}
