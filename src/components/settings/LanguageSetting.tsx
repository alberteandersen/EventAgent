"use client";

import { useState } from "react";
import { LANGUAGES, persistLanguage } from "@/kalas/i18n";
import { cn } from "@/kalas/ui";
import type { AppLanguage } from "@/lib/db/types";

/** Language toggle. Persists to localStorage + profile; the app follows on
    its next load. Driven by the i18n LANGUAGES registry, so it grows with
    new languages. */
export function LanguageSetting({ initial }: { initial: AppLanguage }) {
  const [lang, setLang] = useState<AppLanguage>(initial);
  const choose = (l: AppLanguage) => { setLang(l); persistLanguage(l); };

  return (
    <div role="group" className="inline-flex items-center rounded-full border border-line p-0.5">
      {LANGUAGES.map(({ code, label }) => (
        <button key={code} type="button" onClick={() => choose(code)} aria-pressed={lang === code}
          className={cn(
            "cursor-pointer rounded-full px-4 py-1.5 text-meta font-semibold transition-colors",
            lang === code ? "bg-ink text-paper" : "text-muted hover:text-ink",
          )}>
          {label}
        </button>
      ))}
    </div>
  );
}
