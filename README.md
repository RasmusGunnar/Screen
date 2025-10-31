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
- **Synkronisering**: Data gemmes i browserens `localStorage` og kan udveksles mellem enheder via eksport- og
  importfunktion. I produktion kan dette erstattes af en delt backend.
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
- **Programmatisk**: `seedEmployees` og `screensaverSlides` kan redigeres i `app.js` hvis man ønsker statisk
  tilretning inden deploy.

### Vedligeholdelse af politikker

- Alle politikgodkendelser kan nulstilles fra adminpanelet via knappen 📄 ud for den enkelte medarbejder.
- Politikhistorik gemmes sammen med den øvrige state i browseren og eksporteres til JSON.

### Pauseskærm og billeder

- Standardbillederne hentes fra Unsplash gennem konfigurationen i `screensaverSlides` (feltet `image`). Udskift
  URL'erne med egne billeder eller pegende på filer i mappen `assets/`.
- Logoet samt QR-koderne til selvbetjening ligger i `assets/`. Erstat `assets/logo.svg`, `assets/qr-employee.svg`
  og `assets/qr-guest.svg` med virksomhedens egne filer for at tilpasse udtrykket.
- Layoutet er optimeret til 16:9 i højformat (1080×1920). Når appen åbnes på en anden opløsning, centreres den
  med samme proportioner.

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
