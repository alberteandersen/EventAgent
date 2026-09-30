import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { KalasAppClient } from "@/components/kalas/KalasAppClient";

// The shell retitles the tab per page ("Budget · Kalas"); this is the first paint.
export const metadata: Metadata = { title: "Kalas", robots: { index: false } };

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(supabase, user.id);
  if (!profile.onboarded) redirect("/onboarding");

  return <KalasAppClient initialLang={profile.language ?? "da"} />;
}
