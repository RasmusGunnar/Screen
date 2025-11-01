# SUBRA Workplace Arrival Portal (WAP)

En prototypisk webapp bygget til vertikale 16:9 infoskærme. Løsningen kombinerer en pauseskærm med
registrering af medarbejdere og gæster inspireret af funktionaliteten fra Swipedon.

## Funktioner

- **Pauseskærm** med cyklende fuldskærmsslides, velkomst-overlay og glas-effekt.
- **Registrering af medarbejdere**: søg, tjek ind/ud, administrer fravær (sygdom, barsel mv.).
- **Gæsteregistrering** med simuleret notifikation til værten og log over dagens besøgende.
- **Politikaccept**: medarbejdere møder en NDA/IT-politik-modal ved indtjek, og gæster skal acceptere samme
  politikker i formularen.
- **Adminpanel** til at vedligeholde medarbejderlisten direkte fra skærmen eller via import/eksport (JSON).
- **Statistik og sikkerhed**: Live overblik over hvem der er i bygningen, brandøvelses-knapper og
  evakueringsliste.
- **Synkronisering**: Data gemmes i browserens `localStorage`, kan eksporteres/importeres og kan udvides med Firebase
  Storage/Firestore for løbende cloud-synkronisering.
- **QR-selvbetjening**: Kioskvisningen viser QR-koder, der kan udskiftes med virksomhedens egne links til hurtig
  check-ind/out og gæsteregistrering.

## Kom godt i gang

1. Åbn `index.html` i en browser på en 16:9 vertikal skærm. Layoutet er optimeret til 1080×1920.
2. Tryk på pauseskærmen for at gå til registreringsvisningen. Inaktivitet sender brugeren tilbage til
   pauseskærmen automatisk.
3. Brug søgefeltet eller rul gennem afdelingsoversigten for at tjekke medarbejdere ind/ud eller registrere
   fravær.
4. Registrér gæster via formularen. Der logges automatisk en simuleret SMS-notifikation til værten.
5. Åbn adminpanelet (`Admin & sync`), hvor medarbejderlisten kan opdateres, eksporteres eller importeres.

## Opdatering af medarbejdere

- **Direkte i UI**: Brug formularen i adminpanelet til at tilføje, redigere eller slette medarbejdere. Når en
  medarbejder er valgt til redigering, udfyldes felterne automatisk.
- **JSON-import**: Eksportér først eksisterende data for at få strukturen. Redigér filen (tilføj fx nye medarbejdere
  med felterne `firstName`, `lastName`, `department`, `role`, `contact`, `photo`). Importér derefter filen igen.
- **Programmatisk**: `seedEmployees` kan redigeres i `app.js`, men daglig drift klares hurtigst via adminpanelet eller
  import/eksport.

### Vedligeholdelse af politikker

- Alle politikgodkendelser kan nulstilles fra adminpanelet via knappen 📄 ud for den enkelte medarbejder.
- Politikhistorik gemmes sammen med den øvrige state i browseren og eksporteres til JSON.

## Pauseskærm & billedbank

- Åbn adminpanelet og rul til sektionen **"Pauseskærm & billedbank"** for at redigere overskrift, brødtekst, tema og
  billedmateriale på hvert slide.
- Klik **"Upload billede"** for at vælge et nyt foto. Standarden gemmer filen lokalt (base64) og vises straks i
  karusellen.
- Brug pileknapperne til at ændre rækkefølgen. Alle ændringer gemmes automatisk i browseren og kan eksporteres via
  JSON-filen.
- Ønskes en fast standardpakke ved deploy, kan `defaultSlides` i `app.js` opdateres.

### Bedste oplevelse for fælles skærme

- **Lokal lagring (hurtigst)**: Passer til enkeltstående skærme. Billeder gemmes i browseren og kræver manuel import
  på andre enheder.
- **Firebase Storage/Firestore (anbefalet til flere skærme)**: Indtast Firebase-nøglerne i sektionen "Firebase
  opsætning" og aktiver "Synkronisér slides via Firebase". Herefter uploades billederne til Storage og metadata
  gemmes i Firestore, så alle skærme, tablets og mobiler med samme konfiguration opdateres automatisk. Eksisterende
  lokale slides bliver skubbet op første gang, så du får en fælles billedbank.

> Hvis virksomheden allerede anvender en anden CDN eller DAM, kan uploadknappen pege mod en ekstern API i stedet for
> Firebase. Strukturen i `handleSlideUploadChange` gør det nemt at skifte ud.

## QR-selvbetjening

- QR-koderne genereres automatisk ud fra URL'erne i adminpanelets sektion **"QR-selvbetjening"**.
- Angiv et link til en mobilvenlig medarbejder- eller gæsteformular (fx en hosted version af appen, en
  intranet-PWA eller en Swipedon-løsning). Koderne skabes lokalt i browseren via `qrcodejs` og opdateres på få
  millisekunder.
- Tilføj evt. unikke links, så scanninger registreres i analytics eller direkte i backend.

Gæster og medarbejdere kan altså enten benytte hovedskærmen eller scanne en kode for at tjekke ind/out på deres egen
enhed. Når en gæst registrerer sig via koden, rammer de samme workflow som på skærmen, og værten kan fortsat få en
notifikation via `notifyHost`-hooket.

## Assets & layout

- Logoet ligger i `assets/logo.svg`. Billeder, som uploades fra adminpanelet, havner automatisk i browserens storage
  eller i Firebase Storage (hvis aktiveret), så der er ikke længere behov for manuel placering i `assets/`.
- Layoutet er optimeret til 16:9 i højformat (1080×1920). Når appen åbnes på en anden opløsning, centreres den med
  samme proportioner.

## Videre udvikling

- Tilføj backend (f.eks. Firebase, Supabase eller virksomhedens API) for realtids-synkronisering, dashboards og
  adgangsstyring.
- Integrér SMS/e-mail notifikationer ved at udvide funktionen `notifyHost` med en egentlig gateway.
- Udvid QR-workflows med mobilvenlige PWA-visninger eller bank-ID for stærk autentifikation.
- Kobling til adgangskontrol eller brandalarmering så hurtig handling påvirker døre og beskeder automatisk.

## Teknologi

- Ren HTML, CSS og JavaScript uden build-step.
- Designstil kombinerer "Apple crisp" (bløde skygger, glas-effekter) og nordisk minimalisme.

## Licens

Projektet er leveret som eksempel og kan frit videreudvikles internt hos SUBRA.
