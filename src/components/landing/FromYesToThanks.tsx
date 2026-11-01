/* Everything else she keeps, in the order a wedding needs it: from the yes to
   the thank-you card. It reads as her running list rather than a grid of
   features, because that is what it is in the app: one plan, phase by phase. */

import { Juno } from "@/components/juno/Juno";
import { CapabilityMockup } from "./CapabilityMockups";

type Entry = { what: string; how: string; paid?: boolean };
type Phase = { when: string; entries: Entry[]; screens?: string[] };

const PHASES: Phase[] = [
  {
    when: "Et år før",
    entries: [
      {
        what: "Planen",
        how: "En plan fra i dag til dagen, delt i faser med datoer. Bed Juno tilføje, flytte eller krydse af, så gør hun det.",
      },
      {
        what: "Budgettet",
        how: "Fordel pengene på poster, og lad Juno foreslå en fordeling. Læg en kontrakt op, så læser hun den igennem med jer.",
      },
    ],
    screens: ["timeline", "budget"],
  },
  {
    when: "Otte måneder før",
    entries: [
      {
        what: "Gæstelisten",
        how: "Navne, husstande, børn og overnatning samlet ét sted. Giv Juno listen, som I har den, så skriver hun den ind.",
      },
      {
        what: "Hjemmesiden",
        how: "Juno bygger jeres bryllupsside ud fra jeres billeder. Gæsterne svarer dér, og svarene lander i gæstelisten med menuvalg og allergier.",
        paid: true,
      },
      {
        what: "Invitationen",
        how: "Et trykt kort, designet sammen med Juno. I henter det som fil til trykkeriet eller til Canva.",
        paid: true,
      },
      {
        what: "Ønskelisten",
        how: "Indsæt links til det, I ønsker jer. Gæsterne reserverer på hjemmesiden, så I ikke får tre ens vaser.",
      },
    ],
    screens: ["website", "guests"],
  },
  {
    when: "To måneder før",
    entries: [
      {
        what: "Bordplanen",
        how: "Træk gæsterne på plads ved bordene, og print planen. På hjemmesiden kan hver gæst finde sit bord.",
      },
      {
        what: "Dagens program",
        how: "Dagen kvarter for kvarter, delt med fotograf, toastmaster og familie med ét link.",
      },
    ],
  },
  {
    when: "Bagefter",
    entries: [
      {
        what: "Takkekortene",
        how: "En liste over, hvem der gav hvad, og et takkekort i samme stil som invitationen.",
      },
      {
        what: "Billederne",
        how: "Gæsterne lægger deres billeder fra dagen i ét album, som I deler med et link.",
      },
    ],
  },
];

export function FromYesToThanks() {
  return (
    <section id="resten" className="scroll-mt-24 bg-cream">
      <div className="mx-auto grid max-w-7xl gap-x-16 gap-y-14 px-6 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Juno size={140} look={{ x: 0.7, y: 0.35 }} />
          <h2 className="mt-8 text-balance font-serif text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.01em] text-ink sm:text-6xl">
            Fra ja <span className="text-accent">til tak.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-body sm:text-[17px]">
            Stedet er kun begyndelsen. Juno har resten af brylluppet samme
            sted, så en gæst, et beløb eller et bord kun skal skrives ind én
            gang.
          </p>
        </div>

        <ol>
          {PHASES.map((phase) => (
            <li key={phase.when} className="border-t border-border-strong py-10 first:border-t-0 first:pt-0 last:pb-0">
              <p className="font-serif text-[1.7rem] font-semibold italic leading-none text-accent-ink">{phase.when}</p>
              <dl className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {phase.entries.map((e) => (
                  <div key={e.what}>
                    <dt className="flex items-baseline gap-2.5 font-serif text-[1.45rem] font-semibold leading-tight text-ink">
                      {e.what}
                      {e.paid && (
                        <span className="rounded-full border border-border-strong px-2 py-0.5 font-sans text-[0.68rem] font-semibold text-ink-body">
                          499 kr.
                        </span>
                      )}
                    </dt>
                    <dd className="mt-2 text-[0.95rem] leading-relaxed text-ink-body">{e.how}</dd>
                  </div>
                ))}
              </dl>
              {phase.screens && (
                <div className="mt-9 grid gap-5 sm:grid-cols-2">
                  {phase.screens.map((id) => (
                    <div key={id} className="min-w-0 shadow-[0_22px_48px_-30px_rgba(74,78,60,0.4)]">
                      <CapabilityMockup id={id} />
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
