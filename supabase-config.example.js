window.SUBRA_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_PUBLIC_ANON_KEY',
};

// Optional overrides for tabelnavne og lagermapper
// window.SUBRA_KIOSK_TABLE = 'kiosk_state';
// window.SUBRA_KIOSK_DOCUMENT = 'subra-main';
// window.SUBRA_ASSET_BUCKET = 'kiosk-assets';
// window.SUBRA_ASSET_FOLDER = 'screensaver';

window.SUBRA_ADMIN_AUTH = {
  users: [
    {
      email: 'admin@subra.dk',
      name: 'SUBRA Admin',
      // Hash svarende til kodeordet "subra-demo". Udskift med eget hash til produktion.
      passcodeHash: '9e7364c344dd7aabaf5c3793e6259994d0156a4d95d7ff10cf39df344e7d5a72',
    },
  ],
  hint: 'Kontakt People & Culture for admin-adgang.',
};
