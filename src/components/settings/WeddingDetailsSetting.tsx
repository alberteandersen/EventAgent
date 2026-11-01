"use client";

/* The facts of the wedding, editable after onboarding: the two names, the
   date (or roughly when), where, how many guests and the budget. Until now
   the only way to change any of them was to run the whole interview again.

   One Save for the lot, written to the two places they live: the names on the
   profile, the rest on the event, whose title is rebuilt from the names so
   nothing still carries the old ones. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import WeddingDatePicker from "@/kalas/onboarding/WeddingDatePicker";
import { LanguageProvider } from "@/kalas/i18n";
import type { AppLanguage, DatePrecision } from "@/lib/db/types";

export interface WeddingDetails {
  eventId: string;
  name: string;
  partner: string;
  eventDate: string | null;
  datePrecision: DatePrecision;
  dateHint: string | null;
  location: string | null;
  guestCount: number | null;
  budget: string | null;
}

type DateMode = "exact" | "rough" | "undecided";

const COPY = {
  da: {
    title: "Bryllupet",
    sub: "Det Juno og resten af Kalas regner med. Ret det her, når noget ændrer sig.",
    names: "Jeres navne",
    name: "Dit navn",
    partner: "Din partners navn",
    date: "Dato",
    exact: "Fast dato",
    rough: "Omtrent",
    undecided: "Ikke besluttet",
    hint: "Fx sommer 2027",
    pick: "Vælg dato",
    place: "Sted",
    placeHint: "By eller område",
    guests: "Antal gæster",
    budget: "Budget",
    kr: "kr",
    save: "Gem",
    saving: "Gemmer",
    saved: "Gemt",
    failed: "Det blev ikke gemt. Prøv igen.",
    needName: "Skriv mindst dit eget navn.",
  },
  en: {
    title: "Your wedding",
    sub: "What Juno and the rest of Kalas plan around. Change it here when something changes.",
    names: "Your names",
    name: "Your name",
    partner: "Your partner's name",
    date: "Date",
    exact: "Set date",
    rough: "Roughly",
    undecided: "Not decided",
    hint: "E.g. summer 2027",
    pick: "Pick a date",
    place: "Place",
    placeHint: "Town or area",
    guests: "Number of guests",
    budget: "Budget",
    kr: "DKK",
    save: "Save",
    saving: "Saving",
    saved: "Saved",
    failed: "That did not save. Try again.",
    needName: "Enter at least your own name.",
  },
} as const;

const fieldCls =
  "w-full rounded-xl border border-line bg-shell px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-sage-strong focus:outline-none";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </span>
  );
}

export function WeddingDetailsSetting({ initial, lang }: { initial: WeddingDetails; lang: AppLanguage }) {
  const copy = COPY[lang === "en" ? "en" : "da"];
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [partner, setPartner] = useState(initial.partner);
  const [mode, setMode] = useState<DateMode>(
    initial.datePrecision === "exact" && initial.eventDate ? "exact"
      : initial.datePrecision === "undecided" ? "undecided" : "rough",
  );
  const [date, setDate] = useState(initial.eventDate ?? "");
  const [hint, setHint] = useState(initial.dateHint ?? "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [location, setLocation] = useState(initial.location ?? "");
  const [guests, setGuests] = useState(initial.guestCount != null ? String(initial.guestCount) : "");
  const [budget, setBudget] = useState(initial.budget ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dateLabel = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "da-DK", {
        day: "numeric", month: "long", year: "numeric",
      })
    : copy.pick;

  const edited = () => { if (state !== "idle") setState("idle"); };

  const save = async () => {
    if (!name.trim()) { setError(copy.needName); setState("error"); return; }
    setState("saving");
    setError(null);
    const dateFields =
      mode === "exact" && date
        ? { event_date: date, date_precision: "exact", date_hint: null }
        : mode === "undecided"
          ? { event_date: null, date_precision: "undecided", date_hint: null }
          : { event_date: null, date_precision: "season", date_hint: hint };
    try {
      const [profileRes, eventRes] = await Promise.all([
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: name, partner_name: partner }),
        }),
        fetch(`/api/events/${initial.eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            names: { name, partner },
            location,
            guest_count: guests.trim() === "" ? null : guests,
            budget,
            ...dateFields,
          }),
        }),
      ]);
      if (!profileRes.ok || !eventRes.ok) {
        const body = (await (eventRes.ok ? profileRes : eventRes).json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? copy.failed);
        setState("error");
        return;
      }
      setState("saved");
      router.refresh();
    } catch {
      setError(copy.failed);
      setState("error");
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted">{copy.sub}</p>

      <div className="mt-5 space-y-5" onChange={edited}>
        <div>
          <Label>{copy.names}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.name} aria-label={copy.name} className={fieldCls} />
            <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder={copy.partner} aria-label={copy.partner} className={fieldCls} />
          </div>
        </div>

        <div>
          <Label>{copy.date}</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["exact", "rough", "undecided"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => { setMode(m); edited(); if (m === "exact" && !date) setCalendarOpen(true); }}
                className={`rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
                  mode === m
                    ? "border-ink bg-ink text-card"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {copy[m]}
              </button>
            ))}
          </div>
          {mode === "exact" && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCalendarOpen((o) => !o)}
                aria-expanded={calendarOpen}
                className={`${fieldCls} text-left sm:max-w-xs ${date ? "" : "text-muted"}`}
              >
                {dateLabel}
              </button>
              {calendarOpen && (
                <div className="mt-3 max-w-sm">
                  <LanguageProvider initialLang={lang}>
                    <WeddingDatePicker
                      value={date}
                      lang={lang === "en" ? "en" : "da"}
                      onChange={(iso) => { setDate(iso); setCalendarOpen(false); edited(); }}
                    />
                  </LanguageProvider>
                </div>
              )}
            </div>
          )}
          {mode === "rough" && (
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={copy.hint}
              aria-label={copy.hint}
              className={`${fieldCls} mt-3 sm:max-w-xs`}
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <Label>{copy.place}</Label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={copy.placeHint} className={fieldCls} />
          </label>
          <label className="block">
            <Label>{copy.guests}</Label>
            <input type="number" inputMode="numeric" min={0} max={2000} value={guests} onChange={(e) => setGuests(e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <Label>{copy.budget}</Label>
            <div className="relative">
              <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className={`${fieldCls} pr-10`} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted">{copy.kr}</span>
            </div>
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {state === "error" && error && (
          <p className="mr-auto text-sm text-terracotta">{error}</p>
        )}
        {state === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check size={14} /> {copy.saved}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" && <Loader2 size={14} className="animate-spin" />}
          {state === "saving" ? copy.saving : copy.save}
        </button>
      </div>
    </section>
  );
}
