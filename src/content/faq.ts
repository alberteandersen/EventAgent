import type { FaqGroup } from "./guide/types";

/* The questions couples ask before they sign up, and the ones they search for
   while planning. Answers lead with the answer, so each one still makes sense
   when it is quoted on its own. */

export const FAQ_UPDATED = "2026-09-17";

export const FAQ: FaqGroup[] = [
  {
    id: "om-kalas",
    name: "Om Kalas",
    items: [
      {
        q: "Hvad er Kalas?",
        a: "Kalas er en bryllupsplanlægger på nettet med en AI-assistent, Juno, der gør arbejdet for jer. Juno finder bryllupslokaler, skriver til dem og samler svarene som tilbud, I kan sammenligne. I samme app har I tjekliste, budget, gæsteliste, invitationer, bordplan, program for dagen og bryllupshjemmeside.",
      },
      {
        q: "Hvem er Juno?",
        a: "Juno er Kalas' AI-assistent. I fortæller hende om jeres bryllup, som I ville fortælle en ven, og hun finder lokaler, skriver forespørgsler, læser svarene og holder styr på, hvad der er det næste. Juno foreslår, og I bestemmer.",
      },
      {
        q: "Hvad koster Kalas?",
        a: "Det er gratis at komme i gang, og I skal ikke oplyse et kreditkort. Enkelte tilvalg koster et engangsbeløb, fx at få Juno til at designe jeres bryllupshjemmeside eller at få invitationer trykt. Prisen står tydeligt, før I betaler.",
      },
      {
        q: "Sender Juno mails, uden at vi har godkendt dem?",
        a: "Nej. Juno skriver udkast til forespørgsler og opfølgninger, men intet bliver sendt til et lokale eller en leverandør, før I har godkendt det.",
      },
      {
        q: "Hvem skriver Juno fra, og hvor lander svarene?",
        a: "Juno skriver fra Kalas' egen mailadresse på jeres vegne, så jeres private indbakke ikke bliver fyldt med tilbud. Svarene lander i indbakken i Kalas, hvor Juno trækker pris, ledige datoer og vilkår ud.",
      },
      {
        q: "Kan Kalas finde bryllupslokaler i udlandet?",
        a: "Ja. Juno finder lokaler både i Danmark og i udlandet og skriver til hvert sted på dets eget sprog. Svarene samles som tilbud, så I kan sammenligne et gods på Fyn med en vingård i Toscana. Læs [sådan finder I bryllupslokalet](/guide/find-bryllupslokale).",
      },
      {
        q: "Kan vi planlægge brylluppet sammen?",
        a: "Ja. I inviterer jeres partner, og så arbejder I på det samme bryllup med den samme tjekliste, gæsteliste og budget, hver fra jeres egen konto.",
      },
      {
        q: "Findes Kalas som app på mobilen?",
        a: "Kalas virker i browseren på både computer og mobil. På telefonen kan I lægge Kalas på hjemmeskærmen, så den åbner i fuld skærm som en app. Der er ingen app at hente i App Store eller Google Play.",
      },
      {
        q: "Kan fremmede finde vores bryllupshjemmeside på Google?",
        a: "Nej. Bryllupshjemmesider lavet i Kalas er skjult for søgemaskiner, fordi de indeholder jeres navne, dato og adresser. I deler linket med gæsterne, og I kan også sætte et kodeord på. Læs mere om [bryllupshjemmesider](/guide/bryllupshjemmeside).",
      },
      {
        q: "Hvilke sprog findes Kalas på?",
        a: "Kalas findes på dansk og engelsk. Når Juno skriver til lokaler og leverandører i udlandet, skriver hun på deres sprog.",
      },
    ],
  },
  {
    id: "planlaegning",
    name: "Bryllupsplanlægning",
    items: [
      {
        q: "Hvor lang tid før skal man begynde at planlægge et bryllup?",
        a: "Begynd 12–18 måneder før, hvis I vil giftes en lørdag i sommerhalvåret, fordi de populære lokaler bliver booket først. Et mindre bryllup eller en dato uden for højsæsonen kan sagtens planlægges på 3–6 måneder. Se [tjeklisten måned for måned](/guide/bryllup-tjekliste).",
      },
      {
        q: "Hvad koster et bryllup i Danmark?",
        a: "Et dansk bryllup kan koste alt fra under 50.000 kr. for et lille bryllup til 150.000–250.000 kr. eller mere for en stor fest. Gæstetallet betyder mest, fordi lokale, mad og drikke ofte udgør omkring halvdelen af budgettet. Se [et eksempel på et bryllupsbudget](/guide/hvad-koster-et-bryllup).",
      },
      {
        q: "Hvornår skal man søge om prøvelsesattest?",
        a: "Søg, når der er mindre end 4 måneder til vielsen. Prøvelsesattesten gælder i 4 måneder fra den dag, den er udstedt, og I søger digitalt med en ægteskabserklæring på borger.dk. Læs [sådan bliver I gift i Danmark](/guide/saadan-bliver-i-gift).",
      },
      {
        q: "Hvor mange vidner skal der være til en vielse?",
        a: "Der skal være mindst 2 vidner til både borgerlig og kirkelig vielse. Vidnerne er ofte forlovere, familie eller venner.",
      },
      {
        q: "Kan man blive borgerligt gift uden for rådhuset?",
        a: "Ja. En borgerlig vielse kan foregå andre steder end på rådhuset, fx i en have, en park eller på festens adresse. Mange kommuner tager et gebyr for vielser uden for rådhuset, og prisen afhænger typisk af dag og tidspunkt.",
      },
      {
        q: "Hvornår sender man save the date og invitationer?",
        a: "Send save the date 6–12 måneder før brylluppet, og invitationen 8–12 uger før med svarfrist 4–6 uger før. Skal gæsterne rejse til udlandet, så send save the date 9–12 måneder før. Se [tidsplanen for invitationer](/guide/save-the-date-og-invitationer).",
      },
      {
        q: "Hvornår skal man booke bryllupslokale?",
        a: "Book lokalet 12–18 måneder før, hvis I vil giftes en lørdag fra maj til september. Er I fleksible med dag eller måned, kan I ofte finde et lokale med kortere varsel.",
      },
      {
        q: "Hvilken måned bliver flest gift i?",
        a: "August. Ifølge Danmarks Statistik blev 5.609 par viet i august 2025, svarende til 17 % af årets 32.624 vielser. Maj var den næstmest populære måned med 4.022 par.",
      },
      {
        q: "Hvornår skal bordplanen være klar?",
        a: "Lav bordplanen, når svarfristen er overstået, typisk 2–4 uger før brylluppet, og send den til lokalet sammen med antal kuverter og allergier pr. bord. Se [sådan laver I bordplanen](/guide/bordplan-til-bryllup).",
      },
    ],
  },
];
