// Eksempel på Supabase konfiguration. Kopiér denne fil til supabase-config.js og indsæt
// værdierne fra virksomhedens Supabase-projekt.
window.SUBRA_SUPABASE_CONFIG = {
  url: 'https://<project>.supabase.co',
  anonKey: '<public-anon-key>',
  admin: {
    hint: 'Log ind med din @subra.dk-konto',
  },
  kiosk: {
    stateId: 'subra-main',
    channel: 'kiosk-state-subra-main',
    serviceEmail: 'kiosk-service@subra.dk',
    servicePassword: 'udskift-mig',
  },
  tables: {
    kioskState: 'kiosk_state',
    admins: 'admins',
  },
  storage: {
    screensaverBucket: 'screensaver',
    slidesFolder: 'slides',
  },
};

if (typeof window !== 'undefined') {
  const event = new CustomEvent('subra:supabase-config-ready', {
    detail: window.SUBRA_SUPABASE_CONFIG,
  });
  window.dispatchEvent(event);
}
