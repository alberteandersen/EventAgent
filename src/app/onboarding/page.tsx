import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { KalasOnboardingClient } from "@/components/kalas/KalasOnboardingClient";

export const metadata: Metadata = { title: "Kom i gang · Kalas", robots: { index: false } };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(supabase, user.id);
  if (profile.onboarded) redirect("/home");

  return <KalasOnboardingClient initialLang={profile.language ?? "da"} />;
}
