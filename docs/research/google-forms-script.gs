/**
 * Bygger bryllupsundersøgelsen som Google Forms.
 *
 * SÅDAN KØRER DU DET
 * ------------------
 * 1. Gå til https://script.google.com → Nyt projekt
 * 2. Slet indholdet i Code.gs og indsæt hele denne fil
 * 3. Vælg funktionen "byggarSkemaer" i dropdownen øverst → Kør
 * 4. Første gang beder Google om adgang til dine formularer — godkend
 *    (den advarer om "ikke-verificeret app"; det er dit eget script,
 *    klik "Avanceret" → "Fortsæt til projektet")
 * 5. Links til de to formularer skrives i loggen (Ctrl/Cmd + Enter)
 *
 * BAGEFTER, I FORMULAREN SELV
 * ---------------------------
 * - Svar → klik regnearks-ikonet for at koble til Google Sheets
 * - Indstillinger → slå "Begræns til 1 svar" FRA (folk skal ikke logge ind)
 * - Tema → sæt jeres farve og et header-billede
 *
 * NOTER OM TILPASNINGER TIL GOOGLE FORMS
 * --------------------------------------
 * a) Google Forms kan kun forgrene på hele sektioner, ikke skjule enkelte
 *    spørgsmål. Derfor er de betingede spørgsmål (19, 20, 23, 25, 30) lavet
 *    valgfrie med et "ikke relevant"-svar i stedet for at blive skjult.
 * b) Gren A (nygifte) og gren B (planlægger nu) er IKKE bygget som to
 *    parallelle forløb. Ordlyden dækker begge ("var/er"), og spørgsmål 1
 *    registrerer segmentet — så deler du bare data på den kolonne bagefter.
 *    To parallelle grene ville fordoble formularen og give dig to sæt
 *    kolonner, der skal flettes manuelt.
 * c) Kun spørgsmål 1, 2, 3, 7, 8 og 32 er obligatoriske. Resten er valgfrie,
 *    så folk ikke falder fra. 8 er den vigtigste — den må ikke være valgfri.
 */

function byggarSkemaer() {
  var parForm = byggParSkema();
  var levForm = byggLeverandoerSkema();

  Logger.log('PAR-SKEMA');
  Logger.log('  Udfyld:  ' + parForm.getPublishedUrl());
  Logger.log('  Rediger: ' + parForm.getEditUrl());
  Logger.log('');
  Logger.log('LEVERANDØR-SKEMA');
  Logger.log('  Udfyld:  ' + levForm.getPublishedUrl());
  Logger.log('  Rediger: ' + levForm.getEditUrl());
}

// ─────────────────────────────────────────────────────────────────────
//  PAR-SKEMAET
// ─────────────────────────────────────────────────────────────────────

function byggParSkema() {
  var form = FormApp.create('Hvor lang tid tager det at planlægge et bryllup?');

  form.setDescription(
    'Der findes ingen danske tal for det. Det laver vi om på.\n\n' +
    'Vi kortlægger, hvor meget arbejde der reelt ligger i at planlægge et bryllup ' +
    'i Danmark — hvad der tager tid, hvad der driver folk til vanvid, og hvad man ' +
    'godt kunne have undværet.\n\n' +
    'Det tager 6 minutter. I er anonyme. Blandt alle der udfylder, trækker vi lod ' +
    'om et gavekort på 500 kr.\n\n' +
    'Er I to om at planlægge, så udfyld gerne kun én gang pr. par.'
  );

  form.setProgressBar(true);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    'Tusind tak.\n\n' +
    'I har lige hjulpet med at skabe de første rigtige danske tal for, hvad ' +
    'bryllupsplanlægning koster i tid.\n\n' +
    'Lodtrækningen om gavekortet finder sted, når undersøgelsen lukker.\n\n' +
    'Kender I andre, der er ved at planlægge — eller lige er blevet gift? ' +
    'Så del gerne linket.'
  );

  var tal = FormApp.createTextValidation().requireNumber().build();

  // ── Side 1: kun screening-spørgsmålet, så forgreningen rammer med det samme ──

  var q1 = form.addMultipleChoiceItem()
    .setTitle('Hvor er I i processen?')
    .setRequired(true);

  // ── Alle sektioner oprettes nu; navigationen sættes til sidst ──

  var sekOmJer = form.addPageBreakItem()
    .setTitle('Om jer')
    .setHelpText('Først lige et par korte spørgsmål, så vi ved hvem vi taler med.');

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange gæster var I / regner I med at blive?')
    .setChoiceValues(['Under 30', '30-60', '61-100', '101-150', 'Over 150'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Hvad var/er jeres samlede budget for brylluppet?')
    .setChoiceValues([
      'Under 50.000 kr.',
      '50.000-100.000 kr.',
      '100.000-150.000 kr.',
      '150.000-250.000 kr.',
      '250.000-400.000 kr.',
      'Over 400.000 kr.',
      'Vi har ikke sat et budget endnu'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Hvor lang tid gik/går der fra I blev forlovet til bryllupsdagen?')
    .setChoiceValues(['Under 6 måneder', '6-12 måneder', '1-1½ år', '1½-2 år', 'Over 2 år']);

  form.addTextItem()
    .setTitle('Hvad er jeres postnummer?')
    .setHelpText('Valgfrit — vi bruger det kun til at se, om undersøgelsen dækker hele landet.');

  // ── Del 2: tiden ──

  form.addPageBreakItem()
    .setTitle('Tiden')
    .setHelpText('Nu til det, undersøgelsen egentlig handler om.');

  form.addMultipleChoiceItem()
    .setTitle('Hvem stod/står for planlægningen?')
    .setChoiceValues([
      'Mest mig',
      'Vi deler det nogenlunde ligeligt',
      'Mest min partner',
      'En forælder eller anden i familien hjælper meget til',
      'Vi har en professionel planlægger'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange timer vil I anslå, at I samlet har brugt på at planlægge brylluppet?')
    .setHelpText('Er I ikke færdige endnu, så tæl det, I har brugt indtil nu, plus hvad I regner med at bruge.')
    .setChoiceValues([
      'Under 20 timer',
      '20-50 timer',
      '51-100 timer',
      '101-200 timer',
      '201-300 timer',
      'Over 300 timer',
      'Aner det ikke'
    ])
    .setRequired(true);

  var timeKolonner = ['0 timer', 'Under 2', '2-5', '6-15', '16-40', 'Over 40'];

  form.addGridItem()
    .setTitle('Og hvordan fordeler timerne sig? Sæt et cirka-skøn på hver opgave.')
    .setHelpText('Det behøver ikke være præcist — bare jeres bedste bud.')
    .setRows([
      'Finde og researche lokationer',
      'Skrive til lokationer og leverandører for at få tilbud',
      'Vente på svar, rykke, og sammenligne tilbud',
      'Finde fotograf, musik, catering, blomster og kage',
      'Budget — lægge det, opdatere det, holde styr på betalinger',
      'Gæsteliste, adresser, invitationer og opfølgning på svar',
      'Bryllupshjemmeside, ønskeliste og praktisk info til gæsterne',
      'Bordplan',
      'Program og tidsplan for selve dagen',
      'Overnatning til gæsterne',
      'Bryllupsrejsen',
      'Tøj, prøvninger, ringe og skønhed',
      'Ceremoni, taler, ritualer og papirarbejde',
      'Koordinering med familien og forventningsafstemning'
    ])
    .setColumns(timeKolonner)
    .setRequired(true);

  form.addGridItem()
    .setTitle('Og hvor irriterende var opgaverne?')
    .setHelpText('1 = helt fint · 5 = det værste ved hele processen')
    .setRows([
      'Finde og researche lokationer',
      'Skrive til lokationer og leverandører for at få tilbud',
      'Vente på svar, rykke, og sammenligne tilbud',
      'Finde fotograf, musik, catering, blomster og kage',
      'Budget',
      'Gæsteliste og opfølgning på svar',
      'Bryllupshjemmeside og info til gæsterne',
      'Bordplan',
      'Program og tidsplan for dagen'
    ])
    .setColumns(['1', '2', '3', '4', '5']);

  // ── Del 3: leverandørerne ──

  form.addPageBreakItem()
    .setTitle('Leverandørerne')
    .setHelpText('Den del, de fleste undervurderer.');

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange lokationer skrev I til for at få et tilbud?')
    .setChoiceValues(['1-3', '4-6', '7-10', '11-20', 'Over 20', 'Ingen — vi valgte uden at indhente tilbud']);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange leverandører i alt skulle I finde og booke?')
    .setHelpText('Altså fotograf, musik, catering, blomster, kage, transport og hvad I ellers havde.')
    .setChoiceValues(['1-3', '4-6', '7-10', '11-15', 'Over 15']);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange af dem, I skrev til, svarede overhovedet?')
    .setChoiceValues(['Alle', 'De fleste', 'Cirka halvdelen', 'Under halvdelen', 'Næsten ingen']);

  form.addMultipleChoiceItem()
    .setTitle('Hvor lang tid gik der typisk, før I fik svar?')
    .setChoiceValues(['Samme dag', '1-3 dage', '4-7 dage', '1-2 uger', 'Over 2 uger']);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange gange måtte I i gennemsnit rykke for et svar?')
    .setChoiceValues(['0 — de svarede af sig selv', '1 gang', '2 gange', '3 gange eller mere']);

  form.addMultipleChoiceItem()
    .setTitle('På jeres største post — typisk lokation eller mad — hvor mange tilbud endte I med at kunne sammenligne?')
    .setChoiceValues(['Kun 1', '2', '3', '4-5', 'Over 5']);

  form.addCheckboxItem()
    .setTitle('Hvad var sværest ved at indhente tilbud?')
    .setHelpText('Vælg op til 2.')
    .setChoiceValues([
      'At skrive den samme mail igen og igen',
      'At de ikke svarede',
      'At priserne ikke kunne sammenlignes',
      'At finde ud af hvem man overhovedet skulle skrive til',
      'At holde styr på hvem der havde svaret hvad',
      'At forhandle',
      'At vurdere om prisen var rimelig'
    ])
    .showOtherOption(true)
    .setValidation(FormApp.createCheckboxValidation().requireSelectAtMost(2).build());

  form.addMultipleChoiceItem()
    .setTitle('Var der en lokation eller leverandør, I gerne ville have haft, men som var optaget, fordi I var for sent ude?')
    .setChoiceValues(['Ja', 'Nej', 'Ved ikke']);

  // ── Del 4: værktøjer og penge ──

  form.addPageBreakItem().setTitle('Værktøjer og penge');

  form.addCheckboxItem()
    .setTitle('Hvad brugte/bruger I til at holde styr på det hele?')
    .setHelpText('Vælg alle der passer.')
    .setChoiceValues([
      'Regneark',
      'Noter på telefonen',
      'Papirkalender eller en mappe',
      'En bryllupsapp',
      'bryllupsklar.dk',
      'bryllup.dk',
      'Facebook-grupper',
      'Pinterest eller Instagram',
      'ChatGPT eller lignende',
      'En professionel planlægger',
      'Ingenting — vi har det i hovedet'
    ])
    .showOtherOption(true);

  form.addTextItem()
    .setTitle('Hvis I brugte en app eller en side — hvilken?');

  form.addScaleItem()
    .setTitle('Hvor godt fungerede det, I brugte?')
    .setBounds(1, 5)
    .setLabels('Elendigt', 'Perfekt');

  form.addParagraphTextItem()
    .setTitle('Hvad manglede der?')
    .setHelpText('Skriv gerne løs — det er tit her, det interessante ligger.');

  form.addMultipleChoiceItem()
    .setTitle('Har I brugt penge på professionel hjælp til planlægningen?')
    .setChoiceValues([
      'Nej',
      'Ja, en koordinator kun til selve dagen',
      'Ja, en planlægger til hele forløbet',
      'Ja, noget andet'
    ])
    .showOtherOption(false);

  form.addTextItem()
    .setTitle('Hvis ja — hvor meget cirka, i kr.?')
    .setHelpText('Skriv kun tallet. Spring over, hvis I ikke har brugt penge på hjælp.');

  form.addMultipleChoiceItem()
    .setTitle('Overvejede I en bryllupsplanlægger, men droppede det?')
    .setChoiceValues([
      'Nej, det har vi aldrig overvejet',
      'Ja — men det var for dyrt',
      'Ja — men vi ville selv have kontrollen',
      'Ja — men vi kunne ikke finde en, vi havde tillid til',
      'Vi endte faktisk med at hyre en'
    ])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('Er der noget, I endte med at betale for meget for, fordi I ikke havde tid til at undersøge alternativer?')
    .setChoiceValues(['Ja, helt sikkert', 'Ja, måske', 'Nej', 'Ved ikke']);

  form.addTextItem()
    .setTitle('Hvis ja — hvad var det, og hvor meget cirka?');

  // ── Del 5: stress ──

  form.addPageBreakItem()
    .setTitle('Hvordan det føles')
    .setHelpText('Tre hurtige.');

  form.addScaleItem()
    .setTitle('Hvor enig er du: "Planlægningen har givet os stress."')
    .setBounds(1, 5)
    .setLabels('Meget uenig', 'Meget enig');

  form.addScaleItem()
    .setTitle('Hvor enig er du: "Planlægningen har ført til skænderier eller belastet vores forhold."')
    .setBounds(1, 5)
    .setLabels('Meget uenig', 'Meget enig');

  form.addMultipleChoiceItem()
    .setTitle('Har I på noget tidspunkt overvejet at droppe det hele og bare blive gift på rådhuset, fordi planlægningen var for meget?')
    .setChoiceValues(['Ja', 'Nej']);

  // ── Del 6: AI og delegering ──

  form.addPageBreakItem().setTitle('Hvor meget vil I overlade til andre?');

  form.addMultipleChoiceItem()
    .setTitle('Har I brugt AI — ChatGPT eller lignende — til noget i planlægningen?')
    .setChoiceValues(['Ja, en del', 'Ja, lidt', 'Nej, men vi har overvejet det', 'Nej, slet ikke']);

  form.addTextItem()
    .setTitle('Hvis ja — til hvad?');

  form.addGridItem()
    .setTitle('Forestil jer en assistent, der kunne hjælpe jer med brylluppet. Hvor trygge ville I være ved, at den gjorde følgende?')
    .setHelpText('1 = det ville jeg aldrig lade den gøre · 5 = helt fint med mig')
    .setRows([
      'Foreslå lokationer og leverandører, der matcher jer',
      'Skrive forespørgsler til leverandører — som I godkender, før de sendes',
      'Sende forespørgslerne af sted i jeres navn',
      'Læse svarene og trække priserne ud for jer',
      'Svare på et tilbud uden at spørge jer først',
      'Lægge og justere jeres budget',
      'Holde styr på gæstelisten og rykke gæster for svar',
      'Lave et forslag til bordplan',
      'Booke og betale uden at spørge'
    ])
    .setColumns(['1', '2', '3', '4', '5']);

  // ── Del 7: konceptet ──

  form.addPageBreakItem()
    .setTitle('En idé, vi gerne vil høre jeres mening om')
    .setHelpText(
      'Forestil jer en assistent, I skriver til, som var det en besked til en ven.\n\n' +
      'I fortæller om jeres bryllup. Den finder lokationer og leverandører, der passer ' +
      'til jer, skriver ud til dem alle sammen på én gang, samler svarene, trækker ' +
      'priserne ud af mailene og holder undervejs styr på budget, gæsteliste, tidsplan, ' +
      'bryllupshjemmeside og bordplan.\n\n' +
      'I godkender. Den laver arbejdet.'
    );

  form.addScaleItem()
    .setTitle('Hvor sandsynligt er det, at I ville bruge sådan noget?')
    .setBounds(0, 10)
    .setLabels('Slet ikke', 'Helt sikkert')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Hvilke tre dele ville være mest værd for jer?')
    .setHelpText('Vælg præcis 3.')
    .setChoiceValues([
      'Finde lokationer',
      'Skrive til leverandører og indhente tilbud',
      'Samle og sammenligne tilbuddene',
      'Budget og betalingsoversigt',
      'Gæsteliste og svar fra gæsterne',
      'Bryllupshjemmeside og invitationer',
      'Ønskeliste',
      'Bordplan',
      'Tidsplan for både forløbet og selve dagen',
      'Overnatning til gæsterne',
      'Bryllupsrejsen'
    ])
    .setValidation(FormApp.createCheckboxValidation().requireSelectExactly(3).build());

  form.addParagraphTextItem()
    .setTitle('Hvad ville få jer til at lade være?')
    .setHelpText('Vær gerne ærlig — kritik hjælper os mere end ros.');

  form.addTextItem()
    .setTitle('Hvad ville I forvente, sådan noget koster? (kr.)')
    .setValidation(tal);

  form.addTextItem()
    .setTitle('Ved hvilken pris ville det være så dyrt, at I slet ikke ville overveje det? (kr.)')
    .setValidation(tal);

  form.addTextItem()
    .setTitle('Ved hvilken pris ville det være dyrt — men stadig værd at overveje? (kr.)')
    .setValidation(tal);

  form.addTextItem()
    .setTitle('Ved hvilken pris ville det være et godt køb? (kr.)')
    .setValidation(tal);

  form.addTextItem()
    .setTitle('Ved hvilken pris ville I begynde at tvivle på kvaliteten, fordi det var for billigt? (kr.)')
    .setValidation(tal);

  form.addMultipleChoiceItem()
    .setTitle('Hvordan ville I helst betale?')
    .setChoiceValues([
      'Ét fast beløb for hele forløbet',
      'Månedligt abonnement, mens vi planlægger',
      'Gratis for os — lad leverandørerne betale',
      'Gratis basisversion, betaling for det avancerede',
      'Kommer helt an på prisen'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Hvis det kostede 499 kr. i alt — ville I købe det?')
    .setChoiceValues(['Ja, helt sikkert', 'Sandsynligvis', 'Måske', 'Sandsynligvis ikke', 'Nej']);

  form.addTextItem()
    .setTitle('Hvad ville det være værd for jer at spare 40 timers arbejde? (kr.)')
    .setValidation(tal);

  // ── Del 8: afslutning ──

  var sekTilSidst = form.addPageBreakItem().setTitle('Til sidst');

  form.addTextItem()
    .setTitle('Vil I være med til at prøve det, før det åbner for alle?')
    .setHelpText('Skriv jeres mail. Vi skriver kun, når der er noget at prøve — ingen nyhedsbreve.');

  form.addTextItem()
    .setTitle('Må vi ringe til jer i 20 minutter og høre mere?')
    .setHelpText('Mail eller telefon. Vi giver en gave for ulejligheden.');

  form.addParagraphTextItem()
    .setTitle('Er der noget, vi burde have spurgt om?');

  // ── Blindgyde for dem uden for målgruppen ──

  var sekUdenfor = form.addPageBreakItem()
    .setTitle('Tak fordi I kiggede forbi')
    .setHelpText(
      'Undersøgelsen henvender sig til par, der enten er ved at planlægge et bryllup ' +
      'eller er blevet gift inden for de sidste par år — så vi stopper her.\n\n' +
      'Kender I nogen, der passer på beskrivelsen? Så del gerne linket.\n\n' +
      'Tryk "Send" nedenfor.'
    );

  // ── Navigation ──

  // Efter sidste rigtige sektion: aflever, så ingen falder ned i blindgyden.
  sekTilSidst.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  q1.setChoices([
    q1.createChoice('Vi er blevet gift inden for de sidste 2 år', sekOmJer),
    q1.createChoice('Vi planlægger et bryllup lige nu', sekOmJer),
    q1.createChoice('Vi er forlovede, men ikke rigtig gået i gang endnu', sekOmJer),
    q1.createChoice('Ingen af delene', sekUdenfor)
  ]);

  return form;
}

// ─────────────────────────────────────────────────────────────────────
//  LEVERANDØR-SKEMAET
// ─────────────────────────────────────────────────────────────────────

function byggLeverandoerSkema() {
  var form = FormApp.create('Hvor meget tid går der med bryllupsforespørgsler?');

  form.setDescription(
    'Vi undersøger, hvordan bryllupsforespørgsler fungerer i Danmark — set fra ' +
    'jeres side af bordet.\n\n' +
    'Ti spørgsmål, to minutter. I får resultaterne tilsendt, når undersøgelsen ' +
    'er færdig.'
  );

  form.setProgressBar(true);
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('Tak. Vi sender resultaterne, når undersøgelsen lukker.');

  var tal = FormApp.createTextValidation().requireNumber().build();

  form.addMultipleChoiceItem()
    .setTitle('Hvilken slags leverandør er I?')
    .setChoiceValues([
      'Lokation/venue',
      'Fotograf eller video',
      'Catering eller restaurant',
      'Musik eller DJ',
      'Blomster',
      'Kage',
      'Transport'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange bryllupsforespørgsler får I om måneden i højsæsonen?')
    .setChoiceValues(['Under 5', '5-15', '16-30', '31-50', 'Over 50'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Hvor lang tid bruger I i gennemsnit på at besvare én forespørgsel?')
    .setChoiceValues(['Under 5 min.', '5-15 min.', '15-30 min.', '30-60 min.', 'Over en time'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Hvor stor en andel af forespørgslerne bliver til en booking?')
    .setChoiceValues(['Under 10 %', '10-25 %', '26-50 %', '51-75 %', 'Over 75 %']);

  form.addMultipleChoiceItem()
    .setTitle('Hvor mange forespørgsler når I aldrig at svare på?')
    .setChoiceValues(['Ingen', 'Under 10 %', '10-25 %', '26-50 %', 'Over 50 %'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Hvad mangler der typisk i en forespørgsel, før I kan give en pris?')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('Hvor meget hurtigere kunne I svare, hvis dato, gæsteantal og budget altid stod i forespørgslen?')
    .setBounds(1, 5)
    .setLabels('Ingen forskel', 'Kæmpe forskel');

  form.addTextItem()
    .setTitle('Hvad ville en fuldt oplyst forespørgsel være værd for jer? (kr. pr. henvendelse)')
    .setHelpText('Fra et par, der reelt er i markedet, med dato, gæsteantal og budget.')
    .setValidation(tal);

  form.addTextItem()
    .setTitle('Bruger I et system til at håndtere forespørgsler, eller foregår det i mailen?');

  form.addTextItem()
    .setTitle('Må vi kontakte jer, hvis vi har opfølgende spørgsmål?')
    .setHelpText('Skriv jeres mail. Valgfrit.');

  return form;
}
