// admin.js
// Minimal, robust admin-login + state-load via firebase-adapter

(function () {
  const adapter = window.SubraFirebase;
  const LOCAL = window.SUBRA_LOCAL_CONFIG || {};
  const cfg = {
    stateCollection: LOCAL.stateCollection || "kiosks",
    stateDocId: LOCAL.stateDocId || "subra-hq",
    storageFolder: LOCAL.storageFolder || `screensaver/${LOCAL.stateDocId || "subra-hq"}`,
    enableRealtime: true,
  };

  // --- helpers
  const $ = (id) => document.getElementById(id);
  const loginView = $("login-view");
  const adminMain = $("admin-main");
  const loginForm = $("login-form");
  const loginEmail = $("login-email");
  const loginPass = $("login-passcode");
  const loginError = $("login-error");
  const loginHint = $("login-hint");
  const activeAdmin = $("active-admin");
  const logoutBtn = $("logout");
  const syncNowBtn = $("sync-now");
  const statGrid = $("stat-grid");
  const screensaverAdmin = $("screensaver-admin");

  function show(el) { el?.classList.remove("hidden"); }
  function hide(el) { el?.classList.add("hidden"); }
  function setError(msg) { loginError.textContent = msg || ""; }
  function setHint(msg) { loginHint.textContent = msg || ""; }

  // --- init Firebase adapter
  if (!adapter) {
    console.error("firebase-adapter ikke fundet");
    setError("Teknisk fejl: Firebase adapter mangler");
    return;
  }
  const app = adapter.init(cfg);
  if (!app) {
    console.error("Kunne ikke initialisere Firebase");
    setError("Teknisk fejl: Firebase ikke initialiseret");
    return;
  }

  // --- auth state
  adapter.onAuthStateChanged(async (user) => {
    if (user) {
      // Logged in
      setError(""); setHint("");
      activeAdmin.textContent = user.email || `(anon) ${user.uid}`;
      hide(loginView);
      show(adminMain);
      // Indlæs state én gang (du kan udvide til realtime hvis du vil)
      try {
        const state = await adapter.fetchState();
        renderStateSummary(state);
        renderSlides(state);
      } catch (e) {
        console.error("Kunne ikke hente state", e);
      }
    } else {
      // Logged out
      show(loginView);
      hide(adminMain);
      activeAdmin.textContent = "";
    }
  });

  // --- login form
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError(""); setHint("Logger ind …");
    const email = loginEmail.value.trim();
    const pass = loginPass.value;
    try {
      await adapter.signInWithPassword(email, pass);
      setHint("");
    } catch (err) {
      console.error("Login fejlede", err);
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Forkert e-mail eller adgangskode.");
      } else if (code === "auth/user-not-found") {
        setError("Brugeren findes ikke i Auth → Users.");
      } else if (code === "auth/operation-not-allowed") {
        setError("Email/Password er ikke aktiveret i Authentication → Sign-in method.");
      } else {
        setError("Firebase Auth er ikke tilgængelig eller gav en fejl.");
      }
      setHint("");
    }
  });

  // --- logout
  logoutBtn.addEventListener("click", async () => {
    try { await adapter.signOut(); } catch (e) {}
  });

  // --- manuel sync (reload state)
  syncNowBtn.addEventListener("click", async () => {
    try {
      const state = await adapter.fetchState();
      renderStateSummary(state);
      renderSlides(state);
    } catch (e) {
      console.error("Sync fejlede", e);
    }
  });

  // --- simple renderers (kan udvides)
  function renderStateSummary(state) {
    if (!state) return;
    // lav nogle meget simple nøgletal
    const employees = Array.isArray(state.employees) ? state.employees : [];
    const guests = Array.isArray(state.guestsToday) ? state.guestsToday : [];
    const onsite = employees.filter(e => e.status === "onsite").length;
    const remote = employees.filter(e => e.status === "remote").length;
    const away = employees.filter(e => e.status === "away").length;

    statGrid.innerHTML = `
      <div class="stat">
        <div class="stat-number">${onsite}</div>
        <div class="stat-label">På kontoret</div>
      </div>
      <div class="stat">
        <div class="stat-number">${remote}</div>
        <div class="stat-label">Hjemme</div>
      </div>
      <div class="stat">
        <div class="stat-number">${away}</div>
        <div class="stat-label">Fravær</div>
      </div>
      <div class="stat">
        <div class="stat-number">${guests.length}</div>
        <div class="stat-label">Gæster i dag</div>
      </div>
    `;
  }

  function renderSlides(state) {
    const slides = Array.isArray(state?.slides) ? state.slides : [];
    if (!slides.length) {
      screensaverAdmin.innerHTML = `<p>Ingen slides endnu. Upload i Storage: <code>${cfg.storageFolder}</code></p>`;
      return;
    }
    screensaverAdmin.innerHTML = slides.map(s => `
      <div class="list-item">
        <div>
          <div><strong>${s.type || "image"}</strong></div>
          <div class="muted">${s.path || ""}</div>
        </div>
      </div>
    `).join("");
  }
})();
