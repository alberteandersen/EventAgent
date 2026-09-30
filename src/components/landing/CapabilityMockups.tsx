"use client";

/* Code-drawn product vignettes for the landing page — stylized, honest
   miniatures of real app surfaces (chat, discovery, outreach, quotes,
   budget, guests, website, timeline). Drawn in code rather than screenshots
   so they stay crisp at any size and never rot when the UI shifts. */

import Image from "next/image";
import { cn } from "@/lib/utils";

/* Palette lifted from the app itself. */
const INK = "#314523";
const MUTED = "#646d5a";
const LINE = "#e4e0d4";
const CARD = "#fcfbf7";
const SHELL = "#f4f0e7";
const SAGE = "#eef1e6";
const TERRA = "#a44a35";

function Dot({ className }: { className?: string }) {
  return <span className={cn("h-2 w-2 rounded-full", className)} />;
}

/** Shared window chrome so every vignette reads as the same product. */
function MockShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border" style={{ borderColor: LINE, backgroundColor: CARD }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: LINE, backgroundColor: SHELL }}>
        <div className="flex gap-1.5">
          <Dot className="bg-[#ddd6c0]" />
          <Dot className="bg-[#cfc8ae]" />
          <Dot className="bg-[#c2b280]" />
        </div>
        <span className="ml-1 truncate text-[10px] font-medium uppercase tracking-[1.2px]" style={{ color: MUTED }}>
          {label}
        </span>
      </div>
      {/* Fixed height (not aspect) so wide and narrow bento cards align. */}
      <div className="h-[300px] overflow-hidden p-4 sm:h-[320px] sm:p-5">{children}</div>
    </div>
  );
}

function Pill({ children, dark, className }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
        className
      )}
      style={dark ? { backgroundColor: INK, color: "#f7f5ef" } : { backgroundColor: SAGE, color: INK }}
    >
      {children}
    </span>
  );
}

/* The venues every vignette talks about. Invented on purpose, the landing page
   must not put words or prices in a real venue's mouth, so each name was
   checked against a web search before it went in. Prices are for the 35-guest
   brief in the chat: Danish cover prices run roughly 400 to 1,500 kr in 2026,
   with room or exclusive hire on top. */
const SHORTLIST = [
  { name: "Sandrevlen Badehotel", photo: "/landing/elopement.jpg", rating: "4.7", seats: "60" },
  { name: "Ellemose Herregård", photo: "/landing/rustic-barn.jpg", rating: "4.8", seats: "110" },
  { name: "Kløverhøj Lade", photo: "/landing/garden-ceremony.jpg", rating: "4.6", seats: "80" },
];

function Photo({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#ddd6c0]", className)}>
      <Image src={src} alt="" fill sizes="160px" className="object-cover" />
    </div>
  );
}

/* ── 01 · Chat ─────────────────────────────────────────────────────────── */
function ChatMockup() {
  return (
    <div className="flex h-full flex-col justify-end gap-2.5">
      <div className="self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[12px] leading-snug text-[#f7f5ef]" style={{ backgroundColor: INK, maxWidth: "78%" }}>
        Vi tænker ca. 35 gæster, ved havet på Bornholm, efteråret 2027. Intimt, ikke stift.
      </div>
      <div className="rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[12px] leading-snug" style={{ borderColor: LINE, backgroundColor: "#ffffff", color: MUTED, maxWidth: "85%" }}>
        Dejligt. Jeg har fundet steder ved havet, der passer til en lille efterårsfest. Tag et kig:
      </div>
      <div className="flex gap-2">
        {SHORTLIST.map((v) => (
          <div key={v.name} className="min-w-0 flex-1 overflow-hidden rounded-xl border" style={{ borderColor: LINE, backgroundColor: "#fff" }}>
            <Photo src={v.photo} className="h-12" />
            <div className="px-2 py-1.5">
              <p className="truncate font-[family-name:var(--font-cormorant)] text-[13px] font-semibold leading-tight" style={{ color: INK }}>{v.name}</p>
              <p className="text-[9px]" style={{ color: MUTED }}>★ {v.rating} · {v.seats} pladser</p>
            </div>
          </div>
        ))}
      </div>
      <Pill className="self-start">5 steder lagt på jeres liste</Pill>
    </div>
  );
}

/* ── 02 · Discovery ───────────────────────────────────────────────────── */
function VendorsMockup() {
  const cats = ["Alle", "Venue", "Foto", "Blomster", "Catering", "Musik"];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c, i) => (
          <span key={c} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={i === 1 ? { backgroundColor: INK, color: "#f7f5ef" } : { backgroundColor: SAGE, color: MUTED }}>
            {c}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2.5">
        {[
          ["Kastelhøj Slot", "4.7", "Murstenssal på et slotsgods", "/landing/city-reception.jpg"],
          ["Villa Aurelisa", "4.9", "Terrasse ved vinmarken, Toscana", "/landing/destination.jpg"],
          ["Hollowmere Barn", "4.6", "Restaureret lade i Cotswolds", "/landing/rustic-barn.jpg"],
        ].map(([name, rating, blurb, photo]) => (
          <div key={name} className="flex min-w-0 flex-col overflow-hidden rounded-xl border" style={{ borderColor: LINE, backgroundColor: "#fff" }}>
            <Photo src={photo} className="h-16" />
            <div className="flex flex-1 flex-col px-2.5 py-2">
              <p className="truncate font-[family-name:var(--font-cormorant)] text-[13.5px] font-semibold leading-tight" style={{ color: INK }}>{name}</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug" style={{ color: MUTED }}>{blurb}</p>
              <div className="mt-auto flex items-center justify-between pt-1.5">
                <span className="text-[9px] font-semibold" style={{ color: INK }}>★ {rating}</span>
                <span className="rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide" style={{ backgroundColor: SAGE, color: INK }}>Gem</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px]" style={{ color: MUTED }}>Rigtige steder, fundet live, med anmeldelser, kapacitet og kontakt tjekket</p>
    </div>
  );
}

/* ── 03 · Outreach ────────────────────────────────────────────────────── */
function OutreachMockup() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[1.2px]" style={{ color: MUTED }}>Ava skriver til</p>
          <p className="truncate font-[family-name:var(--font-cormorant)] text-[18px] font-semibold leading-tight" style={{ color: INK }}>Villa Aurelisa</p>
        </div>
        <Pill>🌐 Skrevet på italiensk</Pill>
      </div>
      <div className="mt-3 flex-1 space-y-1.5 overflow-hidden rounded-xl border px-3.5 py-3 text-[11px] leading-relaxed" style={{ borderColor: LINE, backgroundColor: "#fff", color: MUTED }}>
        <p style={{ color: INK }}>Gentile staff di Villa Aurelisa,</p>
        <p>ci siamo innamorati della vostra terrazza sui vigneti, sarebbe lo sfondo perfetto per il nostro matrimonio…</p>
        <p className="truncate">Prevediamo circa 35 invitati per l&apos;autunno 2027. Avreste disponibilità…</p>
        <p className="pt-1" style={{ color: INK }}>Cordiali saluti,<br />Ava, per conto della coppia</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px]" style={{ color: MUTED }}>Intet sendes uden jer</p>
        <span className="rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#f7f5ef]" style={{ backgroundColor: INK }}>
          Godkend og send
        </span>
      </div>
    </div>
  );
}

/* ── 04 · Quotes ──────────────────────────────────────────────────────── */
function QuotesMockup() {
  const rows: { price: string; avail: string; terms: string; best?: boolean }[] = [
    { price: "53.300 kr.", avail: "12. sep. ledig", terms: "1.295 kr./gæst, menu og vin", best: true },
    { price: "72.750 kr.", avail: "19. sep. ledig", terms: "eksklusiv leje + 1.650 kr./gæst" },
    { price: "40.750 kr.", avail: "Venteliste i sep.", terms: "leje af laden · egen kok" },
  ];
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="font-[family-name:var(--font-cormorant)] text-[17px] font-semibold leading-tight" style={{ color: INK }}>Tilbud, side om side</p>
        <Pill>3 svar modtaget</Pill>
      </div>
      {rows.map((row, i) => {
        const venue = SHORTLIST[i];
        return (
          <div key={venue.name} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", row.best && "ring-1")}
            style={{ borderColor: row.best ? INK : LINE, backgroundColor: "#fff", ...(row.best ? { boxShadow: "0 6px 18px -8px rgba(49,69,35,0.35)" } : null) }}>
            <Photo src={venue.photo} className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-[family-name:var(--font-cormorant)] text-[14.5px] font-semibold leading-tight" style={{ color: INK }}>{venue.name}</p>
              <p className="truncate text-[9.5px]" style={{ color: MUTED }}>{row.avail} · {row.terms}</p>
            </div>
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: INK }}>{row.price}</p>
            {row.best && <Pill dark>Bedste match</Pill>}
          </div>
        );
      })}
      <p className="text-[10px]" style={{ color: MUTED }}>Priser, datoer og vilkår trukket ud af hvert svar, automatisk</p>
    </div>
  );
}

/* ── 05 · Budget ──────────────────────────────────────────────────────── */
function BudgetMockup() {
  const rows: [string, string, number, string][] = [
    ["Sted og mad", "53.300", 72, "#8fa183"],
    ["Fotograf", "18.500", 55, "#c2b280"],
    ["Blomster", "7.500", 38, "#b8c2ab"],
    ["Musik", "9.000", 20, "#ddd6c0"],
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[1.2px]" style={{ color: MUTED }}>Samlet budget</p>
          <p className="font-[family-name:var(--font-cormorant)] text-[24px] font-semibold leading-tight" style={{ color: INK }}>150.000 kr.</p>
        </div>
        <Pill>71.800 kr. bundet</Pill>
      </div>
      <div className="flex-1 space-y-2.5">
        {rows.map(([label, amount, pct, color]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-[10.5px]">
              <span style={{ color: INK }}>{label}</span>
              <span className="tabular-nums" style={{ color: MUTED }}>{amount} kr.</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: SAGE }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px]" style={{ color: MUTED }}>Hvert tilbud og depositum lander her af sig selv, med besked før noget løber løbsk</p>
    </div>
  );
}

/* ── 06 · Guests ──────────────────────────────────────────────────────── */
function GuestsMockup() {
  const rows: [string, string, string][] = [
    ["Alberte Holm", "Ja", "Fisk"],
    ["Jonas Krag", "Ja", "Vegetar"],
    ["Nour El-Sayed", "Afventer", "-"],
    ["Marta Rossi", "Ja", "Kød"],
  ];
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="font-[family-name:var(--font-cormorant)] text-[17px] font-semibold leading-tight" style={{ color: INK }}>Gæsteliste</p>
        <Pill>28 af 35 har svaret</Pill>
      </div>
      <div className="flex-1 divide-y overflow-hidden rounded-xl border" style={{ borderColor: LINE, backgroundColor: "#fff" }}>
        {rows.map(([name, rsvp, meal]) => (
          <div key={name} className="flex items-center gap-3 px-3.5 py-2" style={{ borderColor: LINE }}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: SAGE, color: INK }}>
              {name.split(" ").map((n) => n[0]).join("")}
            </span>
            <p className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: INK }}>{name}</p>
            <span className="text-[9.5px]" style={{ color: MUTED }}>{meal}</span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={rsvp === "Ja" ? { backgroundColor: SAGE, color: INK } : { backgroundColor: "#f5ece4", color: TERRA }}>
              {rsvp}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px]" style={{ color: MUTED }}>Svar, menuvalg og ledsagere opdaterer sig selv, når gæsterne svarer</p>
    </div>
  );
}

/* ── 07 · Website ─────────────────────────────────────────────────────── */
function WebsiteMockup() {
  return (
    <div className="flex h-full items-stretch gap-3">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border" style={{ borderColor: LINE, backgroundColor: "#fff" }}>
        <div className="flex items-center gap-1.5 border-b px-3 py-1.5" style={{ borderColor: LINE, backgroundColor: SHELL }}>
          <Dot className="bg-[#ddd6c0]" />
          <Dot className="bg-[#cfc8ae]" />
          <span className="ml-1 truncate rounded-full bg-white px-2 py-0.5 text-[8.5px]" style={{ color: MUTED }}>alberte-espen.kalas.dk</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center" style={{ background: "linear-gradient(180deg, #faf7f0, #f1ead9)" }}>
          <p className="text-[8px] font-semibold uppercase tracking-[2px]" style={{ color: TERRA }}>12 · 09 · 2027</p>
          <p className="font-[family-name:var(--font-cormorant)] text-[22px] font-semibold leading-tight" style={{ color: INK }}>Alberte &amp; Espen</p>
          <p className="text-[9px]" style={{ color: MUTED }}>Sandrevlen Badehotel · Bornholm</p>
          <span className="mt-1.5 rounded-full px-3 py-1 text-[8.5px] font-bold uppercase tracking-wide text-[#f7f5ef]" style={{ backgroundColor: INK }}>OSA</span>
        </div>
      </div>
      <div className="flex w-[86px] shrink-0 flex-col justify-between">
        <div className="overflow-hidden rounded-[14px] border p-[3px]" style={{ borderColor: LINE, backgroundColor: "#101010" }}>
          <div className="flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-[11px] px-1.5 text-center" style={{ background: "linear-gradient(180deg, #faf7f0, #eee5d0)" }}>
            <p className="font-[family-name:var(--font-cormorant)] text-[11px] font-semibold leading-tight" style={{ color: INK }}>Alberte<br />&amp; Espen</p>
            <span className="rounded-full px-2 py-0.5 text-[6.5px] font-bold uppercase text-[#f7f5ef]" style={{ backgroundColor: INK }}>OSA</span>
          </div>
        </div>
        <Pill className="justify-center">Live ✓</Pill>
      </div>
    </div>
  );
}

/* ── 08 · Timeline ────────────────────────────────────────────────────── */
function TimelineMockup() {
  const items: [string, string, "done" | "now" | "next"][] = [
    ["Sted booket", "Sandrevlen Badehotel · depositum betalt", "done"],
    ["Book jeres fotograf", "3 tilbud modtaget, vælg i denne uge", "now"],
    ["Send save the date", "Når gæstelisten er på plads", "next"],
    ["Smagsprøve på menuen", "Ava foreslår datoer i marts", "next"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      {items.map(([title, sub, state], i) => (
        <div key={title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
              style={
                state === "done"
                  ? { backgroundColor: INK, color: "#f7f5ef" }
                  : state === "now"
                    ? { backgroundColor: "#fff", color: INK, boxShadow: `inset 0 0 0 2px ${INK}` }
                    : { backgroundColor: SAGE, color: MUTED }
              }
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            {i < items.length - 1 && <span className="w-px flex-1" style={{ backgroundColor: LINE }} />}
          </div>
          <div className={cn("pb-3", state === "now" && "-mx-2 -mt-1 flex-1 rounded-xl px-2 pt-1")}
            style={state === "now" ? { backgroundColor: SAGE } : undefined}>
            <p className="text-[12px] font-semibold" style={{ color: state === "next" ? MUTED : INK }}>
              {title} {state === "now" && <span className="ml-1 rounded-full px-1.5 py-0.5 align-middle text-[8px] font-bold uppercase text-[#f7f5ef]" style={{ backgroundColor: TERRA }}>Nu</span>}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── registry ─────────────────────────────────────────────────────────── */
const MOCKUPS: Record<string, { label: string; Component: () => React.ReactNode }> = {
  meet: { label: "Ava · fra ønske til liste", Component: ChatMockup },
  vendors: { label: "Udforsk · steder, der passer", Component: VendorsMockup },
  outreach: { label: "Henvendelser · godkend før afsendelse", Component: OutreachMockup },
  quotes: { label: "Henvendelser · tilbud sammenlignet", Component: QuotesMockup },
  budget: { label: "Budget · live overblik", Component: BudgetMockup },
  guests: { label: "Gæster · svar live", Component: GuestsMockup },
  website: { label: "Hjemmeside · alberte-espen.kalas.dk", Component: WebsiteMockup },
  timeline: { label: "Planlægning · det næste", Component: TimelineMockup },
};

export function CapabilityMockup({ id }: { id: string }) {
  const entry = MOCKUPS[id] ?? MOCKUPS.meet;
  return (
    <MockShell label={entry.label}>
      <entry.Component />
    </MockShell>
  );
}
