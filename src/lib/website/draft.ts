/* Ava's drafts for the site's texts: a welcome line, the couple's story,
   a dresscode and answers to guests' questions. The line she may not cross
   is the one the builder draws everywhere else: nothing about their wedding
   that they did not tell Kalas. So she writes from a list of known facts,
   and the story only from the couple's own answers. Pure: the route
   gathers the facts, this turns them into a prompt and reads the reply. */

export type DraftField = "heroTagline" | "story" | "dresscode" | "faq";

export const DRAFT_FIELDS: DraftField[] = ["heroTagline", "story", "dresscode", "faq"];

export interface DraftFacts {
  names: string;
  dateLabel: string;
  season: string;
  venue: string;
  region: string;
  guestCount: number | null;
  style: string;
  program: { time: string; title: string; place: string }[];
  rsvpDeadline: string;
  transport: string;
  dresscode: string;
  hotels: string[];
  contact: string;
  hasRegistry: boolean;
  giftsText: string;
  language: "da" | "en";
}

/** The couple's own words for the story: how they met, and so on. */
export interface StoryAnswers {
  met?: string;
  knew?: string;
  ahead?: string;
}

export interface DraftFaqItem {
  id?: string;
  q: string;
  a: string;
}

const line = (label: string, value: string | number | null | undefined) =>
  value === null || value === undefined || String(value).trim() === "" ? `- ${label}: (ikke oplyst)` : `- ${label}: ${value}`;

/** Only what Kalas knows. "(ikke oplyst)" marks what Ava must not fill in. */
export function factsText(f: DraftFacts): string {
  return [
    line("Parret", f.names),
    line("Dato", f.dateLabel),
    line("Årstid", f.season),
    line("Sted", f.venue),
    line("Region", f.region),
    line("Antal gæster", f.guestCount),
    line("Stil og stemning", f.style),
    f.program.length
      ? `- Program:\n${f.program.map((p) => `  ${p.time} ${p.title}${p.place ? `, ${p.place}` : ""}`).join("\n")}`
      : line("Program", ""),
    line("Svarfrist for RSVP", f.rsvpDeadline),
    line("Adresse/transport", f.transport),
    line("Dresscode", f.dresscode),
    line("Overnatning", f.hotels.join("; ")),
    line("Kontakt på dagen", f.contact),
    line("Ønskeliste på siden", f.hasRegistry ? "ja" : ""),
    line("Tekst om gaver", f.giftsText),
  ].join("\n");
}

const RULES = `Regler, uden undtagelse:
- Brug KUN fakta fra listen. Står der "(ikke oplyst)", ved du det ikke, og du må ikke gætte:
  ingen adresser, tider, datoer, priser, parkering, børn, taler eller andet, du ikke har fået.
- Skriv varmt, personligt og kort, som parret selv ville sige det, i "vi"-form.
- Ingen klichéer som "eventyr", "for evigt" eller "den store dag".`;

/** The system instruction and the user turn for one draft. */
export function draftPrompt(
  field: DraftField,
  facts: DraftFacts,
  extra: { story?: StoryAnswers; faq?: DraftFaqItem[] } = {},
): { system: string; user: string } {
  const lang = facts.language === "en" ? "engelsk" : "dansk";
  const system = `Du er Ava og hjælper et brudepar med teksterne til deres bryllupsside. Skriv på ${lang}.\n\n${RULES}`;
  const known = `Det ved Kalas om brylluppet:\n${factsText(facts)}`;

  switch (field) {
    case "heroTagline":
      return { system, user: `${known}\n\nSkriv én kort velkomstlinje til forsiden, under navnene: højst 10 ord, en invitation til gæsterne. Svar i "text".` };
    case "story": {
      const a = extra.story ?? {};
      return {
        system,
        user: `${known}

Parrets egne svar:
- Hvordan de mødtes: ${a.met?.trim() || "(ikke oplyst)"}
- Hvornår de vidste det: ${a.knew?.trim() || "(ikke oplyst)"}
- Hvad de glæder sig til: ${a.ahead?.trim() || "(ikke oplyst)"}

Skriv "Vores historie" til siden ud fra deres svar: 3-5 sætninger, gerne i to korte afsnit adskilt af en tom linje. Brug kun det, de har fortalt; pynt ikke på med detaljer, de ikke har nævnt. Svar i "text".`,
      };
    }
    case "dresscode":
      return {
        system,
        user: `${known}

Foreslå en dresscode-tekst til gæsterne: 1-3 sætninger, der passer til stilen, stedet og årstiden. Det er en opfordring, ikke et faktum om stedet: skriv ikke, at noget foregår udendørs eller på græs, medmindre det står i listen. Svar i "text".`,
      };
    case "faq": {
      const current = (extra.faq ?? []).filter((f) => f.q.trim());
      return {
        system,
        user: `${known}

Parrets spørgsmål til gæsterne (id: spørgsmål = nuværende svar):
${current.length ? current.map((f) => `${f.id}: ${f.q} = ${f.a.trim() || "(intet svar)"}`).join("\n") : "(ingen endnu)"}

Svar i "faq":
1. For hvert af deres spørgsmål uden svar: medtag det med samme id og et kort svar, hvis listen giver svaret. Giver den ikke svaret, så udelad spørgsmålet.
2. Foreslå derudover højst 3 nye spørgsmål, gæster ofte stiller, men KUN dem du kan svare på ud fra listen (fx svarfrist, sted, hvornår det starter). Nye spørgsmål har intet id.
Rør ikke spørgsmål, der allerede har et svar.`,
      };
    }
  }
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The model's reply, cut down to what the builder can use. */
export function readDraft(field: DraftField, raw: unknown, knownIds: string[] = []): { text?: string; faq?: DraftFaqItem[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { text?: unknown; faq?: unknown };
  if (field !== "faq") {
    const text = clip(r.text, field === "story" ? 1500 : 400);
    return text ? { text } : {};
  }
  const ids = new Set(knownIds);
  const items = (Array.isArray(r.faq) ? r.faq : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ id: clip(x.id, 80), q: clip(x.q, 200), a: clip(x.a, 600) }))
    .filter((x) => x.a && (ids.has(x.id) || x.q))
    .map((x) => (ids.has(x.id) ? { id: x.id, q: x.q, a: x.a } : { q: x.q, a: x.a }));
  return { faq: items.slice(0, 12) };
}

/**
 * Ava's answers folded into the couple's list: an answer lands only where
 * theirs is blank, and a new question only if they do not already ask it.
 * Nothing they wrote is ever replaced.
 */
type FaqRow = { id: string; q: string; a: string };

export function mergeFaqDraft(current: FaqRow[], draft: DraftFaqItem[], newId: (i: number) => string): FaqRow[] {
  const byId = new Map(draft.filter((d) => d.id).map((d) => [d.id as string, d]));
  const merged: FaqRow[] = current.map((f) => {
    const d = byId.get(f.id);
    return d && !f.a.trim() ? { ...f, a: d.a } : f;
  });
  const asked = new Set(merged.map((f) => f.q.trim().toLowerCase()));
  draft
    .filter((d) => !d.id && d.q.trim() && !asked.has(d.q.trim().toLowerCase()))
    .forEach((d, i) => merged.push({ id: newId(i), q: d.q, a: d.a }));
  return merged;
}
