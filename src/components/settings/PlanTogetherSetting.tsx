"use client";

/* Planlæg sammen. The couple as two people on one wedding: who is in, and,
   until the other half is, a way to ask them. Once both are members, what
   either changes the other sees live, since every screen already listens to
   its tables in realtime and the rows now answer to the wedding, not to
   whoever wrote them (0036). */

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import type { AppLanguage } from "@/lib/db/types";

export interface CoupleMember {
  name: string;
  you: boolean;
}

const COPY = {
  da: {
    eyebrow: "Planlæg sammen",
    title: "Planlæg som par",
    together: "I planlægger det samme bryllup. Det én af jer ændrer, ser den anden med det samme.",
    alone: "Invitér din partner, så I planlægger i det samme bryllup: samme tjekliste, budget og gæsteliste.",
    you: "Dig",
    partner: "Din partner",
    live: "Synkroniserer live",
    waiting: "Venter på svar",
    invited: "Invitation sendt til {email}",
    email: "Din partners e-mail",
    send: "Send invitation",
    resend: "Send igen",
    sent: "Sendt",
    failed: "Invitationen blev ikke sendt. Tjek adressen, og prøv igen.",
  },
  en: {
    eyebrow: "Plan together",
    title: "Plan as a couple",
    together: "You are planning the same wedding. Whatever one of you changes, the other sees straight away.",
    alone: "Invite your partner so you plan the same wedding: the same checklist, budget and guest list.",
    you: "You",
    partner: "Your partner",
    live: "Syncing live",
    waiting: "Waiting for a reply",
    invited: "Invitation sent to {email}",
    email: "Your partner's email",
    send: "Send invitation",
    resend: "Send again",
    sent: "Sent",
    failed: "The invitation was not sent. Check the address and try again.",
  },
} as const;

function Person({ label, name, tone }: { label: string; name: string; tone: "ivory" | "sage" | "empty" }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex w-full max-w-[9.5rem] flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-6">
      <span className={
        "flex h-14 w-14 items-center justify-center rounded-full font-serif text-[1.6rem] " +
        (tone === "ivory" ? "bg-[#ece6d6] text-[#24413a]"
          : tone === "sage" ? "bg-[#a9c2b6] text-[#24413a]"
          : "border border-dashed border-white/30 text-white/40")
      }>
        {tone === "empty" ? "+" : initial}
      </span>
      <div className="text-center">
        <p className="text-sm font-medium text-white">{name || label}</p>
        {name && <p className="text-[0.7rem] text-white/50">{label}</p>}
      </div>
    </div>
  );
}

export function PlanTogetherSetting({ lang, members, pendingEmail }: {
  lang: AppLanguage;
  members: CoupleMember[];
  pendingEmail: string | null;
}) {
  const copy = COPY[lang === "en" ? "en" : "da"];
  const you = members.find((m) => m.you) ?? { name: "", you: true };
  const partner = members.find((m) => !m.you) ?? null;
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [sentTo, setSentTo] = useState<string | null>(pendingEmail);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/partner/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, language: lang }),
      });
      if (!res.ok) { setState("error"); return; }
      setSentTo(email.trim().toLowerCase());
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-[#1b1f1d] p-6 text-white sm:p-8">
      <p className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#a9c2b6]">
        <span aria-hidden className="h-px w-8 bg-[#a9c2b6]" /> {copy.eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-[2rem] leading-tight text-white">{copy.title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
        {partner ? copy.together : copy.alone}
      </p>

      <div className="mt-6 flex items-center justify-center gap-2 sm:gap-4">
        <Person label={copy.you} name={you.name} tone="ivory" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden className="h-px flex-1 bg-white/15" />
          <span className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/70">
            {partner ? copy.live : copy.waiting}
          </span>
          <span aria-hidden className="h-px flex-1 bg-white/15" />
        </div>
        <Person label={copy.partner} name={partner?.name ?? ""} tone={partner ? "sage" : "empty"} />
      </div>

      {!partner && (
        <form onSubmit={send} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state !== "sending") setState("idle"); }}
            placeholder={copy.email}
            aria-label={copy.email}
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === "sending" || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ece6d6] px-5 py-2.5 text-sm font-medium text-[#24413a] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : state === "sent" ? <Check size={14} /> : <Send size={14} />}
            {state === "sent" ? copy.sent : sentTo ? copy.resend : copy.send}
          </button>
        </form>
      )}
      {!partner && state === "error" && <p className="mt-2 text-sm text-[#e8a797]">{copy.failed}</p>}
      {!partner && sentTo && state !== "error" && (
        <p className="mt-2 text-[0.78rem] text-white/50">{copy.invited.replace("{email}", sentTo)}</p>
      )}
    </section>
  );
}
