"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguageProvider, useLang } from "@/kalas/i18n";
import { Button, Card, Field, Wordmark, cn, inputClass } from "@/kalas/ui";
import { PRIVACY_POLICY_LIVE } from "@/lib/legal";

type Mode = "sign-in" | "sign-up";

/** A Supabase auth error, said the way a couple needs to hear it. */
function authError(message: string, t: (s: string) => string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit")) return t("Der er sendt for mange mails på kort tid. Vent lidt, eller log ind med Google.");
  if (m.includes("email not confirmed")) return t("Bekræft din e-mail først. Tjek indbakken, og spam.");
  if (m.includes("invalid login credentials")) return t("Forkert e-mail eller adgangskode.");
  if (m.includes("already registered")) return t("Der findes allerede en konto med den e-mail. Log ind i stedet.");
  return t("Det gik ikke. Prøv igen.");
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <Login />
    </LanguageProvider>
  );
}

function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL on arrival
    if (params.get("error") === "auth_failed") setError(t("Login mislykkedes. Prøv igen."));
  }, [t]);

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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(authError(oauthError.message, t));
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (signUpError) { setError(authError(signUpError.message, t)); return; }
      if (data.session) { router.push("/"); router.refresh(); return; }
      setMessage(t("Tjek din mail for et link, der bekræfter kontoen, og log så ind."));
      setMode("sign-in");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) { setError(authError(signInError.message, t)); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="theme-kalas flex min-h-screen flex-1 flex-col bg-canvas font-sans text-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6">
        <Link href="/" aria-label="Kalas"><Wordmark /></Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <Card className="w-full max-w-sm p-8 sm:p-10">
          <h1 className="text-center font-serif text-page tracking-[-0.02em] text-ink">
            {mode === "sign-in" ? t("Log ind") : t("Opret en konto")}
          </h1>
          <p className="mt-3 text-center text-meta text-muted">
            {t("Planlæg brylluppet med Juno: find steder, hold styr på gæsterne, og få tilbud fra leverandørerne.")}
          </p>

          <div role="group" className="mt-6 flex rounded-full border border-line p-0.5">
            {(["sign-in", "sign-up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 cursor-pointer rounded-full py-1.5 text-meta font-semibold transition-colors",
                  mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink",
                )}
              >
                {m === "sign-in" ? t("Log ind") : t("Opret konto")}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="mt-6 flex flex-col gap-3">
            <Field label={t("E-mail")}>
              <input type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("Adgangskode")} hint={mode === "sign-up" ? t("Mindst 6 tegn.") : undefined}>
              <input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </Field>

            {error && <p role="alert" className="rounded-xl bg-terracotta-wash px-3 py-2 text-sm text-terracotta">{error}</p>}
            {message && <p role="status" className="rounded-xl bg-sage-wash px-3 py-2 text-sm text-success">{message}</p>}

            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading
                ? mode === "sign-up" ? t("Opretter kontoen…") : t("Logger ind…")
                : mode === "sign-up" ? t("Opret konto") : t("Log ind")}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">{t("eller")}</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <Button variant="secondary" onClick={signInWithGoogle} disabled={googleLoading} className="w-full">
            {googleLoading ? t("Sender dig videre…") : t("Fortsæt med Google")}
          </Button>

          {PRIVACY_POLICY_LIVE && (
            <p className="mt-6 text-center text-xs text-muted">
              <Link href="/privatliv" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
                {t("Sådan behandler vi jeres oplysninger")}
              </Link>
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
