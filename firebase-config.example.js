window.SUBRA_FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Optional: override the default collection/doc used for Firestore syncing
// window.SUBRA_KIOSK_COLLECTION = 'kiosks';
// window.SUBRA_KIOSK_DOCUMENT = 'subra-main';
// window.SUBRA_ASSET_FOLDER = 'assets';

window.SUBRA_ADMIN_AUTH = {
  users: [
    {
      email: 'admin@subra.dk',
      name: 'SUBRA Admin',
      // Hashen svarer til adgangskoden "subra-demo". Udskift med eget hash.
      passcodeHash: '9e7364c344dd7aabaf5c3793e6259994d0156a4d95d7ff10cf39df344e7d5a72',
    },
  ],
  hint: 'Kontakt People & Culture for admin-adgang.',
};
