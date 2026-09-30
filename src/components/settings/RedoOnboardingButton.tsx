"use client";

import { useState } from "react";
import { useLang } from "@/kalas/i18n";
import { Button, useConfirm } from "@/kalas/ui";

/** Resets profile.onboarded so the wedding interview can be run again. */
export function RedoOnboardingButton() {
  const { t } = useLang();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const redo = async () => {
    const ok = await confirm({
      title: t("Start onboarding forfra?"),
      body: t("Jeres bryllup bliver gemt. Når I er igennem interviewet, laver Kalas en ny plan ud fra det."),
      confirmLabel: t("Start forfra"),
    });
    if (!ok) return;

    setLoading(true);
    setFailed(false);
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
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button variant="secondary" onClick={redo} disabled={loading}>
        {loading ? t("Åbner…") : t("Start onboarding forfra")}
      </Button>
      {failed && <p role="alert" className="text-xs text-terracotta">{t("Noget gik galt, prøv igen.")}</p>}
    </div>
  );
}
