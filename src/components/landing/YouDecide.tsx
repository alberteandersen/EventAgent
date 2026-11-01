/* The terms of working with her, said plainly: what she never does without a
   yes, whose mailbox the mail leaves from, and that the two of them plan in
   the same wedding. Each term is a card with the piece of the product that
   keeps it: her drafts waiting for approval, her mailbox with the replies in
   it, the two of them talking to the same Juno. */

import { ArrowRight, Check } from "lucide-react";
import { Juno } from "@/components/juno/Juno";

const card = "flex min-w-0 flex-col rounded-[1.75rem] bg-cream p-5 shadow-[0_30px_50px_-38px_rgba(46,63,43,0.6)] sm:p-6";
const well = "flex h-[15.5rem] min-w-0 flex-col justify-center rounded-[1.1rem] border border-border bg-white px-4 py-4 sm:px-5";
const title = "mt-6 font-serif text-[1.75rem] font-semibold leading-[1.08] text-ink";
const text = "mt-2.5 text-[0.98rem] leading-relaxed text-ink-body";

const DRAFTS = [
  { to: "Sandrevlen Badehotel", what: "Forespørgsel · dansk", approved: true },
  { to: "Villa Aurelisa", what: "Forespørgsel · italiensk", approved: true },
  { to: "Ellemose Herregård", what: "Svar på tilbud · dansk", approved: false },
];

const REPLIES = [
  { from: "Sandrevlen Badehotel", says: "Tak for jeres forespørgsel. Vi har ledigt i september", when: "08.02" },
  { from: "Villa Aurelisa", says: "Grazie per la vostra richiesta", when: "i går", lang: "it" },
  { from: "Kløverhøj Lade", says: "Vedhæftet er vores tilbud til 60 gæster", when: "i går" },
];

const initial = "flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-[1rem] font-semibold text-ink";

function Drafts() {
  return (
    <div aria-hidden className={well}>
      <p className="flex items-baseline justify-between text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-accent-ink">
        Junos udkast
        <span className="normal-case tracking-normal text-ink-body">1 venter på jer</span>
      </p>
      <ul className="mt-3 divide-y divide-border">
        {DRAFTS.map((d) => (
          <li key={d.to} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-serif text-[1.05rem] font-semibold leading-tight text-ink">{d.to}</p>
              <p className="truncate text-[0.76rem] text-ink-body">{d.what}</p>
            </div>
            {d.approved ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-laurel px-3 py-1.5 text-[0.76rem] font-semibold text-on-laurel">
                <Check size={13} strokeWidth={3} />
                Godkendt
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-ink/45 px-3 py-1.5 text-[0.76rem] font-semibold text-ink">
                Udkast
                <ArrowRight size={13} strokeWidth={2.4} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mailbox() {
  return (
    <div aria-hidden className={well}>
      <p className="flex items-center justify-between text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-accent-ink">
        Henvendelser
        <span className="rounded-full bg-[#b4483a] px-2 py-0.5 text-[0.68rem] font-bold normal-case tracking-normal text-white">3 nye</span>
      </p>
      <ul className="mt-3 divide-y divide-border">
        {REPLIES.map((r) => (
          <li key={r.from} className="flex items-start gap-2.5 py-2.5">
            <span className="mt-[0.45rem] size-2 shrink-0 rounded-full bg-[#b4483a]" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate font-serif text-[1.05rem] font-semibold leading-tight text-ink">{r.from}</span>
                <span className="shrink-0 text-[0.72rem] tabular-nums text-ink-body">{r.when}</span>
              </p>
              <p lang={r.lang} className="truncate text-[0.76rem] text-ink-body">{r.says}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Together() {
  return (
    <div aria-hidden className={`${well} gap-2.5`}>
      <div className="flex items-end gap-2">
        <span className={`${initial} bg-pistachio`}>E</span>
        <p className="rounded-2xl rounded-bl-md bg-pistachio px-3.5 py-2 text-[0.82rem] leading-snug text-ink">Kan vi blive 70 i stedet for 60?</p>
      </div>
      <div className="flex items-end justify-end gap-2">
        <p className="rounded-2xl rounded-br-md bg-[#c9d3ab] px-3.5 py-2 text-[0.82rem] leading-snug text-ink">Og gerne med overnatning.</p>
        <span className={`${initial} bg-[#c9d3ab]`}>F</span>
      </div>
      <div className="flex items-end gap-1">
        <Juno size={56} shadow={false} look={{ x: 0.7, y: -0.2 }} className="-mb-1 -ml-2 shrink-0" />
        <p className="rounded-2xl rounded-bl-md border border-border px-3.5 py-2 text-[0.82rem] leading-snug text-ink">
          Jeg skriver et udkast til de fire steder, som I kan godkende.
        </p>
      </div>
    </div>
  );
}

export function YouDecide() {
  return (
    <section id="vilkaar" className="scroll-mt-24 bg-pistachio text-ink">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-8 sm:py-32">
        <h2 className="max-w-3xl text-balance font-serif text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.01em] sm:text-6xl">
          I bestemmer. Juno gør arbejdet.
        </h2>

        <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <li className={`${card} md:col-span-2 lg:col-span-1`}>
            <Drafts />
            <h3 className={title}>Intet sendes uden jeres ja.</h3>
            <p className={text}>Hver mail til et sted er et udkast, indtil I har læst og godkendt den. Det gælder også svarene.</p>
          </li>
          <li className={card}>
            <Mailbox />
            <h3 className={title}>Jeres indbakke får fred.</h3>
            <p className={text}>
              Juno skriver fra sin egen postkasse hos Kalas. Svarene samles ét sted i appen, og I får en mail, når der er nyt.
            </p>
          </li>
          <li className={card}>
            <Together />
            <h3 className={title}>Planlæg sammen.</h3>
            <p className={text}>Invitér jeres partner, så ser I det samme bryllup og taler med den samme Juno.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
