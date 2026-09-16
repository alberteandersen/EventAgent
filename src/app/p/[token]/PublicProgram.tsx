"use client";

/* The shared programme itself. A client component for one reason: on the
   wedding day the moment happening now is marked, and that has to follow the
   reader's own clock rather than the server's. */

import { useEffect, useState } from "react";
import { Clock, UserRound } from "lucide-react";
import { translate } from "@/kalas/i18n";
import { formatDuration, sortByTime, statusOf } from "@/kalas/screens/planning/dayProgram";
import type { AppLanguage, DayProgramItemRow } from "@/lib/db/types";

type Item = Pick<DayProgramItemRow, "id" | "time" | "title" | "subtitle" | "duration_min" | "owner" | "notes">;

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PublicProgram({ lang, names, dateISO, dateLabel, items, photoUrl }: {
  lang: AppLanguage;
  names: string;
  dateISO: string | null;
  dateLabel: string;
  items: Item[];
  photoUrl: string | null;
}) {
  const t = (s: string, p?: Record<string, string | number>) => translate(lang, s, p);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const sorted = sortByTime(items);
  // Only on the day itself does anything read as done or "Nu" (see dayProgram.ts).
  const isToday = Boolean(now && dateISO && localISO(now) === dateISO);
  const clock = now ? hhmm(now) : "00:00";

  return (
    <main className="theme-kalas relative min-h-screen w-full overflow-hidden bg-[#24413a] font-sans">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,#5f7d70_0%,#24413a_55%,#18302a_100%)]" />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#18302a]/55 via-[#18302a]/35 to-[#18302a]/70" />

      <div className="relative mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-10 sm:py-14">
        <header className="rounded-3xl border border-white/20 bg-white/10 px-6 py-6 text-[#fffdf7] backdrop-blur-md">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-white/70">
            {names || t("Bryllupsdagen")}
          </p>
          <h1 className="mt-1.5 font-serif text-[2.4rem] leading-none">{t("Bryllupsdagen")}</h1>
          {dateLabel && <p className="mt-2 text-[0.88rem] text-white/80">{dateLabel}</p>}
        </header>

        {sorted.length === 0 && (
          <p className="rounded-3xl border border-white/20 bg-white/10 px-6 py-8 text-center text-[0.9rem] text-white/85 backdrop-blur-md">
            {t("Programmet er ikke lagt endnu.")}
          </p>
        )}

        <ol className="flex flex-col gap-2.5">
          {sorted.map((item, i) => {
            const status = statusOf(sorted, i, clock, isToday);
            const current = status === "now";
            return (
              <li
                key={item.id}
                aria-current={current ? "step" : undefined}
                className={
                  "flex gap-4 rounded-3xl border px-5 py-4 backdrop-blur-md transition-colors " +
                  (current
                    ? "border-white/60 bg-white/25 text-white"
                    : status === "done"
                      ? "border-white/10 bg-white/5 text-white/55"
                      : "border-white/20 bg-white/10 text-white")
                }
              >
                <div className="w-14 shrink-0 pt-0.5">
                  <p className="text-[0.95rem] font-semibold tabular-nums">{item.time}</p>
                  {item.duration_min > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-[0.66rem] text-white/60">
                      <Clock size={10} aria-hidden /> {formatDuration(item.duration_min)}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[1rem] font-semibold leading-snug">
                    {item.title}
                    {current && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#24413a]">
                        {t("Nu")}
                      </span>
                    )}
                  </p>
                  {item.subtitle && <p className="mt-0.5 text-[0.8rem] text-white/75">{item.subtitle}</p>}
                  {item.notes && <p className="mt-1.5 text-[0.78rem] italic text-white/70">{item.notes}</p>}
                  {item.owner && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.68rem] text-white/85">
                      <UserRound size={10} aria-hidden /> {item.owner}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-center text-[0.68rem] text-white/55">
          {t("Lavet med Kalas · kun til dem, der har fået linket")}
        </p>
      </div>
    </main>
  );
}
