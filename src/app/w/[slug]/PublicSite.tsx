"use client";

/* Client shell for the public wedding site: locks to the couple's language,
   renders the full-size SiteRenderer inside the Kalas theme, and owns the
   guest-facing RSVP form, gift-claim form, and password gate. All guest writes
   go to service-role API routes under /api/w/[slug]/*. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LanguageProvider, useLang } from "@/kalas/i18n";
import { SiteRenderer } from "@/kalas/site/SiteRenderer";
import GiftCard from "@/kalas/registry/GiftCard";
import { sortGifts } from "@/kalas/registry/gifts";
import type { SiteConfig } from "@/kalas/site/config";
import type { SiteDesign } from "@/kalas/site/design";
import type { RegistryItemRow, AppLanguage } from "@/lib/db/types";

type Couple = { a: string; b: string; dateLabel: string; dateISO: string | null };

interface Props {
  slug: string;
  couple: Couple;
  config: SiteConfig;
  design: SiteDesign;
  /** Model-built (sanitized, URL-resolved) site markup; null → token renderer. */
  siteHtml?: string | null;
  photoUrls: Record<string, string>;
  registryItems: RegistryItemRow[];
  claimedByItem?: Record<string, number>;
  lang: AppLanguage;
  locked: boolean;
  rsvpToken?: string | null;
}

export function PublicSite(props: Props) {
  return (
    <LanguageProvider initialLang={props.lang} lock>
      <div className="theme-kalas">
        {props.locked ? <PasswordGate slug={props.slug} /> : <Site {...props} />}
      </div>
    </LanguageProvider>
  );
}

function Site({ slug, couple, config, design, siteHtml, photoUrls, registryItems, claimedByItem = {}, rsvpToken }: Props) {
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [claimItem, setClaimItem] = useState<RegistryItemRow | null>(null);

  return (
    <>
      {siteHtml ? (
        <HtmlSite
          html={siteHtml}
          couple={couple}
          hideBranding={config.hideBranding}
          registryItems={registryItems}
          claimedByItem={claimedByItem}
          onRsvp={() => setRsvpOpen(true)}
          onClaim={(it) => setClaimItem(it)}
        />
      ) : (
        <SiteRenderer
          couple={couple}
          config={config}
          design={design}
          photoUrls={photoUrls}
          registryItems={registryItems}
          claimedByItem={claimedByItem}
          onRsvp={() => setRsvpOpen(true)}
          onClaim={(it) => setClaimItem(it)}
          /* Only offered once the date is firm — a calendar entry for
             "spring 2028" would be a guess in a place people trust. */
          icsUrl={couple.dateISO ? `/api/w/${slug}/ics` : null}
        />
      )}
      {rsvpOpen && <RsvpModal slug={slug} config={config} token={rsvpToken ?? null} onClose={() => setRsvpOpen(false)} />}
      {claimItem && <ClaimModal slug={slug} item={claimItem} onClose={() => setClaimItem(null)} />}
    </>
  );
}

/* ── Model-built site: sanitized markup + our interactive slots ────────── */
function HtmlSite({ html, couple, hideBranding, registryItems, claimedByItem, onRsvp, onClaim }: {
  html: string;
  couple: Couple;
  hideBranding: boolean;
  registryItems: RegistryItemRow[];
  claimedByItem: Record<string, number>;
  onRsvp: () => void;
  onClaim: (item: RegistryItemRow) => void;
}) {
  const { t } = useLang();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [registryEl, setRegistryEl] = useState<HTMLElement | null>(null);

  // Hydrate the declared slots: RSVP buttons, live countdown, registry mount.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rsvpEls = root.querySelectorAll<HTMLElement>('[data-kalas="rsvp"]');
    const open = (e: Event) => { e.preventDefault(); onRsvp(); };
    rsvpEls.forEach((el) => el.addEventListener("click", open));

    if (couple.dateISO) {
      const days = Math.ceil((new Date(`${couple.dateISO}T00:00:00`).getTime() - Date.now()) / 86400000);
      root.querySelectorAll<HTMLElement>('[data-kalas="countdown"]').forEach((el) => {
        el.textContent = days > 0 ? String(days) : "0";
      });
    }

    setRegistryEl(root.querySelector<HTMLElement>('[data-kalas="registry"]'));
    return () => rsvpEls.forEach((el) => el.removeEventListener("click", open));
  }, [html, couple.dateISO, onRsvp]);

  return (
    <div className="min-h-screen">
      {/* Sanitized model output: allowlisted tags/attrs only, image srcs are
          platform-substituted URLs, see src/lib/website/sanitize.ts. */}
      <div id="kalas-site" ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />

      {/* Same GiftCard as the couple's screen, but in `inherit` tone: the model
          picks this site's palette, so the card borrows it rather than
          importing the app's cream. */}
      {registryEl && registryItems.length > 0 && createPortal(
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {sortGifts(registryItems).map((it) => {
            const left = Math.max(0, it.quantity - (claimedByItem[it.id] ?? 0));
            return (
              <GiftCard
                key={it.id}
                item={it}
                reserved={left <= 0}
                tone="inherit"
                footer={
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {left > 0 ? (
                      <button onClick={() => onClaim(it)}
                        style={{ fontSize: "0.75rem", fontWeight: 600, borderRadius: "999px", padding: "0.35rem 0.85rem", background: "rgba(0,0,0,0.85)", color: "#fff", cursor: "pointer" }}>
                        {t("Reservér gave")}
                      </button>
                    ) : null}
                    {it.product_url && (
                      <a href={it.product_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", border: "1px solid rgba(0,0,0,0.25)", borderRadius: "999px", padding: "0.35rem 0.85rem" }}>
                        {t("Se hos {store}", { store: it.store_name || t("butik") })}
                      </a>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>,
        registryEl
      )}

      {!hideBranding && (
        <footer style={{ padding: "2.5rem 0", textAlign: "center", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.2em", opacity: 0.4 }}>{t("Lavet med")} </span>
          <span style={{ fontFamily: "serif", fontSize: "0.9rem", letterSpacing: "0.12em", opacity: 0.6 }}>Kalas</span>
        </footer>
      )}
    </div>
  );
}

/* ── Password gate ───────────────────────────────────────────────────── */
function PasswordGate({ slug }: { slug: string }) {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(false);
    try {
      const res = await fetch(`/api/w/${slug}/verify-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      if (res.ok) { window.location.reload(); return; }
      setError(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl rule bg-card p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink">
          <span className="font-serif text-[1.3rem] leading-none text-canvas">K</span>
        </div>
        <h1 className="mt-4 font-serif text-[1.3rem] text-ink">{t("Privat side")}</h1>
        <p className="mt-1 text-[0.85rem] text-muted">{t("Indtast koden fra jeres invitation.")}</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t("Adgangskode")} autoFocus
          className="mt-5 w-full rounded-xl rule bg-canvas px-4 py-3 text-center text-[0.95rem] text-ink focus:border-ink focus:outline-none" />
        {error && <p className="mt-2 text-[0.78rem] text-[var(--color-terracotta)]">{t("Forkert kode, prøv igen.")}</p>}
        <button type="submit" disabled={busy || !password}
          className="mt-4 w-full rounded-full bg-ink px-5 py-3 text-[0.82rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
          {busy ? t("Åbner…") : t("Se siden")}
        </button>
      </form>
    </div>
  );
}

/* ── RSVP modal ──────────────────────────────────────────────────────── */
function RsvpModal({ slug, config, token, onClose }: { slug: string; config: SiteConfig; token: string | null; onClose: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [meal, setMeal] = useState("");
  const [dietary, setDietary] = useState("");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attending === null || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/w/${slug}/rsvp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, name: name.trim(), email: email.trim() || null, attending,
          plusOne: config.rsvpPlusOne ? plusOne : false, plusOneName: plusOneName.trim() || null,
          meal: config.rsvpMeal ? meal.trim() || null : null,
          dietary: config.rsvpDietary ? dietary.trim() || null : null,
          note: note.trim() || null, company,
        }),
      });
      if (!res.ok) { setError(t("Noget gik galt, prøv igen.")); return; }
      setDone(attending);
    } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose}>
      {done !== null ? (
        <div className="p-8 text-center">
          <p className="text-[2rem]">{done ? "🥂" : "💛"}</p>
          <h2 className="mt-3 font-serif text-[1.3rem] text-ink">{done ? t("Tak, vi ses!") : t("Tak for svaret")}</h2>
          <p className="mt-2 text-[0.88rem] text-ink-soft">
            {done ? t("Vi har noteret jeres deltagelse.") : t("Vi kommer til at savne jer.")}
          </p>
          <button onClick={onClose} className="mt-5 rounded-full bg-ink px-6 py-2.5 text-[0.82rem] font-medium text-canvas cursor-pointer">{t("Luk")}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
          <h2 className="font-serif text-[1.4rem] text-ink">{t("Svar på invitation")}</h2>
          {config.rsvpDeadline && <p className="mt-1 text-[0.8rem] text-muted">{t("Svar venligst inden {date}.", { date: config.rsvpDeadline })}</p>}

          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} tabIndex={-1} autoComplete="off"
            className="hidden" aria-hidden="true" />

          <Field label={t("Navn")}>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label={t("E-mail (valgfrit)")}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>

          <div className="mt-4">
            <p className="mb-2 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted">{t("Kommer I?")}</p>
            <div className="flex gap-2">
              <Choice active={attending === true} onClick={() => setAttending(true)}>{t("Ja, vi kommer 🎉")}</Choice>
              <Choice active={attending === false} onClick={() => setAttending(false)}>{t("Desværre ikke")}</Choice>
            </div>
          </div>

          {attending === true && (
            <>
              {config.rsvpPlusOne && (
                <div className="mt-4">
                  <label className="flex items-center gap-2 text-[0.9rem] text-ink cursor-pointer">
                    <input type="checkbox" checked={plusOne} onChange={(e) => setPlusOne(e.target.checked)} />
                    {t("Jeg tager en ledsager med")}
                  </label>
                  {plusOne && (
                    <input value={plusOneName} onChange={(e) => setPlusOneName(e.target.value)} placeholder={t("Ledsagers navn")} className={`${inputCls} mt-2`} />
                  )}
                </div>
              )}
              {config.rsvpMeal && (
                <Field label={t("Menuvalg (valgfrit)")}>
                  <input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder={t("f.eks. kød, fisk, vegetar")} className={inputCls} />
                </Field>
              )}
              {config.rsvpDietary && (
                <Field label={t("Allergier / hensyn (valgfrit)")}>
                  <input value={dietary} onChange={(e) => setDietary(e.target.value)} className={inputCls} />
                </Field>
              )}
            </>
          )}

          <Field label={t("Besked til brudeparret (valgfrit)")}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </Field>

          {error && <p className="mt-2 text-[0.8rem] text-[var(--color-terracotta)]">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={busy || attending === null || !name.trim()}
              className="flex-1 rounded-full bg-ink px-5 py-3 text-[0.82rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
              {busy ? t("Sender…") : t("Send svar")}
            </button>
            <button type="button" onClick={onClose} className="rounded-full rule px-5 py-3 text-[0.82rem] text-ink-soft hover:bg-shell cursor-pointer">{t("Annuller")}</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

/* ── Registry claim modal ────────────────────────────────────────────── */
function ClaimModal({ slug, item, onClose }: { slug: string; item: RegistryItemRow; onClose: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/w/${slug}/registry/claim`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, name: name.trim(), email: email.trim() || null, message: message.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error === "fully_claimed" ? t("Denne gave er allerede reserveret.") : t("Noget gik galt, prøv igen."));
        return;
      }
      setDone(true);
    } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose}>
      {done ? (
        <div className="p-8 text-center">
          <p className="text-[2rem]">🎁</p>
          <h2 className="mt-3 font-serif text-[1.3rem] text-ink">{t("Tak, gaven er reserveret")}</h2>
          {/* The couple's registry screen shows the name and the message, so
              promising anonymity here was simply untrue. */}
          <p className="mt-2 text-[0.88rem] text-ink-soft">{t("Brudeparret får besked, og de andre gæster kan se at den er taget.")}</p>
          <button onClick={onClose} className="mt-5 rounded-full bg-ink px-6 py-2.5 text-[0.82rem] font-medium text-canvas cursor-pointer">{t("Luk")}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8">
          <h2 className="font-serif text-[1.4rem] text-ink">{t("Reservér gave")}</h2>
          <p className="mt-1 text-[0.85rem] text-muted">{item.title}</p>
          <Field label={t("Navn")}><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>
          <Field label={t("E-mail (valgfrit)")}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label={t("Hilsen (valgfrit)")}><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></Field>
          {error && <p className="mt-2 text-[0.8rem] text-[var(--color-terracotta)]">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={busy || !name.trim()}
              className="flex-1 rounded-full bg-ink px-5 py-3 text-[0.82rem] font-medium text-canvas hover:bg-ink/90 cursor-pointer disabled:opacity-50">
              {busy ? t("Reserverer…") : t("Reservér")}
            </button>
            <button type="button" onClick={onClose} className="rounded-full rule px-5 py-3 text-[0.82rem] text-ink-soft hover:bg-shell cursor-pointer">{t("Annuller")}</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────── */
const inputCls = "mt-1.5 w-full rounded-xl rule bg-canvas px-4 py-2.5 text-[0.92rem] text-ink focus:border-ink focus:outline-none";

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-canvas shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 rounded-xl border px-4 py-2.5 text-[0.88rem] transition-colors cursor-pointer ${
        active ? "border-ink bg-sage-tint text-ink font-medium" : "border-[var(--color-line-strong)] text-ink-soft hover:bg-shell"
      }`}>
      {children}
    </button>
  );
}
