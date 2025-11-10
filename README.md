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
- **Synkronisering**: State, medarbejdere og slides gemmes på en indbygget Node.js-backend, som alle skærme
  synkroniserer imod.
- **QR-selvbetjening**: Kioskvisningen viser QR-koder, der kan udskiftes med virksomhedens egne links til hurtig
  check-ind/out og gæsteregistrering.

## Kom godt i gang

1. Sørg for at have Node.js ≥18 installeret. Projektet kræver ingen eksterne afhængigheder.
2. Start den lokale backend ved at køre `node server.js`. Serveren starter som udgangspunkt på
   [http://localhost:3000](http://localhost:3000).
3. Besøg `http://localhost:3000` i en browser på en vertikal 16:9 skærm (layoutet er optimeret til 1080×1920).
4. Tryk på pauseskærmen for at gå til registreringsvisningen. Inaktivitet sender brugeren automatisk tilbage til
   pauseskærmen.
5. Registrer medarbejderstatus eller gæster direkte på kioskvisningen. Der logges stadig en simuleret SMS til værten.
6. Klik på "Admin login"-knappen (eller åbn `http://localhost:3000/admin.html`) for at tilgå backend-portalen.
   Standard-login er `admin@subra.dk` / `admin`. Adgangskoden kan ændres i `data/admins.json`.
7. Fra adminportalen kan du redigere medarbejdere, slides, QR-links, politikker, eksportere CSV og synkronisere
   kioskvisningen i realtid via den lokale server.

## Opdatering af medarbejdere

- **Direkte i adminportalen**: Brug formularen i backend ("Medarbejdere"-panelet) til at tilføje, redigere eller
  slette medarbejdere. Når en medarbejder er valgt til redigering, udfyldes felterne automatisk og gemmes straks på
 den lokale server.

> `local-config.js` indeholder kioskens service-token. Skift værdien og den tilhørende miljøvariabel
> `KIOSK_SERVICE_TOKEN`, hvis du vil forhindre uautoriserede opdateringer.
- **JSON-import**: Eksportér først eksisterende data for at få strukturen. Redigér filen (tilføj fx nye medarbejdere
  med felterne `firstName`, `lastName`, `department`, `role`, `contact`, `photo`). Importér derefter filen igen – data
  sendes til backend'en i ét hug.
- **Billeder**: Upload medarbejderportrætter til et valgfrit filbibliotek (fx virksomhedens CDN) og indsæt URL'en i
  feltet “Billede-URL”.
- **Programmatisk**: `window.SUBRA_DEFAULTS` i `defaults.js` kan redigeres for at ændre demo-data, men daglig drift
  klares hurtigst via adminportalen eller import/eksport.

### Vedligeholdelse af politikker

- Alle politikgodkendelser kan nulstilles fra adminportalen via knappen "Politikker" ud for den enkelte medarbejder.
- Politikhistorik gemmes sammen med den øvrige state i den lokale database og eksporteres via JSON.

## Pauseskærm & billedbank

- Åbn adminportalen og rul til sektionen **"Pauseskærm & billedbank"** for at redigere overskrift, brødtekst, tema og
  billedmateriale på hvert slide.
- Klik **"Upload"** for at vælge et nyt foto. Filerne gemmes i mappen `uploads/slides/` på den lokale server, og der
  returneres en offentlig URL som automatisk bruges i kioskvisningen.
- Brug pileknapperne til at ændre rækkefølgen. Ændringerne skrives direkte til serverens state, så alle enheder straks
  ser samme slide-orden.
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

- Adminportalen viser et overblik over nøgletal (på kontoret, remote, fravær, gæster i dag osv.) baseret på den lokale
  state og den indbyggede log.
- Under **"Aktivitetslog"** kan du filtrere på afdelinger eller hændelsestyper og få vist tidsstemplede events.
- Brug sektionen **"Dataudtræk"** til at downloade CSV med medarbejderstatus og/eller gæstecheck-ins filtreret på
  dato-intervaller og specifikke medarbejdere. Filen kan importeres i Excel, Google Sheets eller BI-systemer.

## Assets & layout

- Logoet ligger i `assets/logo.svg` og vises nu uden baggrund eller skygge på pauseskærmen, så transparente filer står
  frit oven på billederne.
- Alle slides gemmes i `uploads/slides/` via backend'en, mens medarbejderfotos typisk hostes eksternt (CDN, DAM eller
  offentlige links) og blot refereres via URL.
- Layoutet er optimeret til 16:9 i højformat (1080×1920). Når appen åbnes på en anden opløsning, centreres den med
  samme proportioner.

## Videre udvikling

- Tilføj integrationer til virksomhedens øvrige systemer (ERP, HR eller adgangskontrol) for avancerede dashboards og
  adgangsstyring.
- Integrér SMS/e-mail notifikationer ved at udvide funktionen `notifyHost` med en egentlig gateway.
- Udvid QR-workflows med mobilvenlige PWA-visninger eller bank-ID for stærk autentifikation.
- Kobling til adgangskontrol eller brandalarmering så hurtig handling påvirker døre og beskeder automatisk.

## Teknologi

- Ren HTML, CSS og JavaScript uden build-step.
- Designstil kombinerer "Apple crisp" (bløde skygger, glas-effekter) og nordisk minimalisme.

## Licens

Projektet er leveret som eksempel og kan frit videreudvikles internt hos SUBRA.
