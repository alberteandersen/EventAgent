import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { Landing } from "@/components/landing/Landing";
import { JsonLd } from "@/components/guide/JsonLd";
import { pageMetadata } from "@/lib/guide/metadata";
import { graph, organization, softwareApplication, website } from "@/lib/guide/schema";

export const metadata = pageMetadata({
  title: "Kalas: AI wedding planner that finds venues and gets quotes",
  description:
    "Ava, the AI wedding planner in Kalas, finds real venues, writes to them in their own language and turns the replies into quotes you can compare. Free to start.",
  path: "/",
  og: "kalas",
  locale: "en_US",
});

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await getOrCreateProfile(supabase, user.id);
    redirect(profile.onboarded ? "/home" : "/onboarding");
  }

  return (
    <>
      <JsonLd data={graph(organization(), website(), softwareApplication())} />
      <Landing />
    </>
  );
}
