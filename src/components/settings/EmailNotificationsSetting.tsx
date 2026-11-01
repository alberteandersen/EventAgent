"use client";

import { useState } from "react";
import { useLang } from "@/kalas/i18n";
import { Toggle } from "@/kalas/ui";

/** Whether Juno mails this person when a vendor replies. Saves on flip and
    flips back if the save fails, so the switch never shows a setting the
    server does not have. */
export function EmailNotificationsSetting({ initial }: { initial: boolean }) {
  const { t } = useLang();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  const change = async (next: boolean) => {
    if (saving) return;
    setOn(next);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_notifications: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setOn(!next);
    } finally {
      setSaving(false);
    }
  };

  return <Toggle value={on} onChange={change} label={t("Mails om nye svar")} />;
}
