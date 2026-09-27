import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAppLanguage } from "@/lib/db/types";

/** PATCH /api/profile — update the current user's profile (onboarding + edits). */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    display_name?: string;
    partner_name?: string;
    home_city?: string;
    event_interests?: string[];
    accent?: string;
    onboarded?: boolean;
    language?: string;
    email_notifications?: boolean;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.display_name === "string") patch.display_name = body.display_name.trim() || null;
  if (typeof body.partner_name === "string") patch.partner_name = body.partner_name.trim() || null;
  if (typeof body.home_city === "string") patch.home_city = body.home_city.trim() || null;
  if (Array.isArray(body.event_interests)) patch.event_interests = body.event_interests.slice(0, 12);
  if (typeof body.accent === "string") patch.accent = body.accent.slice(0, 8);
  if (typeof body.onboarded === "boolean") patch.onboarded = body.onboarded;
  if (isAppLanguage(body.language)) patch.language = body.language;
  if (typeof body.email_notifications === "boolean") patch.email_notifications = body.email_notifications;

  // Upsert so the row exists even if the signup trigger didn't run.
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data);
}
