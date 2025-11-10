window.SUBRA_LOCAL_CONFIG = {
  firebase: {
    /**
     * Firestore collection og dokument der holder hele kioskens state.
     * Justér så det matcher din Firebase-struktur.
     */
    stateCollection: 'kiosks',
    stateDocId: 'subra-hq',
    /**
     * Mappe i Firebase Storage hvor slides/uploadede billeder gemmes.
     * Mappen oprettes automatisk ved første upload.
     */
    storageFolder: 'screensaver/subra-hq',
    /**
     * Aktiver true for at bruge realtime-lyttere i stedet for polling.
     */
    enableRealtime: true,
  },
  kiosk: {
    /**
     * Kiosken logger ind anonymt i Firebase Auth. Sørg for at aktivere
     * Anonymous sign-in i Firebase-konsollen.
     */
    authMode: 'anonymous',
  },
  admin: {
    hint: 'Log ind med din SUBRA Firebase-konto',
  },
};
