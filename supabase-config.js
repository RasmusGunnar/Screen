// Supabase konfiguration udfyldt til Subra-skærmprojektet.
window.SUBRA_SUPABASE_CONFIG = {
  url: 'https://nnfkumgdebxdegjykkwp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZmt1bWdkZWJ4ZGVnanlra3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzA5OTYsImV4cCI6MjA3NzcwNjk5Nn0.HjDkwmW-AXvEq3t3UIknu8ut-rWyKFEhbQ9WPIftkLM',
  admin: {
    hint: 'Log ind med din @subra.dk-konto',
  },
  kiosk: {
    stateId: 'subra-main',
    channel: 'kiosk-state-subra-main',
    serviceEmail: '',
    servicePassword: '',
  },
  tables: {
    kioskState: 'kiosk_state',
    admins: 'admins',
  },
  storage: {
    screensaverBucket: 'Bucket',
    slidesFolder: 'slides',
  },
};

if (typeof window !== 'undefined') {
  const event = new CustomEvent('subra:supabase-config-ready', {
    detail: window.SUBRA_SUPABASE_CONFIG,
  });
  window.dispatchEvent(event);
}
