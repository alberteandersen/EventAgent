"use client";

import { useState } from "react";

/** Resets profile.onboarded so the wedding interview can be run again. */
export function RedoOnboardingButton() {
  const [loading, setLoading] = useState(false);

  const redo = async () => {
    const ok = window.confirm(
      "Start onboarding again? Your current wedding stays saved, completing onboarding creates a new wedding plan.",
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarded: false }),
      });
      if (!res.ok) throw new Error("Could not reset onboarding");
      window.location.assign("/onboarding");
    } catch {
      setLoading(false);
      window.alert("Something went wrong. Please try again.");
    }
  };

  return (
    <button
      type="button"
      onClick={redo}
      disabled={loading}
      className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-shell)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Opening…" : "Redo onboarding"}
    </button>
  );
}
