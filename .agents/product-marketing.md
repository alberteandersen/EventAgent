# Produkt- og marketingkontekst — Kalas

> Fælles brief. Alle marketing-skills og -agenter læser denne fil først.
> Kilder: `README.md` (produkt/teknik), `docs/markedsundersoegelse.md` (marked, tal, konkurrenter),
> `src/kalas/strings.ts` (produktets faktiske sprog og tone).

## Produktet i én sætning

Kalas er en dansk bryllupsplanlægger, hvor man skriver til en assistent — **Juno** — i stedet for
at udfylde skemaer. Juno søger på nettet efter rigtige lokationer og leverandører, skriver
forespørgsler ud til dem alle på én gang, henter svarene ind fra mailen, trækker priserne ud og
holder styr på budget, gæsteliste, tidslinje, bryllupsside og bordplan undervejs.

**Kernemekanikken der adskiller den fra alt andet på dansk:** parret godkender én mail, og
Juno sender en personlig version til hvert sted, overvåger indbakken og lægger et svarforslag klar.
Konkurrenterne på det danske marked er kataloger og statiske checklister — de *viser* dig arbejdet.
Kalas *gør* arbejdet.

## Navngivning og sprog

- **Kalas** — fra svensk "kalas", en fest. Domæne: `kalas-weddings.com`.
- **Juno** — assistenten. Omtales som en hun i produktets danske tekster ("Juno gennemgår kontrakten
  for jer"). Brug altid navnet Juno, aldrig "AI'en", "botten" eller "agenten" i brugervendt tekst.
- **Dansk er kildesproget.** Engelsk findes som oversættelse (`src/kalas/strings.ts`). Alt
  marketingmateriale skrives på dansk først.
- Produktet tiltaler parret som **I/jer**, aldrig "du" — det er to mennesker der planlægger sammen.

## Tone of voice (destilleret fra produktets egne tekster)

Produktets faktiske stemme, som marketing skal matche:

> "Tidslinjen lægger jeg baglæns fra jeres dato, så I altid ved hvad der haster."
> "Jeg fordeler budgettet på kategorier og siger til, før I rammer loftet."
> "I behøver ikke lede efter knapper. Skriv til mig her, så åbner jeg den rigtige side og laver arbejdet."

Kendetegn:
- **Rolig og konkret.** Beskriver hvad der sker, ikke hvor fantastisk det er.
- **Hverdagsdansk.** "siger til før I rammer loftet", ikke "notificerer ved budgetoverskridelse".
- **Første person, aktiv.** Juno siger "jeg" og "laver arbejdet".
- **Ingen udråbstegn, ingen emoji-spam, ingen bryllupsklichéer.** Ikke "jeres store dag ✨",
  ikke "drømmebryllup", ikke "magisk".
- **Aldrig AI-hype.** Ordene "revolutionerende", "kraftfuld", "problemfri", "game-changer",
  "unlock" er forbudt. Sælg resultatet, ikke teknologien.

## Målgruppe

**Primær (ICP): par midt i planlægningen, bryllup inden for 6-18 måneder, i Danmark.**

- Alder ~30-36 (DST: førstegangsgifte er 33,7 år / 35,7 år).
- Budget 100.000-250.000 kr. Gennemsnittet er 112.000-149.000 kr.
- 60-120 gæster.
- Planlægger primært online (90 % af planlægningen foregår online).
- **Det skarpeste undersegment:** par der *overvejede* en bryllupsplanlægger og droppede den på
  pris. En planlægger koster 8.000-30.000 kr. De har behovet, ikke pengene. Kalas er det segment.
- **Hvem der planlægger:** oftest den ene af de to gør størstedelen. Marketing skal tale til
  personen der bærer arbejdet — og give dem noget de kan vise deres partner.

**Sekundær: leverandører** (venues, fotografer, catering, musik). 64 % oplever at over 40 % af
forespørgsler bliver ghostet; de svarer ikke på forespørgsler uden dato, gæsteantal og budget.
Kalas sender komplette forespørgsler. Det er en tosidet værdipåstand og en mulig indtægtsmodel.

**Ikke målgruppen nu:** rådhusbryllupper under 30 gæster (for lidt at planlægge),
destinationsbryllupper (andet problem), ikke-danske markeder (produktet er dansk-først).

## Beviser vi kan bruge (og hvordan)

Alt fra `docs/markedsundersoegelse.md`. **Vær disciplineret med kilderne** — de internationale
tal er hypoteser, ikke danske facts, og må aldrig præsenteres som danske.

Danske, solide (Danmarks Statistik):
- 32.624 par blev viet i Danmark i 2025. +13 % siden 2015.
- Gennemsnitligt bryllupsbudget 112.000-149.000 kr. 745-1.000 kr pr. gæst.
- August står for 18,8 % af alle vielser; over 70 % ligger på en lørdag. **Sæsonen er brutal og
  kort — det er hele timingargumentet for markedsføringen.**

Internationale, brug som "undersøgelser peger på" — aldrig som danske tal:
- 528 timers planlægning i alt (US, 2019, PR-research — svagest af alle tal, brug med varsomhed).
- 13-14 leverandører pr. bryllup. 6 timer/uge alene på leverandør-research.
- 96 % finder planlægningen stressende; 43 % siger den har belastet parforholdet;
  47 % har overvejet at droppe det og gifte sig på rådhuset.
- 23 % af par bruger allerede AI i planlægningen, 90 % overvejer det.

**Der findes ingen danske tal for planlægningstid.** Egen undersøgelse er i gang
(`docs/spoergeskema.md`). Når den lander, er "de første danske tal for hvor lang tid
bryllupsplanlægning tager" i sig selv en PR-historie og et lead magnet.

## Konkurrenter

| Hvem | Hvad de er | Hullet |
|---|---|---|
| bryllupsklar.dk | Checklister, budget, gæsteliste, forum (~1,3 mio. indlæg) | Statisk. Du gør selv alt arbejdet |
| bryllup.dk | Magasin, messer, leverandørkatalog | Katalog. Du skriver selv til alle |
| The Knot / WeddingWire / Zola | US-duopol, fylder ~73 % af AI-svar om bryllupper | Ikke dansk. Ingen danske venues, ingen dansk sprogforståelse |
| Joy | Har rejst 106,5 mio. USD | Ikke dansk |
| ChatGPT | Bruges allerede af par | Kan rådgive, men kan ikke *sende* noget, huske noget eller følge op |

**Positioneringsakse:** de andre giver dig en liste. Kalas skriver mailen, sender den og henter
svaret. Det er forskellen mellem et værktøj og en assistent.

## Feature-inventar (hvad der findes i produktet i dag)

Venue-søgning · leverandørsøgning (fotograf, musik, catering, blomster) · shortlist ·
automatisk udsendelse af forespørgsler fra fælles Kalas-mailboks · svar-indhentning og
prisudtræk · kontraktgennemgang · budget med auto-fordeling og loft-advarsler · gæsteliste med
CSV-import, RSVP, plus-ens og kostbehov · tidslinje lagt baglæns fra datoen · checkliste ·
invitationer · bryllupsside · ønskeliste/registry · bordplan · overnatning til gæster ·
bryllupsrejse · "Nygift"-skærm til efter brylluppet · team/rollefordeling.

**Hvad der er mest værd i markedsføring** (mest tid + mest irritation, jf. undersøgelsens
figur 2-logik): venue-research, leverandørkontakt, og at vente på/sammenligne tilbud.
Det er de tre. Resten er grunde til at blive, ikke grunde til at komme.

## Nuværende situation og mål

- **Status:** produktet virker end-to-end. Ikke launchet bredt. Innofounder-ansøgning i støbeskeen.
- **Primære mål lige nu: 20-50 aktive beta-par** hele vejen gennem flowet — fra chat til afsendte
  forespørgsler til modtagne tilbud. Ikke tilmeldinger. Ikke omsætning. **Gennemførte forløb.**
- **Budget: 0 kr.** Kun organisk: sociale medier, community, leverandørpartnerskaber, SEO, PR.
- **Kanal-hypoteser fra undersøgelsen:** danske bryllupsgrupper på Facebook (flere med 10-40k
  medlemmer), Instagram via bryllupshashtags og mikro-influencere, bryllupsmesser,
  bryllupsklar.dk-forummet, leverandører der deler linket videre til deres kunder.
- **Prishypoteser der testes:** 499-599 kr engangs, abonnement mens man planlægger, eller gratis
  for parret med leverandørbetaling. Ikke afgjort.

## Regler for alt marketingmateriale

1. **Dansk, og "I/jer" om parret.** Aldrig "du" til et par.
2. **Juno er navnet.** Ikke "AI-assistenten".
3. **Ingen internationale tal fremstillet som danske.** Skriv "undersøgelser fra USA og UK peger på"
   eller lad tallet være.
4. **Ingen bryllupsklichéer og ingen AI-hype.** Se tone of voice.
5. **Sælg de tre timetunge opgaver**, ikke feature-listen.
6. **Beta betyder beta.** Vi lover ikke et færdigt produkt. Ærlighed om at det er tidligt er et
   aktiv i denne fase — det giver folk en grund til at være med nu.
