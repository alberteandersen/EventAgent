import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSetting } from "@/components/settings/LanguageSetting";
import { RedoOnboardingButton } from "@/components/settings/RedoOnboardingButton";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/db/profile";
import { getPlatformConnection, isPlatformAdmin } from "@/lib/gmail/platform";

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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-[-0.6px] text-[#4A4E3C]">
          Settings
        </h1>
        <Link href="/home" className="text-sm text-[#7A8066] hover:text-[#4A4E3C]">
          ← Back home
        </Link>
      </div>

      {params.platform_connected && (
        <div className="mb-6 rounded-xl border border-[#cdd9cf] bg-[#e3ece8] px-4 py-3 text-sm text-[#4d6b5c]">
          Kalas outreach mailbox connected successfully.
        </div>
      )}
      {params.gmail_error && (
        <div className="mb-6 rounded-xl border border-[#e6c4bc] bg-[#f0e0dc] px-4 py-3 text-sm text-[#a8483a]">
          Mailbox connection failed ({params.gmail_error}). Please try again.
        </div>
      )}

      <section className="rounded-2xl border border-[#D4D6C0] bg-[#F6F0E8] p-6">
        <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
          Vendor outreach
        </h2>
        <p className="mt-1 text-sm text-[#7A8066]">
          Ava contacts venues and vendors from her own Kalas mailbox, nothing is
          sent from your personal email. Every conversation shows up in your
          outreach inbox, and you approve each reply before it goes out.
        </p>
      </section>

      {admin && platform && (
        <section className="mt-6 rounded-2xl border border-[#D4D6C0] bg-[#F6F0E8] p-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
            Kalas outreach mailbox
          </h2>
          <p className="mt-1 text-sm text-[#7A8066]">
            Admin only, the platform Gmail account Ava sends from and reads replies in.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D4D6C0] bg-[#F6F0E8] px-4 py-3">
            {platform.connected ? (
              <>
                <div className="flex items-center gap-2 text-sm text-[#4A4E3C]">
                  <span className="h-2 w-2 rounded-full bg-[#4A4E3C]" />
                  Connected{platform.email ? ` as ${platform.email}` : ""}
                </div>
                <a
                  href="/api/admin/gmail/connect"
                  className="rounded-full border border-[#D4D6C0] px-3 py-1.5 text-xs text-[#656952] hover:bg-[#ddd6c0]"
                >
                  Reconnect
                </a>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-[#8a8568]">
                  <span className="h-2 w-2 rounded-full bg-[#C4C8AE]" />
                  Not connected
                </div>
                <a
                  href="/api/admin/gmail/connect"
                  className="rounded-full bg-[#4A4E3C] px-3 py-1.5 text-xs font-medium text-[#F6F0E8] hover:bg-[#575B47]"
                >
                  Connect mailbox
                </a>
              </>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-[#D4D6C0] bg-[#F6F0E8] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
              Language
            </h2>
            <p className="mt-1 text-sm text-[#7A8066]">
              The language of the app and of Ava's replies. Takes effect across Kalas.
            </p>
          </div>
          <LanguageSetting initial={profile.language ?? "da"} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#D4D6C0] bg-[#F6F0E8] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
              Onboarding
            </h2>
            <p className="mt-1 text-sm text-[#7A8066]">
              Run the wedding interview again to update names, destination, date, and style.
            </p>
          </div>
          <RedoOnboardingButton />
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-[#D4D6C0] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
              Guided tour
            </h2>
            <p className="mt-1 text-sm text-[#7A8066]">
              Ava walks you through each page again. Nothing is reset.
            </p>
          </div>
          <Link
            href="/home?walkthrough=1"
            className="shrink-0 rounded-full border border-[#D4D6C0] px-4 py-2 text-center text-sm font-medium text-[#4A4E3C] transition-colors hover:bg-[#ddd6c0]"
          >
            Show me around again
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#D4D6C0] bg-[#F6F0E8] p-6">
        <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#4A4E3C]">
          Account
        </h2>
        <p className="mt-1 text-sm text-[#7A8066]">Signed in as {user.email}</p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
