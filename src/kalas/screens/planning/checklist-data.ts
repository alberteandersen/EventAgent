import type { ChecklistArea } from './shared';

/* The default Danish checklist — the granular layer under the timeline.

   Rule: no title here may restate one of the 14 milestone titles in data.ts.
   The timeline says "Book venue"; the checklist says "Aftal hvornår I må
   rykke ind dagen før". Keeping the layers disjoint is both a UX rule and
   what keeps strings.ts free of duplicate keys (a TS1117 build error).

   Content covers the Danish specifics a generic list misses: prøvelsesattest
   and ægteskabserklæring, salmer and kirkepynt, sanghæfte and indsamlede
   sange, toastmaster, brudevals før midnat, æresport, ris/sæbebobler.

   Every title needs an English entry in strings.ts, TaskRow renders stored
   titles through t(), so an untranslated seed shows up as Danish text in an
   otherwise English list. */

/** When an item is best done, in the same steps as the guide's month-by-month
 *  list (content/guide/articles/bryllup-tjekliste.ts), so the app and the
 *  guide never disagree about when something is due. */
export type Phase = '12-18' | '9-12' | '6-9' | '3-6' | '1-3' | 'maaned' | 'uge' | 'dagen' | 'efter';

export type ChecklistSeed = { area: ChecklistArea; title: string; phase: Phase };

/** Earliest first. `minDays` is how many days before the wedding a phase
 *  starts; each runs until the next one's, so together they cover every day
 *  from long before to long after. Labels are Danish source strings for t(). */
export const PHASES: { id: Phase; label: string; minDays: number }[] = [
  { id: '12-18', label: '12–18 mdr. før', minDays: 365 },
  { id: '9-12', label: '9–12 mdr. før', minDays: 274 },
  { id: '6-9', label: '6–9 mdr. før', minDays: 183 },
  { id: '3-6', label: '3–6 mdr. før', minDays: 91 },
  { id: '1-3', label: '1–3 mdr. før', minDays: 31 },
  { id: 'maaned', label: 'Sidste måned', minDays: 8 },
  { id: 'uge', label: 'Ugen før', minDays: 1 },
  { id: 'dagen', label: 'På dagen', minDays: 0 },
  { id: 'efter', label: 'Efter brylluppet', minDays: -Infinity },
];

export const DEFAULT_CHECKLIST: ChecklistSeed[] = [
  // ── Økonomi & budget ──
  { area: 'okonomi', title: 'Bliv enige om det samlede beløb I vil bruge', phase: '12-18' },
  { area: 'okonomi', title: 'Tal med familien om hvem der bidrager med hvad', phase: '12-18' },
  { area: 'okonomi', title: 'Læg ti procent til side som buffer til uforudsete udgifter', phase: '12-18' },
  { area: 'okonomi', title: 'Opret en fælles konto til bryllupsudgifter', phase: '12-18' },
  { area: 'okonomi', title: 'Saml alle tilbud I har fået hjem ét sted', phase: '9-12' },
  { area: 'okonomi', title: 'Skriv ned hvornår hvert depositum skal betales', phase: '9-12' },
  { area: 'okonomi', title: 'Sæt en påmindelse på hver betalingsfrist', phase: '9-12' },
  { area: 'okonomi', title: 'Tjek om jeres indboforsikring dækker ringe og gaver', phase: '3-6' },
  { area: 'okonomi', title: 'Undersøg afbestillingsforsikring til brylluppet', phase: '12-18' },
  { area: 'okonomi', title: 'Læs det med småt om afbestilling hos hver leverandør', phase: '9-12' },
  { area: 'okonomi', title: 'Regn ud hvor mange gæster budgettet kan bære', phase: '12-18' },
  { area: 'okonomi', title: 'Beslut hvad I hellere vil bruge færre penge på', phase: '12-18' },
  { area: 'okonomi', title: 'Tjek hvad der er inkluderet i prisen og hvad der er tillæg', phase: '9-12' },
  { area: 'okonomi', title: 'Spørg til priser uden for højsæsonen', phase: '12-18' },
  { area: 'okonomi', title: 'Hold øje med hvad I reelt har brugt undervejs', phase: '3-6' },
  { area: 'okonomi', title: 'Sæt penge af til drikkepenge til personalet', phase: 'maaned' },

  // ── Sted & overnatning ──
  { area: 'venue', title: 'Book overnatning til jer selv bryllupsnatten', phase: '9-12' },
  { area: 'venue', title: 'Aftal hvornår I må rykke ind dagen før', phase: '1-3' },
  { area: 'venue', title: 'Aftal hvornår leverandørerne må stille op', phase: '1-3' },
  { area: 'venue', title: 'Tjek om der er parkering nok til gæsterne', phase: '12-18' },
  { area: 'venue', title: 'Spørg til støjgrænser og sluttidspunkt', phase: '12-18' },
  { area: 'venue', title: 'Find overnatning til gæster langvejsfra', phase: '9-12' },
  { area: 'venue', title: 'Bestil transport mellem ceremoni og fest', phase: '6-9' },
  { area: 'venue', title: 'Aftal hvem der rydder op dagen efter', phase: 'maaned' },
  { area: 'venue', title: 'Tjek adgangsforhold for gangbesværede gæster', phase: '12-18' },
  { area: 'venue', title: 'Læg en plan B hvis det regner', phase: '3-6' },
  { area: 'venue', title: 'Få styr på hvad stedet selv stiller med af borde og stole', phase: '9-12' },
  { area: 'venue', title: 'Book telt, varme og lys hvis I holder fest udendørs', phase: '9-12' },
  { area: 'venue', title: 'Tjek at der er strøm nok til band og køkken', phase: '6-9' },
  { area: 'venue', title: 'Aftal et sikkert sted hvor gaverne kan stå', phase: '1-3' },

  // ── Ceremoni & vielse ──
  { area: 'ceremoni', title: 'Book samtale med præsten eller vielsesforretteren', phase: '3-6' },
  { area: 'ceremoni', title: 'Vælg salmer eller musik til ceremonien', phase: '1-3' },
  { area: 'ceremoni', title: 'Aftal hvem der spiller eller synger under vielsen', phase: '3-6' },
  { area: 'ceremoni', title: 'Aftal pynt i kirken eller vielseslokalet', phase: '3-6' },
  { area: 'ceremoni', title: 'Spørg om der må fotograferes under vielsen', phase: '6-9' },
  { area: 'ceremoni', title: 'Beslut hvem der følger bruden ind', phase: '3-6' },
  { area: 'ceremoni', title: 'Aftal rækkefølgen når I går ud', phase: '1-3' },
  { area: 'ceremoni', title: 'Skriv jeres egne løfter hvis I vil sige noget selv', phase: '1-3' },
  { area: 'ceremoni', title: 'Skriv på invitationen hvornår gæsterne skal møde', phase: '3-6' },
  { area: 'ceremoni', title: 'Beslut om der skal kastes ris, blomster eller sæbebobler', phase: '1-3' },
  { area: 'ceremoni', title: 'Tjek om stedet tillader konfetti og riskast', phase: '1-3' },
  { area: 'ceremoni', title: 'Aftal hvem der pynter bilen', phase: '1-3' },
  { area: 'ceremoni', title: 'Aftal hvem der læser op under ceremonien', phase: '1-3' },
  { area: 'ceremoni', title: 'Øv jer i at gå ind i det tempo I gerne vil', phase: 'uge' },
  { area: 'ceremoni', title: 'Aftal et signal hvis I får brug for en pause', phase: 'maaned' },
  { area: 'ceremoni', title: 'Spørg om der er en mikrofon I kan låne', phase: '1-3' },

  // ── Mad & drikke ──
  { area: 'mad', title: 'Aftal prøvesmagning med catering', phase: '3-6' },
  { area: 'mad', title: 'Saml gæsternes allergier og særlige hensyn', phase: '1-3' },
  { area: 'mad', title: 'Beslut om der skal være velkomstdrink', phase: '3-6' },
  { area: 'mad', title: 'Vælg vin til middagen', phase: '3-6' },
  { area: 'mad', title: 'Bestil alkoholfrie alternativer', phase: '1-3' },
  { area: 'mad', title: 'Aftal børnemenu', phase: '3-6' },
  { area: 'mad', title: 'Beslut om der skal serveres natmad', phase: '3-6' },
  { area: 'mad', title: 'Tjek om I selv skal levere drikkevarer', phase: '9-12' },
  { area: 'mad', title: 'Bestil kaffe, te og vand nok til hele aftenen', phase: '1-3' },
  { area: 'mad', title: 'Aftal hvem der skænker op under middagen', phase: '1-3' },
  { area: 'mad', title: 'Aftal hvor mange tjenere der er brug for', phase: '3-6' },
  { area: 'mad', title: 'Bestil kagebord eller dessertbuffet', phase: '6-9' },
  { area: 'mad', title: 'Aftal hvornår maden serveres i forhold til talerne', phase: 'maaned' },
  { area: 'mad', title: 'Tjek om der også skal være mad til leverandørerne', phase: '1-3' },
  { area: 'mad', title: 'Beslut om der skal være snacks mens I fotograferes', phase: '1-3' },
  { area: 'mad', title: 'Aftal hvad der sker med maden der bliver tilovers', phase: 'maaned' },
  { area: 'mad', title: 'Aftal servering af kaffe og avec', phase: '3-6' },

  // ── Tøj & styling ──
  { area: 'stil', title: 'Bestil vielsesringe', phase: '3-6' },
  { area: 'stil', title: 'Bestil gravering i ringene', phase: '3-6' },
  { area: 'stil', title: 'Hent ringene hos guldsmeden', phase: 'maaned' },
  { area: 'stil', title: 'Book tilretning af kjolen hos en systue', phase: '3-6' },
  { area: 'stil', title: 'Hent kjolen fra systuen', phase: 'maaned' },
  { area: 'stil', title: 'Book tid til hår og makeup', phase: '6-9' },
  { area: 'stil', title: 'Aftal prøvetid til hår og makeup', phase: '3-6' },
  { area: 'stil', title: 'Find sko og gå dem til', phase: '1-3' },
  { area: 'stil', title: 'Køb et par ekstra sko I kan holde til at danse i', phase: '1-3' },
  { area: 'stil', title: 'Vælg undertøj der passer til kjolen', phase: '3-6' },
  { area: 'stil', title: 'Bestil brudebuket', phase: '3-6' },
  { area: 'stil', title: 'Aftal knaphulsblomster til forlovere', phase: '3-6' },
  { area: 'stil', title: 'Find noget gammelt, nyt, lånt og blåt', phase: 'maaned' },
  { area: 'stil', title: 'Læg en mønt i brudens sko', phase: 'dagen' },
  { area: 'stil', title: 'Bestil manicure ugen før', phase: 'maaned' },
  { area: 'stil', title: 'Aftal hvem der holder på ringene', phase: 'maaned' },
  { area: 'stil', title: 'Aftal hvem der opbevarer kjolen dagen før', phase: 'maaned' },
  { area: 'stil', title: 'Pak en nødtaske med plaster, nål og tråd', phase: 'uge' },
  { area: 'stil', title: 'Beslut om I skifter tøj til festen', phase: '3-6' },
  { area: 'stil', title: 'Køb tøj til dagen derpå', phase: '1-3' },

  // ── Foto & film ──
  { area: 'foto', title: 'Se hele bryllupper igennem hos fotografen, ikke kun de bedste billeder', phase: '9-12' },
  { area: 'foto', title: 'Aftal hvor mange timer fotografen er med', phase: '9-12' },
  { area: 'foto', title: 'Beslut om I vil have en videograf', phase: '9-12' },
  { area: 'foto', title: 'Beslut om I vil se hinanden inden ceremonien', phase: '3-6' },
  { area: 'foto', title: 'Find gode steder til portrætter i nærheden', phase: '3-6' },
  { area: 'foto', title: 'Læg portrætterne der hvor lyset er bedst', phase: '1-3' },
  { area: 'foto', title: 'Lav en navneliste til gruppebillederne', phase: 'maaned' },
  { area: 'foto', title: 'Bed en i familien om at samle folk til gruppebillederne', phase: 'maaned' },
  { area: 'foto', title: 'Tjek om der må flyves med drone på stedet', phase: '3-6' },
  { area: 'foto', title: 'Aftal hvornår I får billederne', phase: '9-12' },
  { area: 'foto', title: 'Aftal om fotografen må bruge billederne på nettet', phase: '9-12' },
  { area: 'foto', title: 'Beslut om gæsterne må tage billeder under ceremonien', phase: '1-3' },
  { area: 'foto', title: 'Lav et sted hvor gæsterne kan dele deres billeder', phase: '1-3' },
  { area: 'foto', title: 'Overvej engangskameraer eller en fotoboks', phase: '3-6' },
  { area: 'foto', title: 'Sørg for at fotografen får noget at spise', phase: '1-3' },
  { area: 'foto', title: 'Bestil album eller print når billederne er kommet', phase: 'efter' },

  // ── Papir & invitationer ──
  { area: 'papir', title: 'Saml postadresser på alle gæster', phase: '6-9' },
  { area: 'papir', title: 'Bestil frimærker til invitationerne', phase: '3-6' },
  { area: 'papir', title: 'Sæt en frist for svar på invitationen', phase: '3-6' },
  { area: 'papir', title: 'Følg op på gæster der ikke har svaret', phase: '1-3' },
  { area: 'papir', title: 'Skriv menukort', phase: 'maaned' },
  { area: 'papir', title: 'Lav bordkort', phase: 'maaned' },
  { area: 'papir', title: 'Lav en stor bordplan til opslag i festlokalet', phase: 'maaned' },
  { area: 'papir', title: 'Beslut om der skal være program til ceremonien', phase: '1-3' },
  { area: 'papir', title: 'Lav sanghæfte til festen', phase: 'maaned' },
  { area: 'papir', title: 'Sæt en frist for hvornår sange og taler skal sendes til jer', phase: '3-6' },
  { area: 'papir', title: 'Saml sange og taler ind fra gæsterne', phase: '1-3' },
  { area: 'papir', title: 'Lav skilte til vej og velkomst', phase: '1-3' },
  { area: 'papir', title: 'Print køreplanen til personalet', phase: 'uge' },
  { area: 'papir', title: 'Beslut om I vil sætte en annonce i lokalavisen', phase: '1-3' },
  { area: 'papir', title: 'Gør takkekort klar til efter brylluppet', phase: 'maaned' },
  { area: 'papir', title: 'Vælg gæstebog eller et alternativ', phase: '1-3' },

  // ── Gæster & bordplan ──
  { area: 'gaester', title: 'Bliv enige om hvor mange I kan være', phase: '12-18' },
  { area: 'gaester', title: 'Skriv en A-liste og en B-liste over gæster', phase: '12-18' },
  { area: 'gaester', title: 'Beslut om børn er inviteret', phase: '6-9' },
  { area: 'gaester', title: 'Beslut om gæsterne må tage en med', phase: '6-9' },
  { area: 'gaester', title: 'Saml telefonnumre på gæsterne', phase: '6-9' },
  { area: 'gaester', title: 'Hold styr på hvem der har sagt ja og nej', phase: '1-3' },
  { area: 'gaester', title: 'Spørg til allergier allerede når gæsterne svarer', phase: '3-6' },
  { area: 'gaester', title: 'Placer gæsterne så ingen sidder alene', phase: 'maaned' },
  { area: 'gaester', title: 'Beslut om I selv sidder ved et bord med andre', phase: '1-3' },
  { area: 'gaester', title: 'Placer de ældste gæster væk fra højttalerne', phase: 'maaned' },
  { area: 'gaester', title: 'Sæt børnene sammen ved ét bord', phase: 'maaned' },
  { area: 'gaester', title: 'Lav en aktivitetskurv til børnene', phase: 'maaned' },
  { area: 'gaester', title: 'Aftal hvem der tager sig af gæster der ikke kender nogen', phase: 'maaned' },
  { area: 'gaester', title: 'Send praktisk information ud ugen før', phase: 'uge' },
  { area: 'gaester', title: 'Fortæl gæsterne hvordan de skal klæde sig', phase: '3-6' },
  { area: 'gaester', title: 'Aftal hvem der planlægger polterabend', phase: '6-9' },
  { area: 'gaester', title: 'Læg polterabend på en dato der ikke er ugen før', phase: '3-6' },

  // ── Jura & praktik ──
  { area: 'jura', title: 'Udfyld ægteskabserklæringen på borger.dk', phase: '1-3' },
  { area: 'jura', title: 'Bestil prøvelsesattest hos kommunen', phase: '1-3' },
  { area: 'jura', title: 'Tjek at prøvelsesattesten stadig er gyldig på dagen', phase: 'maaned' },
  { area: 'jura', title: 'Bestil tid til selve vielsen', phase: '12-18' },
  { area: 'jura', title: 'Find to vidner', phase: '3-6' },
  { area: 'jura', title: 'Beslut om I skifter efternavn', phase: '3-6' },
  { area: 'jura', title: 'Opret ægtepagt hvis I ønsker det', phase: '3-6' },
  { area: 'jura', title: 'Søg fri fra arbejde til bryllup og rejse', phase: '9-12' },
  { area: 'jura', title: 'Tjek at pas og navn matcher til bryllupsrejsen', phase: '6-9' },
  { area: 'jura', title: 'Bestil visum hvis bryllupsrejsen kræver det', phase: '3-6' },
  { area: 'jura', title: 'Veksl valuta til bryllupsrejsen', phase: 'uge' },
  { area: 'jura', title: 'Hæv kontanter til dem der skal have penge på dagen', phase: 'uge' },
  { area: 'jura', title: 'Aftal betaling og depositum med hver leverandør', phase: '9-12' },
  { area: 'jura', title: 'Opdater forsikringer efter brylluppet', phase: 'efter' },
  { area: 'jura', title: 'Meld navneændring til bank og arbejdsplads', phase: 'efter' },

  // ── Op til dagen ──
  { area: 'optil', title: 'Bekræft antal gæster over for stedet', phase: 'maaned' },
  { area: 'optil', title: 'Send det endelige gæstetal til catering', phase: 'maaned' },
  { area: 'optil', title: 'Ring rundt til alle leverandører ugen før', phase: 'uge' },
  { area: 'optil', title: 'Send adresse og tider til alle leverandører', phase: 'maaned' },
  { area: 'optil', title: 'Læg en tidsplan for morgenen', phase: 'maaned' },
  { area: 'optil', title: 'Aftal hvem der henter hvad dagen før', phase: 'uge' },
  { area: 'optil', title: 'Pak bilen dagen før', phase: 'uge' },
  { area: 'optil', title: 'Print alt det I skal bruge på dagen', phase: 'uge' },
  { area: 'optil', title: 'Tjek vejrudsigten ugen før', phase: 'uge' },
  { area: 'optil', title: 'Køb ind til velkomstkurve eller vandflasker', phase: 'maaned' },
  { area: 'optil', title: 'Prøv hele outfittet på en sidste gang', phase: 'uge' },
  { area: 'optil', title: 'Gå til frisør et par uger før, ikke dagen før', phase: 'maaned' },
  { area: 'optil', title: 'Book noget afslappende ugen før', phase: 'maaned' },
  { area: 'optil', title: 'Sørg for at sove ordentligt de sidste par nætter', phase: 'uge' },
  { area: 'optil', title: 'Lad telefonerne op aftenen før', phase: 'uge' },
  { area: 'optil', title: 'Læg kontanter i kuverter til dem der skal have penge', phase: 'uge' },
  { area: 'optil', title: 'Giv én person ansvaret for spørgsmål på dagen', phase: 'maaned' },
  { area: 'optil', title: 'Skriv en huskeliste til den der hjælper jer på dagen', phase: 'uge' },

  // ── Dagen selv ──
  { area: 'dagen', title: 'Lav en køreplan for dagen', phase: '3-6' },
  { area: 'dagen', title: 'Del køreplanen med alle leverandører', phase: 'maaned' },
  { area: 'dagen', title: 'Aftal hvem der er toastmaster', phase: '12-18' },
  { area: 'dagen', title: 'Brief toastmasteren på hvem gæsterne er', phase: '1-3' },
  { area: 'dagen', title: 'Aftal hvem der holder tale og i hvilken rækkefølge', phase: '1-3' },
  { area: 'dagen', title: 'Øv jeres taler højt', phase: 'uge' },
  { area: 'dagen', title: 'Sørg for at nogen holder øje med tidsplanen', phase: 'maaned' },
  { area: 'dagen', title: 'Vælg musik til jeres indgang', phase: '1-3' },
  { area: 'dagen', title: 'Vælg musik til første dans', phase: '3-6' },
  { area: 'dagen', title: 'Øv jeres første dans', phase: '1-3' },
  { area: 'dagen', title: 'Beslut hvornår brudevalsen skal danses', phase: '1-3' },
  { area: 'dagen', title: 'Aftal hvornår kagen skæres for', phase: 'maaned' },
  { area: 'dagen', title: 'Beslut om brudebuketten skal kastes', phase: '1-3' },
  { area: 'dagen', title: 'Beslut om der skal klippes i gommens sokker', phase: '1-3' },
  { area: 'dagen', title: 'Lav en playliste til festen', phase: '1-3' },
  { area: 'dagen', title: 'Aftal hvem der passer børnene under festen', phase: '1-3' },
  { area: 'dagen', title: 'Aftal hvem der tager imod gaver', phase: 'maaned' },
  { area: 'dagen', title: 'Aftal hvem der skriver ned hvem der har givet hvad', phase: 'maaned' },
  { area: 'dagen', title: 'Lav en liste over billeder I gerne vil have', phase: '1-3' },
  { area: 'dagen', title: 'Sørg for mad til jer selv inden ceremonien', phase: 'dagen' },
  { area: 'dagen', title: 'Pak en taske med skiftetøj og det I skal bruge om morgenen', phase: 'uge' },
  { area: 'dagen', title: 'Aftal hvem der samler tingene sammen til sidst', phase: 'maaned' },
  { area: 'dagen', title: 'Aftal hvem der betaler leverandørerne på dagen', phase: 'maaned' },
  { area: 'dagen', title: 'Beslut hvordan I kommer hjem bagefter', phase: '1-3' },

  // ── Efter brylluppet ──
  { area: 'efter', title: 'Hent gaver og jeres ting på festlokalet dagen efter', phase: 'efter' },
  { area: 'efter', title: 'Betal de sidste regninger til leverandørerne', phase: 'efter' },
  { area: 'efter', title: 'Send takkekort', phase: 'efter' },
  { area: 'efter', title: 'Giv en gave til dem der har hjulpet jer', phase: 'efter' },
  { area: 'efter', title: 'Bestil billederne hos fotografen', phase: 'efter' },
  { area: 'efter', title: 'Få brudebuketten tørret hvis I vil gemme den', phase: 'efter' },
  { area: 'efter', title: 'Læg et stykke kage i fryseren til jeres etårsdag', phase: 'efter' },
  { area: 'efter', title: 'Få kjolen renset og pakket ned', phase: 'efter' },
  { area: 'efter', title: 'Læg billederne op så gæsterne kan se dem', phase: 'efter' },
  { area: 'efter', title: 'Skriv en anmeldelse af de leverandører I var glade for', phase: 'efter' },
  { area: 'efter', title: 'Aflever lejede ting tilbage til tiden', phase: 'efter' },
  { area: 'efter', title: 'Sælg eller giv det væk I ikke skal bruge mere', phase: 'efter' },
  { area: 'efter', title: 'Ret navnet på sygesikringsbevis og kørekort', phase: 'efter' },
  { area: 'efter', title: 'Opdater testamente hvis I har et', phase: 'efter' },
  { area: 'efter', title: 'Sæt en aften af til at se billederne igennem sammen', phase: 'efter' },
  { area: 'efter', title: 'Læg en plan for hvordan I fejrer jeres etårsdag', phase: 'efter' },
];

/** Seed payload for `seedTasks`. Check items carry no date — they are grouped
 *  by area, not by time, so a date would only be noise. */
export function defaultChecklist() {
  return DEFAULT_CHECKLIST.map((item, i) => ({
    title: item.title,
    due_date: null,
    category: item.area,
    kind: 'check' as const,
    done: false,
    sort: i,
  }));
}

/**
 * The default items a couple does not have yet, matched on title. Used to
 * top up an existing checklist when this file grows: resetting would work too,
 * but it throws away every tick and every item they added themselves.
 *
 * `sort` continues after their highest existing value so the new rows land at
 * the bottom of their area instead of shuffling what is already there.
 */
export function missingChecklistItems(existing: { title: string; sort: number }[]) {
  const have = new Set(existing.map((r) => r.title));
  const from = existing.reduce((max, r) => Math.max(max, r.sort), -1) + 1;
  return DEFAULT_CHECKLIST.filter((item) => !have.has(item.title)).map((item, i) => ({
    title: item.title,
    due_date: null,
    category: item.area,
    kind: 'check' as const,
    done: false,
    sort: from + i,
  }));
}

const PHASE_BY_TITLE = new Map(DEFAULT_CHECKLIST.map((item) => [item.title, item.phase]));

/** The phase of a default item, looked up on its seeded title. An item the
 *  couple wrote or renamed has none: there is no honest guess for it. */
export function phaseOf(title: string): Phase | null {
  return PHASE_BY_TITLE.get(title) ?? null;
}

export function phaseLabel(id: Phase): string {
  return PHASES.find((p) => p.id === id)!.label;
}

/** Where the couple is now, given how many days are left to the wedding. */
export function currentPhase(daysLeft: number): Phase {
  return PHASES.find((p) => daysLeft >= p.minDays)!.id;
}
