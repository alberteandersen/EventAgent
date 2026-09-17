# Privatlivspolitik: udkast til juridisk gennemgang

> **Status:** udkast, ikke publiceret. Felter i `[UDFYLD: …]` mangler, og afsnittene
> markeret **Tjek** skal vurderes af en jurist, før teksten lægges på `/privatliv`.
> Beskrivelsen af hvilke data og hvilke leverandører bygger på koden pr. 17. september 2026.

---

## 1. Hvem er dataansvarlig?

Kalas, `[UDFYLD: virksomhedsnavn]`, CVR `[UDFYLD]`, `[UDFYLD: adresse]`.
Kontakt om persondata: `[UDFYLD: e-mail, ikke Avas udgående postkasse]`.

## 2. Hvilke oplysninger behandler vi?

| Hvem | Oplysninger | Hvorfor |
|---|---|---|
| Brugeren (parret) | Navn, e-mail, login via Google eller e-mail, sprog | Konto og login |
| Brugeren | Bryllupsdato, sted, gæstetal, budget, udgifter og betalinger | At planlægge brylluppet |
| Brugeren | Beskeder til Ava (chat) | At Ava kan svare og udføre opgaver |
| Brugeren | Billeder til bryllupshjemmeside og album | At bygge hjemmesiden |
| Gæster | Navn, e-mail, telefon, relation, husstand, aldersgruppe, bord, svar (RSVP), overnatning | Gæsteliste, invitationer og bordplan |
| Gæster | **Allergier, diæter og alkoholfri** | Oversigt til køkkenet. **Tjek:** helbredsoplysninger er følsomme data (GDPR art. 9). Hvilket behandlingsgrundlag, og hvem er dataansvarlig for gæstens data: parret, Kalas eller begge? |
| Gæster | Hilsner i gæstebogen | Vises på parrets hjemmeside |
| Leverandører og lokaler | Navn, e-mail, telefon, adresse, mails og tilbud | Forespørgsler og sammenligning af tilbud |
| Partner | Navn og e-mail ved invitation | Fælles planlægning |

Vi opbevarer ikke kortoplysninger. Betaling sker hos Stripe.

## 3. Behandlingsgrundlag

**Tjek hvert punkt:**
- Kontrakt (art. 6(1)(b)): konto, planlægning, forespørgsler til leverandører
- Legitim interesse (art. 6(1)(f)): sikkerhed og fejlretning
- Samtykke eller andet grundlag for gæsters allergier (art. 9)
- Retlig forpligtelse: bogføring af betalinger

## 4. Hvem deler vi oplysninger med? (databehandlere)

| Leverandør | Hvad de gør | Hvor | Tjek |
|---|---|---|---|
| Supabase | Database, login og filer | `[UDFYLD: projektets region]` | Databehandleraftale |
| Google (Gemini API) | AI: Ava, tekster, hjemmeside og invitationsdesign | USA/EU | Bruges indhold til træning? Databehandleraftale og overførselsgrundlag |
| Google (Gmail API) | Kalas' egen postkasse, som Ava skriver fra og læser svar i | USA/EU | Overførselsgrundlag |
| Google (Places API) | Opslag af lokaler og leverandører | USA/EU | |
| Google (login) | Log ind med Google | USA/EU | |
| Stripe | Betaling for tilvalg (hjemmeside, trykte invitationer) | USA/EU | Selvstændig dataansvarlig for betalingen? |
| Netlify | Hosting af hjemmesiden | USA/EU | Databehandleraftale |
| Render | Baggrundsjob, der henter svar fra postkassen | USA/EU | Databehandleraftale |
| Jina Reader | Henter produktinfo fra links på ønskelisten | `[UDFYLD]` | Sendes der persondata? Kun URL'en |
| Google Fonts | Skrifttyper på parrets offentlige hjemmeside og invitationer | USA | **Tjek:** gæstens IP-adresse sendes til Google, når siden indlæses. Overvej at hoste skrifterne selv |

## 5. Hvor længe gemmer vi oplysningerne?

`[UDFYLD]` **Tjek:** fx så længe kontoen findes plus X måneder efter brylluppet, og regnskabsdata i 5 år efter bogføringsloven.

## 6. Dine rettigheder

Indsigt, berigtigelse, sletning, begrænsning, dataportabilitet og indsigelse. Klage til Datatilsynet, datatilsynet.dk.
`[UDFYLD: hvordan en bruger sletter sin konto, og hvordan en gæst får slettet sine oplysninger]`

## 7. Cookies

Den offentlige hjemmeside og guiden bruger i dag ingen analyse- eller marketingcookies. Login bruger nødvendige cookies (Supabase-session) og en cookie for adgang til kodeordsbeskyttede bryllupssider.
**Tjek igen**, hvis der kommer analytics eller annoncepixels på.

---

### Til jurist: åbne spørgsmål
1. Rollefordeling for gæstedata: er parret dataansvarlig og Kalas databehandler, eller er begge dataansvarlige?
2. Grundlag for allergioplysninger om tredjepersoner, som parret selv indtaster.
3. Overførsel til USA (Google, Stripe, Netlify, Render): EU-US Data Privacy Framework eller standardkontraktbestemmelser.
4. Behøver vi vilkår for leverandører, som Ava skriver til, fx en linje i signaturen om behandlingen af deres svar?
