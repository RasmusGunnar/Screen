# SUBRA Workplace Arrival Portal (WAP)

En prototypisk webapp bygget til vertikale 16:9 infoskærme. Løsningen kombinerer en pauseskærm med
registrering af medarbejdere og gæster inspireret af funktionaliteten fra Swipedon.

## Funktioner

- **Pauseskærm** med cyklende fuldskærmsslides, velkomst-overlay og glas-effekt.
- **Registrering af medarbejdere**: søg, tjek ind/ud, administrer fravær (sygdom, barsel mv.).
- **Gæsteregistrering** med simuleret notifikation til værten og log over dagens besøgende.
- **Politikaccept**: medarbejdere møder en NDA/IT-politik-modal ved indtjek, og gæster skal acceptere samme
  politikker i formularen.
- **Admin-backend** som selvstændig webapp med login, styring af medarbejdere/slides/QR-links og CSV-eksport.
- **Statistik og rapporter**: Nøgletal, aktivitetslog, brandøvelses-knapper og evakueringsliste i realtid.
- **Synkronisering**: State, medarbejdere og slides gemmes centralt i Firebase Firestore & Storage og opdateres live på
  alle skærme.
- **QR-selvbetjening**: Kioskvisningen viser QR-koder, der kan udskiftes med virksomhedens egne links til hurtig
  check-ind/out og gæsteregistrering.

## Kom godt i gang

1. Kopiér `firebase-config.example.js` til `firebase-config.js` og indsæt nøglerne fra virksomhedens Firebase-projekt.
   Her kan du også ændre hvilken Firestore-collection/dokument kiosken skriver til.
2. Åbn `index.html` i en browser på en 16:9 vertikal skærm. Layoutet er optimeret til 1080×1920.
3. Tryk på pauseskærmen for at gå til registreringsvisningen. Inaktivitet sender brugeren tilbage til
   pauseskærmen automatisk.
4. Brug søgefeltet eller rul gennem afdelingsoversigten for at tjekke medarbejdere ind/ud eller registrere
   fravær.
5. Registrér gæster via formularen. Der logges automatisk en simuleret SMS-notifikation til værten.
6. Åbn `admin.html` (fx via "Admin login"-knappen i kioskheaderen eller direkte i browseren) for at logge ind i
   backend-portalen. Herfra kan du redigere medarbejdere, slides, QR-links og hente rapporter.

## Opdatering af medarbejdere

- **Direkte i adminportalen**: Brug formularen i backend ("Medarbejdere"-panelet) til at tilføje, redigere eller
  slette medarbejdere. Når en medarbejder er valgt til redigering, udfyldes felterne automatisk og gemmes straks i
  Firestore.
- **JSON-import**: Eksportér først eksisterende data for at få strukturen. Redigér filen (tilføj fx nye medarbejdere
  med felterne `firstName`, `lastName`, `department`, `role`, `contact`, `photo`). Importér derefter filen igen – data
  sendes til Firestore i ét hug.
- **Billeder**: Upload medarbejderportrætter til samme Firebase Storage-bucket (fx mappen `/people/`) og indsæt den
  genererede download-URL i feltet “Billede-URL”.
- **Programmatisk**: `window.SUBRA_DEFAULTS` i `defaults.js` kan redigeres for at ændre demo-data, men daglig drift
  klares hurtigst via adminportalen eller import/eksport.

### Vedligeholdelse af politikker

- Alle politikgodkendelser kan nulstilles fra adminportalen via knappen "Politikker" ud for den enkelte medarbejder.
- Politikhistorik gemmes sammen med den øvrige state i Firestore og eksporteres via JSON.

## Pauseskærm & billedbank

- Åbn adminportalen og rul til sektionen **"Pauseskærm & billedbank"** for at redigere overskrift, brødtekst, tema og
  billedmateriale på hvert slide.
- Klik **"Upload"** for at vælge et nyt foto. Filerne gemmes i den Firebase Storage-mappe, der er defineret i
  `firebase-config.js` (standard `/screensaver`). Download-URL'en gemmes i Firestore og distribueres til alle kiosker.
- Brug pileknapperne til at ændre rækkefølgen. Ændringerne skrives direkte til Firestore, så alle enheder straks ser
  samme slide-orden.
- Ønskes en fast standardpakke ved deploy, kan `window.SUBRA_DEFAULTS.slides` i `defaults.js` opdateres – første opstart
  synker disse værdier til skyen, hvis dokumentet er tomt.

> Hvis virksomheden allerede anvender en anden CDN eller DAM, kan upload-funktionen i `handleSlideUploadChange`
> udskiftes, så den peger mod det ønskede API. Behold blot den downloadbare URL i state.

## QR-selvbetjening

- QR-koderne genereres automatisk ud fra URL'erne i adminportalens sektion **"QR-selvbetjening"**.
- Angiv et link til en mobilvenlig medarbejder- eller gæsteformular (fx en hosted version af appen, en
  intranet-PWA eller en Swipedon-løsning). Koderne skabes lokalt i browseren via `qrcodejs` og opdateres på få
  millisekunder.
- Tilføj evt. unikke links, så scanninger registreres i analytics eller direkte i backend.

Gæster og medarbejdere kan altså enten benytte hovedskærmen eller scanne en kode for at tjekke ind/out på deres egen
enhed. Når en gæst registrerer sig via koden, rammer de samme workflow som på skærmen, og værten kan fortsat få en
notifikation via `notifyHost`-hooket.

## Rapporter & statistik

- Adminportalen viser et overblik over nøgletal (på kontoret, remote, fravær, gæster i dag osv.) baseret på Firestore-
  data og den indbyggede log.
- Under **"Aktivitetslog"** kan du filtrere på afdelinger eller hændelsestyper og få vist tidsstemplede events.
- Brug sektionen **"Dataudtræk"** til at downloade CSV med medarbejderstatus og/eller gæstecheck-ins filtreret på
  dato-intervaller og specifikke medarbejdere. Filen kan importeres i Excel, Google Sheets eller BI-systemer.

## Firebase opsætning

- Redigér `firebase-config.js` med nøgler fra [Firebase Console](https://console.firebase.google.com/). Filen må gerne
  ligge offentligt, da nøglerne bruges til klient-tilstand.
- Du kan ændre hvilken collection/dokument appen bruger ved at sætte `window.SUBRA_KIOSK_COLLECTION` og
  `window.SUBRA_KIOSK_DOCUMENT`. Brug dette til at opdele lokationer eller testmiljøer.
- `window.SUBRA_ASSET_FOLDER` bestemmer hvilken mappe i Storage der bruges til slides. Standard er `screensaver`.
- `window.SUBRA_ADMIN_AUTH` definerer hvem der kan logge ind i backend. Brug `firebase-config.example.js` som skabelon
  og udskift `passcodeHash` med en SHA-256-hash af jeres kodeord.
- Sørg for at Firestore og Storage har sikkerhedsregler, der tillader skrivning/læsning for kiosken (fx med App Check
  eller regelsæt målrettet signeret trafik).

## Assets & layout

- Logoet ligger i `assets/logo.svg` og vises nu uden baggrund eller skygge på pauseskærmen, så transparente filer står
  frit oven på billederne.
- Alle slides og medarbejderfotos bør hostes i Firebase Storage eller et tilsvarende CDN. Upload direkte fra
  adminportalen gemmer i Storage, mens medarbejderfotos indsættes som delte URL'er.
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
