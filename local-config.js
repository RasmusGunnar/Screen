// local-config.js
// Peger på de dokumenter/buckets, kiosk + admin skal bruge
window.SUBRA_LOCAL_CONFIG = {
  // Firestore: state ligger her
  stateCollection: "kiosks",
  stateDocId: "subra-hq",              // skift navn hvis du vil (fx "hq" eller "kalender")
  // Storage: slides/billeder ligger her
  storageFolder: "screensaver/subra-hq", // bør matche stateDocId

  // Backend-tilstand
  //  - "firebase" (standard): brug Firebase Auth/Firestore/Storage
  //  - "local": brug den indbyggede Node-backend (/api/state, /api/auth, /api/slides)
  backendMode: "firebase",

  // Kioskens login
  authMode: "anonymous",

  // (valgfrit) ruter – brugt til interne links/hints
  routes: {
    kiosk: "index.html",
    admin: "admin.html"
  }
};
