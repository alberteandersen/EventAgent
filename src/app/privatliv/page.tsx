import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideFooter, GuideNav } from "@/components/guide/GuideChrome";
import { PRIVACY, PRIVACY_POLICY_LIVE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privatlivspolitik · Kalas",
  description: "Hvilke oplysninger Kalas behandler om par, gæster og leverandører, hvorfor, og hvem vi deler dem med.",
  alternates: { canonical: "/privatliv" },
};

/* The policy as couples and guests read it. It 404s in production until
   src/lib/legal.ts is filled in and reviewed; in development it renders with
   the missing answers marked, so it can be read and sent to the lawyer. */

function Field({ value, name }: { value: string | null; name: string }) {
  if (value) return <>{value}</>;
  return <mark className="rounded bg-terracotta-tint px-1 text-terracotta">[mangler: {name}]</mark>;
}

const DATA: [who: string, what: string, why: string][] = [
  ["Parret", "Navn, e-mail, login via Google eller e-mail, sprog", "Konto og login"],
  ["Parret", "Bryllupsdato, sted, gæstetal, budget, udgifter og betalinger", "At planlægge brylluppet"],
  ["Parret", "Beskeder til Ava", "At Ava kan svare og udføre opgaver"],
  ["Parret", "Billeder til bryllupshjemmesiden og albummet", "At bygge hjemmesiden"],
  ["Gæster", "Navn, e-mail, telefon, relation, husstand, aldersgruppe, bord, svar, overnatning", "Gæsteliste, invitationer og bordplan"],
  ["Gæster", "Allergier, kostbehov og alkoholfri", "Et overblik til køkkenet"],
  ["Gæster", "Hilsner i gæstebogen", "Vises på parrets hjemmeside"],
  ["Leverandører og steder", "Navn, e-mail, telefon, adresse, mails og tilbud", "Forespørgsler og sammenligning af tilbud"],
  ["Partner", "Navn og e-mail ved invitation", "Fælles planlægning"],
];

const PROCESSORS: [who: string, what: string][] = [
  ["Supabase", "Database, login og filer"],
  ["Google (Gemini API)", "Ava, tekster og design af hjemmeside og invitationer"],
  ["Google (Gmail API)", "Kalas' egen postkasse, som Ava skriver fra og læser svar i"],
  ["Google (Places API)", "Opslag af steder og leverandører"],
  ["Google (login)", "Log ind med Google"],
  ["Google Fonts", "Skrifttyper på parrets offentlige hjemmeside og invitationer"],
  ["Stripe", "Betaling for AI-designeren til hjemmeside og invitationer"],
  ["Netlify", "Hosting af Kalas og baggrundsjob"],
  ["GitHub Actions", "Jobbet, der henter leverandørernes svar fra postkassen"],
  ["Jina Reader", "Henter produktinfo fra links på ønskelisten; kun linket sendes"],
];

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-title text-ink">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-micro font-semibold uppercase tracking-[0.12em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 ? "px-4 py-3 font-medium text-ink" : "px-4 py-3 text-ink-soft"}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  if (!PRIVACY_POLICY_LIVE && process.env.NODE_ENV === "production") notFound();

  return (
    <div className="theme-kalas flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <GuideNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-14 sm:px-6">
        <header>
          <h1 className="font-serif text-page tracking-[-0.02em] text-ink">Privatlivspolitik</h1>
          <p className="mt-3 text-meta text-muted">
            Hvilke oplysninger Kalas behandler, hvorfor, og hvem vi deler dem med.
          </p>
        </header>

        <Section n={1} title="Hvem er dataansvarlig?">
          <p>
            <Field value={PRIVACY.company} name="virksomhedsnavn" />, CVR <Field value={PRIVACY.cvr} name="CVR" />,{" "}
            <Field value={PRIVACY.address} name="adresse" />.
          </p>
          <p>
            Skriv til <Field value={PRIVACY.email} name="e-mail" /> om alt, der handler om jeres oplysninger.
          </p>
        </Section>

        <Section n={2} title="Hvilke oplysninger behandler vi?">
          <Table head={["Hvem", "Oplysninger", "Hvorfor"]} rows={DATA} />
          <p>
            <Field value={PRIVACY.guestDataRole} name="rollefordeling for gæsternes oplysninger" />
          </p>
          <p>Vi gemmer ikke kortoplysninger. Betalingen sker hos Stripe.</p>
        </Section>

        <Section n={3} title="Behandlingsgrundlag">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Kontrakt (art. 6, stk. 1, litra b): kontoen, planlægningen og forespørgsler til leverandører.</li>
            <li>Legitim interesse (art. 6, stk. 1, litra f): sikkerhed og fejlretning.</li>
            <li>Retlig forpligtelse (art. 6, stk. 1, litra c): bogføring af betalinger.</li>
            <li>
              Gæsters allergier og kostbehov: <Field value={PRIVACY.guestHealthBasis} name="grundlag efter art. 9" />
            </li>
          </ul>
        </Section>

        <Section n={4} title="Hvem deler vi oplysninger med?">
          <p>
            Vi bruger disse leverandører til at drive Kalas. De behandler kun oplysningerne for os. Databasen ligger i{" "}
            <Field value={PRIVACY.databaseRegion} name="Supabase-region" />.
          </p>
          <Table head={["Leverandør", "Hvad de gør"]} rows={PROCESSORS} />
          <p>
            Nogle af dem er amerikanske. <Field value={PRIVACY.transferBasis} name="overførselsgrundlag" />
          </p>
        </Section>

        <Section n={5} title="Hvor længe gemmer vi oplysningerne?">
          <p>
            <Field value={PRIVACY.retention} name="opbevaringsperiode" />
          </p>
        </Section>

        <Section n={6} title="Jeres rettigheder">
          <p>
            I har ret til indsigt, berigtigelse, sletning, begrænsning, dataportabilitet og indsigelse. I kan klage til
            Datatilsynet på{" "}
            <a href="https://www.datatilsynet.dk" className="font-semibold text-ink underline decoration-sage decoration-2 underline-offset-4" rel="noopener">
              datatilsynet.dk
            </a>
            .
          </p>
          <p>
            <Field value={PRIVACY.deletion} name="sådan sletter man kontoen og gæsters oplysninger" />
          </p>
        </Section>

        <Section n={7} title="Cookies">
          <p>
            Kalas bruger ingen analyse- eller marketingcookies. Login bruger nødvendige cookies til sessionen, og en
            kodeordsbeskyttet bryllupsside bruger en cookie til at huske, at I har skrevet koden.
          </p>
        </Section>
      </main>
      <GuideFooter />
    </div>
  );
}
