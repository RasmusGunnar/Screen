<!DOCTYPE html>
<html lang="da">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SUBRA · Adminportal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="admin.css" />
  </head>
  <body>
    <div id="admin-app" class="admin-app">
      <section id="login-view" class="auth-panel">
        <img src="assets/LOGO_SUBRA_sort_transp-web.png" alt="SUBRA" class="auth-logo" />
        <div class="auth-copy">
          <h1>Velkommen tilbage</h1>
          <p>Log ind for at administrere medarbejdere, slides, QR-koder og rapporter.</p>
        </div>
        <form id="login-form" class="auth-form">
          <label>
            <span>E-mail</span>
            <input type="email" id="login-email" autocomplete="username" required />
          </label>
          <label>
            <span>Adgangskode</span>
            <input type="password" id="login-passcode" autocomplete="current-password" required />
          </label>
          <button type="submit" class="primary">Log ind</button>
          <p id="login-error" class="auth-error" role="alert" aria-live="assertive"></p>
          <p id="login-hint" class="auth-hint"></p>
        </form>
      </section>

      <main id="admin-main" class="hidden" aria-live="polite">
        <header class="admin-header">
          <div class="header-brand">
            <img src="assets/LOGO_SUBRA_sort_transp-web.png" alt="SUBRA" class="header-logo" />
            <div>
              <h1>SUBRA Workplace Admin</h1>
              <p id="active-admin"></p>
            </div>
          </div>
          <div class="header-actions">
            <button id="sync-now" class="ghost">Synkroniser nu</button>
            <button id="logout" class="ghost">Log ud</button>
          </div>
        </header>

        <section class="stat-grid" id="stat-grid" aria-label="Nøgletal"></section>

        <section class="panel-grid">
          <article class="panel" aria-labelledby="activity-title">
            <header>
              <h2 id="activity-title">Aktivitetslog</h2>
              <div class="panel-actions">
                <label>
                  <span>Filtrér afdeling</span>
                  <select id="activity-department-filter"></select>
                </label>
                <label>
                  <span>Filtrér type</span>
                  <select id="activity-type-filter"></select>
                </label>
              </div>
            </header>
            <div class="panel-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Dato</th>
                    <th>Person</th>
                    <th>Afdeling</th>
                    <th>Type</th>
                    <th>Detaljer</th>
                  </tr>
                </thead>
                <tbody id="activity-body"></tbody>
              </table>
            </div>
          </article>

          <article class="panel" aria-labelledby="employee-title">
            <header>
              <h2 id="employee-title">Medarbejdere</h2>
              <div class="panel-actions">
                <button id="add-employee" class="primary">Tilføj medarbejder</button>
              </div>
            </header>
            <div class="panel-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>Initialer</th>
                    <th>Afdeling</th>
                    <th>Mail</th>
                    <th>Telefon</th>
                    <th>Aktiv</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="employee-body"></tbody>
              </table>
            </div>
          </article>

          <article class="panel" aria-labelledby="settings-title">
            <header>
              <h2 id="settings-title">Kiosk-indstillinger</h2>
            </header>
            <form id="settings-form" class="panel-form">
              <div class="form-row">
                <label>
                  <span>Kiosk-titel</span>
                  <input id="settings-title" />
                </label>
                <label>
                  <span>Standardmeddelelse</span>
                  <input id="settings-default-message" />
                </label>
              </div>
              <div class="form-row">
                <label>
                  <span>API-base URL</span>
                  <input id="settings-api-base" placeholder="https://..." />
                </label>
                <label>
                  <span>Slides-mappe</span>
                  <input id="settings-slides-path" placeholder="screensaver/subra-hq" />
                </label>
              </div>
              <div class="form-row">
                <label class="checkbox">
                  <input type="checkbox" id="settings-realtime" />
                  <span>Live-opdater skærmen (realtime)</span>
                </label>
              </div>
              <button type="submit" class="primary">Gem indstillinger</button>
              <p id="settings-feedback" class="panel-feedback" aria-live="polite"></p>
            </form>
          </article>

          <article class="panel" aria-labelledby="slides-title">
            <header>
              <h2 id="slides-title">Slides</h2>
            </header>
            <form id="slides-form" class="panel-form" enctype="multipart/form-data">
              <div class="form-row">
                <label>
                  <span>Upload nye slides (billeder)</span>
                  <input type="file" id="slides-files" accept="image/*" multiple />
                </label>
              </div>
              <button type="submit" class="primary">Upload</button>
              <p id="slides-feedback" class="panel-feedback" aria-live="polite"></p>
            </form>
            <div class="slides-preview" id="slides-preview"></div>
          </article>

          <article class="panel" aria-labelledby="qr-title">
            <header>
              <h2 id="qr-title">QR-selvbetjening</h2>
            </header>
            <form id="qr-form" class="panel-form">
              <div class="form-row">
                <label><span>Medarbejder-URL</span><input id="qr-employee" placeholder="https://" /></label>
              </div>
              <button type="submit" class="primary">Opdater QR-kode</button>
              <p id="qr-feedback" class="panel-feedback" aria-live="polite"></p>
            </form>
            <div class="qr-preview">
              <p>Aktuelt link:</p>
              <dl>
                <dt>Medarbejdere</dt>
                <dd id="qr-employee-link"></dd>
              </dl>
            </div>
          </article>

          <article class="panel" aria-labelledby="policy-title">
            <header>
              <h2 id="policy-title">Politikker</h2>
            </header>
            <form id="policy-form" class="panel-form">
              <div class="form-row">
                <label><span>NDA-link (PDF)</span><input id="policy-nda-link" type="url" placeholder="https://" /></label>
              </div>
              <button type="submit" class="primary">Gem link</button>
              <p id="policy-feedback" class="panel-feedback" aria-live="polite"></p>
            </form>
          </article>
        </section>
      </main>
    </div>

    <!-- 1) Firebase SDK’er (compat-versioner) -->
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js?v=2"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js?v=2"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js?v=2"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js?v=2"></script>

    <!-- 2) Vores konfiguration (skal komme før adapter/app) -->
    <script src="firebase-config.js?v=2"></script>
    <script src="local-config.js?v=2"></script>
    <script src="defaults.js?v=2"></script>

    <!-- 3) Adapter + admin-app -->
    <script src="local-backend-adapter.js?v=1"></script>
    <script src="firebase-adapter.js?v=2"></script>
    <script>
      (function () {
        const LOCAL = window.SUBRA_LOCAL_CONFIG || {};
        const backendMode = (LOCAL.backendMode || 'firebase').toLowerCase();
        if (backendMode !== 'firebase') return;

        if (!window.SubraFirebase || typeof window.SubraFirebase.init !== 'function') {
          console.error('SubraFirebase adapter mangler eller har ingen init()-funktion.');
          return;
        }

        window.SubraFirebase.init({
          stateCollection: LOCAL.stateCollection || 'kiosks',
          stateDocId: LOCAL.stateDocId || 'subra-hq',
          storageFolder:
            LOCAL.storageFolder || ('screensaver/' + (LOCAL.stateDocId || 'subra-hq')),
          enableRealtime: true
        });
      })();
    </script>
    <script src="admin.js?v=3"></script>
  </body>
</html>
