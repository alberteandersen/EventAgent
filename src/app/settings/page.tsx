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
    <main className="theme-kalas min-h-screen w-full bg-canvas font-sans text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.6px] text-[var(--color-ink)]">
          Settings
        </h1>
        <Link href="/home" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← Back home
        </Link>
      </div>

      {params.platform_connected && (
        <div className="mb-6 rounded-xl border border-[var(--color-sage-tint)] bg-[var(--color-sage-tint)] px-4 py-3 text-sm text-[var(--color-success)]">
          Kalas outreach mailbox connected successfully.
        </div>
      )}
      {params.gmail_error && (
        <div className="mb-6 rounded-xl border border-[var(--color-terracotta-tint)] bg-[var(--color-terracotta-tint)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
          Mailbox connection failed ({params.gmail_error}). Please try again.
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
        <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
          Vendor outreach
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Ava contacts venues and vendors from her own Kalas mailbox, nothing is
          sent from your personal email. Every conversation shows up in your
          outreach inbox, and you approve each reply before it goes out.
        </p>
      </section>

      {admin && platform && (
        <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
          <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
            Kalas outreach mailbox
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Admin only, the platform Gmail account Ava sends from and reads replies in.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3">
            {platform.connected ? (
              <>
                <div className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-ink)]" />
                  Connected{platform.email ? ` as ${platform.email}` : ""}
                </div>
                <a
                  href="/api/admin/gmail/connect"
                  className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-shell)]"
                >
                  Reconnect
                </a>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-line-strong)]" />
                  Not connected
                </div>
                <a
                  href="/api/admin/gmail/connect"
                  className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-card)] hover:opacity-90"
                >
                  Connect mailbox
                </a>
              </>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
              Language
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The language of the app and of Ava's replies. Takes effect across Kalas.
            </p>
          </div>
          <LanguageSetting initial={profile.language ?? "da"} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
              Onboarding
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Run the wedding interview again to update names, destination, date, and style.
            </p>
          </div>
          <RedoOnboardingButton />
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-[var(--color-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
              Guided tour
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Ava walks you through each page again. Nothing is reset.
            </p>
          </div>
          <Link
            href="/home?walkthrough=1"
            className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-center text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-shell)]"
          >
            Show me around again
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
        <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)]">
          Account
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Signed in as {user.email}</p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>
      </div>
    </main>
  );
}
