# SUBRA Workplace Arrival Portal (WAP)

En prototypisk webapp bygget til vertikale 16:9 infoskærme. Løsningen kombinerer en pauseskærm med
registrering af medarbejdere og gæster inspireret af funktionaliteten fra Swipedon.

## Funktioner

- **Pauseskærm** med cyklende fuldskærmsslides og velkomst-overlay.
- **Registrering af medarbejdere**: søg, tjek ind/ud, administrer fravær (sygdom, barsel mv.).
- **Gæsteregistrering** med simuleret notifikation til værten og log over dagens besøgende.
- **Adminpanel** til at vedligeholde medarbejderlisten direkte fra skærmen eller via import/eksport (JSON).
- **Statistik og sikkerhed**: Live overblik over hvem der er i bygningen, brandøvelses-knapper og
  evakueringsliste.
- **Synkronisering**: Data gemmes i browserens `localStorage` og kan udveksles mellem enheder via eksport- og
  importfunktion. I produktion kan dette erstattes af en delt backend.

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

## Videre udvikling

- Tilføj backend (f.eks. Firebase, Supabase eller virksomhedens API) for realtids-synkronisering, dashboards og
  adgangsstyring.
- Integrér SMS/e-mail notifikationer ved at udvide funktionen `notifyHost` med en egentlig gateway.
- Tilføj QR-kode login og NDA-signatur, inspireret af Swipedon.
- Kobling til adgangskontrol eller brandalarmering så hurtig handling påvirker døre og beskeder automatisk.

## Teknologi

- Ren HTML, CSS og JavaScript uden build-step.
- Designstil kombinerer "Apple crisp" (bløde skygger, glas-effekter) og nordisk minimalisme.

## Licens

Projektet er leveret som eksempel og kan frit videreudvikles internt hos SUBRA.
