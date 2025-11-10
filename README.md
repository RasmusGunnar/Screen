# SUBRA Workplace Arrival Portal (WAP)

En plug-and-play kiosk- og adminløsning til vertikale 16:9 infoskærme, nu drevet af Firebase. Kiosken viser
overblikket for medarbejdere og gæster, mens adminportalen giver fuld kontrol over data, slides og politikker – alt
gemmes i Firestore og billeder placeres i Firebase Storage, så løsningen kan hostes statisk (fx på GitHub Pages).

## Funktioner

- **Pauseskærm** med cyklende fuldskærms­slides, velkomst-overlay og glas-effekt.
- **Medarbejderstatus**: søg, tjek ind/ud, registrér fravær og noter.
- **Gæsteregistrering** med krav om NDA/IT-politik og log over besøgende.
- **Adminportal** (selvstændig webapp) med login, styring af medarbejdere/slides/QR-links og CSV-eksport.
- **Realtime-synkronisering** via Firestore (enten live-lytning eller fallback med polling).
- **Firebase Storage-integration** til slides/billeder direkte fra browseren.
- **QR-selvbetjening**: generer QR-koder til medarbejder- og gæsteflows.

## Arkitektursoverblik

```
Kiosk (index.html + app.js) ┐        ┌── Firestore (kiosks/<ID>)
                            ├───────┤
Admin (admin.html + admin.js)┘        └── Firebase Storage (screensaver/<ID>)
                                      └── Firebase Auth (E-mail/Password + Anonymous)
```

- `firebase-config.js` rummer projektets Firebase-konfiguration (API-key m.m.).
- `local-config.js` definerer hvilke Firestore-dokumenter og Storage-mapper kiosken/admin skal arbejde mod.
- `firebase-adapter.js` er et tyndt lag oven på Firebase SDK'erne og bruges af både kiosk og admin.
- Alle filer er rene HTML/CSS/JS og kan derfor hostes statisk (GitHub Pages, Netlify, Vercel Static osv.).

## Opsætning: trin-for-trin guide

> Guiden er tænkt som “copy-paste” reference til både udviklere og ikke-udviklere. Hvert punkt forklarer **hvad** du
> skal gøre, **hvor** du gør det, og **hvorfor** det er nødvendigt.

### 1. Opret og forbered Firebase-projektet

1. **Opret et nyt projekt i Firebase Console**  
   - _Hvor:_ [https://console.firebase.google.com](https://console.firebase.google.com) → “Add project”.
   - _Hvorfor:_ Projektet samler Auth, Firestore og Storage under ét ID, som webappen senere refererer til.

2. **Tilføj en Web-app til projektet** (`</>`-ikonet under “Build > Get started”).  
   - _Hvor:_ Projektoversigten → knappen “Web”.
   - _Hvorfor:_ Du får den konfigurationsblok (apiKey, authDomain osv.), der skal ind i `firebase-config.js`.
   - _Reference:_ Kopier koden fra trinets popup til `firebase-config.js` (se næste hovedafsnit).

3. **Aktivér Authentication-udbydere**  
   - _Hvor:_ `Build > Authentication > Sign-in method`.
   - _Gør:_ Aktivér **Email/Password** (til adminbrugere) og **Anonymous** (til kiosken).
   - _Hvorfor:_ Kiosken logger ind anonymt og har læse-/skriveadgang til ét Firestore-dokument. Admin-portalen bruger
     email+kode for sikker administration.

4. **Opret minimum én adminbruger**  
   - _Hvor:_ `Authentication > Users > Add user`.
   - _Hvorfor:_ Adminportalen kræver login, før den kan læse/ændre state. Flere admins kan oprettes samme sted.

5. **Opret Cloud Firestore-database**  
   - _Hvor:_ `Build > Firestore Database > Create database` (Production mode anbefales).
   - _Hvorfor:_ Hele kioskens state gemmes i dokumentet `kiosks/<stateDocId>` (navne bestemmes i `local-config.js`).
   - _Reference:_ Efter oprettelsen kan du manuelt tilføje dokumentet `kiosks/subra-hq` hvis du vil seed’e tom struktur.

6. **Opsæt Firestore-sikkerhedsregler** (eksempel)  
   - _Hvor:_ `Firestore Database > Rules`.
   - _Hvorfor:_ Sikrer at kun loggede brugere kan læse/ændre state. Justér efter eget behov.
   - _Eksempelregler:_
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /kiosks/{kioskId} {
           allow read: if true; // kiosken må læse uden login (offentlig skærm)
           allow write: if request.auth != null; // kræver auth (admin eller anonym kiosk)
         }
       }
     }
     ```
     > Ønsker du at begrænse anonyme skriverettigheder yderligere, kan du udvide reglen med `request.auth.token.firebase.
     > sign_in_provider == "anonymous" && request.auth.uid.startsWith("kiosk-")` eller lignende.

7. **Aktivér Firebase Storage**  
   - _Hvor:_ `Build > Storage > Get started`.
   - _Hvorfor:_ Slides/uploadede billeder gemmes her. Standardbucket-navnet (`<projekt-id>.appspot.com`) bruges i
     `firebase-config.js`.

8. **Opdater Storage-regler** (minimum)  
   - _Hvor:_ `Storage > Rules`.
   - _Forslag:_
     ```
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /screensaver/{kioskId}/{allPaths=**} {
           allow read; // kiosken må hente billeder uden auth
           allow write: if request.auth != null; // kræver login (admin eller anonym kiosk)
         }
       }
     }
     ```
     - _Hvorfor:_ Forhindrer uautoriserede uploads, men lader slides blive hentet offentligt af kioskvisningen.

### 2. Forbind projektet til denne kodebase

1. **Udfyld `firebase-config.js`**  
   - _Hvor:_ Projektroden → filen `firebase-config.js` (kopiér `firebase-config.example.js`).
   - _Gør:_ Indsæt de værdier du modtog i trin 1.2 (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
   - _Hvorfor:_ Filen eksponerer `window.SUBRA_FIREBASE_CONFIG`, som `firebase-adapter.js` læser ved init.

2. **Justér `local-config.js`**  
   - _Gør:_ Opdatér `stateCollection`, `stateDocId` og `storageFolder`, så de matcher dine Firebase-ruter.
   - _Hvorfor:_ Disse værdier afgør hvilket Firestore-dokument (fx `kiosks/subra-hq`) og hvilken Storage-mappe
     (`screensaver/subra-hq`) kiosken/admin læser/skrives til.
   - _Ekstra:_ `authMode: 'anonymous'` betyder, at kiosken logger ind anonymt. Ændr til fx `'none'` hvis du vil
     håndtere login manuelt.

3. **Del konfigurationen med GitHub Pages**  
   - `firebase-config.js` indeholder ingen hemmeligheder (Firebase Web API keys er offentlige), så filen må gerne ligge i repoet.
   - Hvis du bruger flere miljøer, kan du have forskellige versioner af `firebase-config.js` på forskellige grene.

### 3. Deploy eller kør lokalt

- **Lokalt (uden backend)**  
  - Åbn `index.html` eller `admin.html` direkte i din browser (evt. via `npx serve .`).
  - Login i admin-portalen med den bruger du oprettede i Authentication → brug portalen til at indtaste rigtige data.
  - Kiosken lytter automatisk efter ændringer i Firestore.

- **GitHub Pages**
  1. Commit alle filer (inkl. `firebase-config.js` og justeret `local-config.js`).
  2. Aktivér GitHub Pages (Settings → Pages → Deploy from branch → `main` → `/root`).
  3. Besøg `https://<brugernavn>.github.io/<repo>/` for kiosken og `.../admin.html` for adminportalen.
  4. Firebase Auth og Firestore fungerer direkte fra den statiske hosting, fordi al logik ligger i browseren.

> **Tip:** Hvis du vil teste data før GoLive, kan du initialisere Firestore-dokumentet ved at importere
> `defaults.js`-indholdet via adminportalens “Importer JSON”.

## Daglig drift i Firebase-udgaven

- **Synkronisering**:  
  - Kiosk (`app.js`) kører realtime-lytning (`enableRealtime: true`). Kan slås fra i `local-config.js`, hvorefter
    den poler Firestore hvert 15. sekund.
  - Admin (`admin.js`) gemmer ændringer via `firebaseAdapter.saveState()` og lytter live på samme dokument.

- **Slides**:  
  - Upload fra admin-portalen sender filen direkte til Storage under `screensaver/<stateDocId>/...` og opdaterer
    download-URL’en i Firestore. Sletning bruger `firebaseAdapter.deleteSlide`.

- **Medarbejdere & gæster**:  
  - Alt data (employees, guests, logs, qrLinks, policyLinks) ligger i samme Firestore-dokument. Eksport (CSV/JSON)
    hentes direkte fra den lokale state i browseren.

- **Sikkerhed**:  
  - Kun brugere der er logget ind (anonymt eller med email/kode) får lov til at skrive. Finjustér reglerne hvis kun
    bestemte konti skal have rettigheder til bestemte kiosker.

## Tilpasning

- **Defaults**: `defaults.js` indeholder demo-data. De bliver brugt som seed hvis Firestore-dokumentet er tomt.
- **Temaer**: Slides bruger `SLIDE_THEMES` i `app.js`/`admin.js`. Tilføj nye entries for flere farvetemaer.
- **Realtime**: Sæt `enableRealtime` til `false` i `local-config.js` hvis du vil reducere Firestore-read belastning.
- **Egne uploads**: Udskift `firebaseAdapter.uploadSlide` i `firebase-adapter.js` hvis du ønsker at bruge et andet CDN.

## Fejlfinding

- “Firebase er ikke konfigureret …” → Kontroller at `firebase-config.js` er udfyldt og indlæst før `firebase-adapter.js`.
- “Kunne ikke logge ind anonymt” → Sørg for at Anonymous sign-in er aktiveret i Authentication.
- “permission-denied” i konsollen → Justér Firestore/Storage reglerne så de matcher dine auth-krav.
- Slides vises ikke → Kontroller at Storage-reglerne tillader `allow read` for skærmens mappe, og at download-URL’en
  findes i Firestore under `state.screensaver.slides[].image`.

## Teknologi

- Ren HTML, CSS og JavaScript uden build-step.
- Firebase SDK (App/Auth/Firestore/Storage) via CDN.
- `firebase-adapter.js` centraliserer login, realtime-lytning og filupload, så både kiosk og admin deler logik.

## Licens

Projektet er leveret som eksempel og kan frit videreudvikles internt hos SUBRA.
