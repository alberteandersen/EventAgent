"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "sign-up") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setLoading(false);
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("email rate limit exceeded")) {
          setError(
            "Too many sign-up emails sent. Supabase's default mailer allows about 2 per hour for the whole project. " +
              "Wait ~1 hour, use Continue with Google, or disable “Confirm email” in Supabase for local dev."
          );
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setMessage("Check your email for a confirmation link, then sign in.");
      setMode("sign-in");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("email rate limit exceeded")) {
        setError(
          "Supabase's built-in email limit was hit (about 2 confirmation emails per hour for the whole project). " +
            "Password sign-in does not send email, if you were creating an account, wait an hour or use Google. " +
            "For dev, turn off “Confirm email” in Supabase → Authentication → Providers → Email."
        );
      } else if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setError(
          "Confirm your email first (check inbox/spam), or ask an admin to confirm your user in Supabase Auth."
        );
      } else {
        setError(signInError.message);
      }
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="theme-kalas flex min-h-screen flex-1 flex-col bg-canvas font-sans text-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6">
        <Link
          href="/"
          className="font-serif text-[22px] font-semibold tracking-[-0.55px] text-[var(--color-ink)]"
        >
          kalas
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] p-10 shadow-[0px_8px_30px_rgba(74,78,60,0.06)]">
          <p className="text-center text-[11px] font-medium uppercase tracking-[1.1px] text-[var(--color-ink)]">
            Welcome
          </p>
          <h1 className="mt-4 text-center font-serif text-2xl font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            {mode === "sign-in" ? "Sign in to Kalas" : "Create your account"}
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-[var(--color-muted)]">
            Plan your wedding with Ava, find venues, manage guests, and send
            quote requests.
          </p>

          <div className="mt-6 flex rounded-xl border border-[var(--color-line)] p-1">
            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === "sign-in"
                  ? "bg-[var(--color-ink)] text-[var(--color-card)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("sign-up")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === "sign-up"
                  ? "bg-[var(--color-ink)] text-[var(--color-card)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="mt-6 space-y-3">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-[var(--color-line)] bg-white/60 px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[#8a8568] focus:border-[var(--color-ink)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "sign-up" ? "Password (min. 6 characters)" : "Password"}
                className="w-full rounded-xl border border-[var(--color-line)] bg-white/60 px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[#8a8568] focus:border-[var(--color-ink)] focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-[#f5e8e8] px-3 py-2 text-sm text-[#8b3a3a]" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-[#e8f0e8] px-3 py-2 text-sm text-[#3a5c3a]" role="status">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-card)] shadow-[0px_3px_10px_rgba(74,78,60,0.3)] transition hover:bg-[#575B47] disabled:opacity-50"
            >
              {loading
                ? mode === "sign-up"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "sign-up"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-line)]" />
            <span className="text-xs uppercase tracking-[0.12em] text-[#8a8568]">or</span>
            <div className="h-px flex-1 bg-[var(--color-line)]" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="w-full rounded-xl border border-[var(--color-line)] bg-white/60 px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-white disabled:opacity-50"
          >
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
        </div>
      </div>
    </main>
  );
}
