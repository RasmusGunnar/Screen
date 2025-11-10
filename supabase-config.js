// Supabase konfiguration udfyldt til Subra-skærmprojektet.
window.SUBRA_SUPABASE_CONFIG = {
  url: 'https://nnfkumgdebxdegjykkwp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZmt1bWdkZWJ4ZGVnanlra3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzA5OTYsImV4cCI6MjA3NzcwNjk5Nn0.HjDkwmW-AXvEq3t3UIknu8ut-rWyKFEhbQ9WPIftkLM',

  admin: {
    hint: 'Log ind med din @subra.dk-konto',
  },

  kiosk: {
    stateId: 'subra-main',                 // den centrale state-række (kan oprettes manuelt i DB)
    channel: 'kiosk-state-subra-main',     // realtime kanalnavn
    serviceEmail: 'admin@subra.dk',        // kiosk/service-brugeren (nu sat som editor i admins)
    servicePassword: '<INDSÆT-KODE-HER>',  // TODO: indsæt præcis adgangskode (du skrev "admin")
  },

  tables: {
    kioskState: 'kiosk_state',
    admins: 'admins',
  },

  storage: {
    screensaverBucket: 'Bucket',           // beholdt stort "B", som du skrev
    slidesFolder: 'slides',
  },
};

// Gør konfigurationen synlig for adminkoden via et CustomEvent
if (typeof window !== 'undefined') {
  const event = new CustomEvent('subra:supabase-config-ready', {
    detail: window.SUBRA_SUPABASE_CONFIG,
  });
  window.dispatchEvent(event);
}
