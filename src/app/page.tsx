import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { Landing } from "@/components/landing/Landing";
import { JsonLd } from "@/components/guide/JsonLd";
import { pageMetadata } from "@/lib/guide/metadata";
import { graph, organization, softwareApplication, website } from "@/lib/guide/schema";

export const metadata = pageMetadata({
  title: "Kalas: Juno, jeres bryllupskoordinator",
  description:
    "Juno finder rigtige steder til jeres bryllup, skriver til dem på deres eget sprog og gør svarene til tilbud, I kan sammenligne. Hun holder styr på gæster, budget og bordplan. Gratis at komme i gang.",
  path: "/",
  og: "kalas",
  locale: "da_DK",
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
