"use client";

/* The guest hub: Kalas' own blocks under the couple's site. Who to ring on the
   day, which table am I at, and a guestbook. Drawn in the Kalas palette rather
   than the site's design, because the design generator never lays them out
   (see HUB_SECTIONS), and each only appears when the couple switched it on. */

import { useEffect, useState } from "react";
import { Armchair, BookHeart, Loader2, Mail, Phone, Search, UserRound } from "lucide-react";
import { useLang } from "@/kalas/i18n";
import { hasContact, type SiteConfig } from "@/kalas/site/config";
import type { GuestbookEntryRow } from "@/lib/db/types";

type Entry = Pick<GuestbookEntryRow, "id" | "name" | "message" | "created_at">;

const fieldCls =
  "w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-[0.9rem] text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none";

function Card({ icon: Icon, title, children }: { icon: typeof Phone; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-6 text-left">
      <p className="flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-sage">
        <Icon size={13} aria-hidden /> {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function GuestHub({ slug, config, rsvpToken }: { slug: string; config: SiteConfig; rsvpToken: string | null }) {
  const { t } = useLang();
  const on = (id: string) => config.sections.some((s) => s.id === id && s.enabled);
  const showContact = on("contact") && hasContact(config.contact);
  const showSeat = on("seat");
  const showBook = on("guestbook");
  if (!showContact && !showSeat && !showBook) return null;

  return (
    <div className="bg-canvas px-4 py-14">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <p className="text-center font-serif text-[1.9rem] leading-tight text-ink">{t("Til gæsterne")}</p>
        {showSeat && <SeatFinder slug={slug} token={rsvpToken} />}
        {showContact && (
          <Card icon={UserRound} title={t("Spørgsmål på dagen")}>
            <p className="font-serif text-[1.3rem] leading-tight text-ink">{config.contact.name}</p>
            {config.contact.role && <p className="text-[0.85rem] text-muted">{config.contact.role}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {config.contact.phone && (
                <a href={`tel:${config.contact.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-canvas hover:bg-ink/90">
                  <Phone size={13} /> {config.contact.phone}
                </a>
              )}
              {config.contact.email && (
                <a href={`mailto:${config.contact.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[0.8rem] text-ink hover:border-ink">
                  <Mail size={13} /> {config.contact.email}
                </a>
              )}
            </div>
          </Card>
        )}
        {showBook && <Guestbook slug={slug} />}
      </div>
    </div>
  );
}

function SeatFinder({ slug, token }: { slug: string; token: string | null }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = async (query: { name?: string; token?: string }) => {
    setBusy(true);
    try {
      const params = new URLSearchParams(query as Record<string, string>);
      const res = await fetch(`/api/w/${slug}/seat?${params}`);
      const body = (await res.json().catch(() => ({}))) as { status?: string; table?: string };
      setAnswer(
        body.status === "found" ? t("Du sidder ved {table}.", { table: body.table ?? "" })
          : body.status === "not-seated" ? t("Du er på listen, men har ikke fået en plads endnu.")
          : body.status === "ambiguous" ? t("Der er flere gæster med det navn. Brug linket fra din invitation.")
          : res.status === 401 ? t("Siden er låst. Genindlæs og skriv koden igen.")
          : t("Vi kan ikke finde det navn. Skriv det, som det står på invitationen."),
      );
    } catch {
      setAnswer(t("Det virkede ikke. Prøv igen."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Armchair} title={t("Find min plads")}>
      {token ? (
        <button type="button" onClick={() => void ask({ token })} disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-canvas hover:bg-ink/90 disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Armchair size={14} />} {t("Vis min plads")}
        </button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void ask({ name }); }} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Dit fulde navn")}
            aria-label={t("Dit fulde navn")} className={fieldCls} />
          <button type="submit" disabled={busy || !name.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.82rem] font-medium text-canvas hover:bg-ink/90 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {t("Find")}
          </button>
        </form>
      )}
      {answer && <p role="status" className="mt-3 font-serif text-[1.15rem] text-ink">{answer}</p>}
    </Card>
  );
}

function Guestbook({ slug }: { slug: string }) {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/w/${slug}/guestbook`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((b: { entries?: Entry[] }) => { if (alive) setEntries(b.entries ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/w/${slug}/guestbook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, company }),
      });
      const body = (await res.json().catch(() => ({}))) as { entry?: Entry };
      if (!res.ok) { setError(true); return; }
      if (body.entry) setEntries((list) => [body.entry!, ...list]);
      setMessage("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "da-DK", { day: "numeric", month: "long" });

  return (
    <Card icon={BookHeart} title={t("Gæstebog")}>
      <form onSubmit={submit} className="grid gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
          placeholder={t("Dit navn")} aria-label={t("Dit navn")} className={fieldCls} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3}
          placeholder={t("Skriv en hilsen til brudeparret")} aria-label={t("Hilsen")} className={`${fieldCls} resize-none`} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} tabIndex={-1} autoComplete="off"
          aria-hidden className="hidden" />
        <div className="flex items-center justify-between gap-3">
          {error ? <p className="text-[0.78rem] text-[var(--color-terracotta)]">{t("Hilsenen blev ikke sendt. Prøv igen.")}</p> : <span />}
          <button type="submit" disabled={busy || !name.trim() || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-[0.82rem] font-medium text-canvas hover:bg-ink/90 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} {t("Skriv i gæstebogen")}
          </button>
        </div>
      </form>
      {entries.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-2xl bg-shell px-4 py-3">
              <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-ink">{e.message}</p>
              <p className="mt-1.5 text-[0.72rem] text-muted">{e.name} · {date(e.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
