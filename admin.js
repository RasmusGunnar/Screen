// admin.js - Firebase-baseret admin til SUBRA-screen

const DEFAULTS = window.SUBRA_DEFAULTS || {};
const LOCAL_CONFIG = window.SUBRA_LOCAL_CONFIG || {};
const firebaseConfig = window.SUBRA_FIREBASE_CONFIG || {};

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error("Mangler Firebase-konfiguration (window.SUBRA_FIREBASE_CONFIG).");
}

// Init Firebase (compat)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Hvor i Firestore state ligger
const STATE_COLLECTION = LOCAL_CONFIG.stateCollection || "kiosks";
const STATE_DOC_ID = LOCAL_CONFIG.stateDocId || "subra-hq";
const STORAGE_FOLDER =
  LOCAL_CONFIG.storageFolder || `screensaver/${LOCAL_CONFIG.stateDocId || "subra-hq"}`;

let ADMIN_HINT = LOCAL_CONFIG?.admin?.hint || "";

let state = ensureStateDefaults();
let pendingSlideUploadId = null;
let activeAdmin = null;
let lastSyncedAt = null;
let syncTimer = null;
let isSyncing = false;
const POLL_INTERVAL = 10000;
let activeView = "overview";
let permissionErrorNotified = false;

// UI references
const elements = {
  loginView: document.getElementById("login-view"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPasscode: document.getElementById("login-passcode"),
  loginError: document.getElementById("login-error"),
  loginHint: document.getElementById("login-hint"),
  adminMain: document.getElementById("admin-main"),
  activeAdmin: document.getElementById("active-admin"),
  logout: document.getElementById("logout"),
  syncNow: document.getElementById("sync-now"),
  syncLog: document.getElementById("sync-log"),
  statGrid: document.getElementById("stat-grid"),
  activityBody: document.getElementById("activity-body"),
  activityTypeFilter: document.getElementById("activity-type-filter"),
  activityDepartmentFilter: document.getElementById("activity-department-filter"),
  exportForm: document.getElementById("export-form"),
  exportEmployee: document.getElementById("export-employee"),
  exportFrom: document.getElementById("export-from"),
  exportTo: document.getElementById("export-to"),
  exportIncludeGuests: document.getElementById("export-include-guests"),
  exportIncludeStatus: document.getElementById("export-include-status"),
  exportFeedback: document.getElementById("export-feedback"),
  employeeForm: document.getElementById("employee-form"),
  employeeId: document.getElementById("employee-id"),
  employeeFirst: document.getElementById("employee-first"),
  employeeLast: document.getElementById("employee-last"),
  employeeDepartment: document.getElementById("employee-department"),
  employeeRole: document.getElementById("employee-role"),
  employeeContact: document.getElementById("employee-contact"),
  employeePhoto: document.getElementById("employee-photo"),
  employeeList: document.getElementById("employee-list"),
  newEmployee: document.getElementById("new-employee"),
  resetForm: document.getElementById("reset-form"),
  absenceList: document.getElementById("absence-list"),
  screensaverAdmin: document.getElementById("screensaver-admin"),
  addSlide: document.getElementById("add-slide"),
  slideUpload: document.getElementById("slide-upload"),
  qrForm: document.getElementById("qr-form"),
  qrEmployee: document.getElementById("qr-employee"),
  qrEmployeeLink: document.getElementById("qr-employee-link"),
  policyForm: document.getElementById("policy-form"),
  policyNdaLink: document.getElementById("policy-nda-link"),
  policyFeedback: document.getElementById("policy-feedback"),
  navLinks: document.querySelectorAll(".nav-link[data-view]"),
  viewPanels: document.querySelectorAll("[data-view-panel]"),
  toolbarLinks: document.querySelectorAll(".toolbar-link[data-target]"),
  toolbarTargets: document.querySelectorAll(".toolbar [data-target]"),
};

initializeAdmin();
renderAll();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", stopSyncLoop);
}

// ---------- INIT & AUTH ----------

function initializeAdmin() {
  if (elements.loginHint) {
    elements.loginHint.textContent = ADMIN_HINT;
  }

  elements.loginForm?.addEventListener("submit", handleLoginSubmit);
  elements.logout?.addEventListener("click", handleLogout);
  elements.syncNow?.addEventListener("click", () => commitState());
  elements.activityTypeFilter?.addEventListener("change", renderActivityLog);
  elements.activityDepartmentFilter?.addEventListener("change", renderActivityLog);
  elements.exportForm?.addEventListener("submit", handleExportSubmit);
  elements.employeeForm?.addEventListener("submit", handleEmployeeSubmit);
  elements.resetForm?.addEventListener("click", resetEmployeeForm);
  elements.newEmployee?.addEventListener("click", () => {
    resetEmployeeForm();
    elements.employeeFirst?.focus();
  });
  elements.screensaverAdmin?.addEventListener("input", handleSlideFieldChange);
  elements.screensaverAdmin?.addEventListener("change", handleSlideFieldChange);
  elements.screensaverAdmin?.addEventListener("click", handleSlideAdminClick);
  elements.addSlide?.addEventListener("click", handleAddSlide);
  elements.slideUpload?.addEventListener("change", handleSlideUploadChange);
  elements.qrForm?.addEventListener("submit", handleQrSubmit);
  elements.policyForm?.addEventListener("submit", handlePolicySubmit);

  setupNavigation();
  restoreSession();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  elements.loginError.textContent = "";

  const email = elements.loginEmail.value.trim().toLowerCase();
  const password = elements.loginPasscode.value;

  if (!email || !password) {
    elements.loginError.textContent = "Indtast både e-mail og adgangskode.";
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const user = cred.user;
    activeAdmin = {
      email: user.email,
      name: user.displayName || user.email,
      role: "editor",
    };
    permissionErrorNotified = false;
    elements.loginForm?.reset();
    showAdmin();
    await bootstrapRemoteState();
  } catch (error) {
    console.error("Login fejlede", error);
    if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      elements.loginError.textContent = "Forkert e-mail eller adgangskode.";
    } else if (error.code === "auth/invalid-email") {
      elements.loginError.textContent = "Ugyldig e-mailadresse.";
    } else if (error.code === "auth/too-many-requests") {
      elements.loginError.textContent = "For mange forsøg. Prøv igen senere.";
    } else {
      elements.loginError.textContent = "Kunne ikke logge ind. Tjek forbindelsen og prøv igen.";
    }
  }
}

function restoreSession() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      activeAdmin = {
        email: user.email,
        name: user.displayName || user.email,
        role: "editor",
      };
      permissionErrorNotified = false;
      showAdmin();
      await bootstrapRemoteState();
    } else {
      showLogin();
    }
  });
}

async function handleLogout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.warn("Kunne ikke logge ud", error);
  }

  activeAdmin = null;
  stopSyncLoop();
  state = ensureStateDefaults();
  renderAll();
  showLogin();
  elements.loginForm?.reset();
  appendSyncLog("Du er nu logget ud.");
  permissionErrorNotified = false;
  activeView = "overview";
  switchView(activeView);
}

function showLogin() {
  stopSyncLoop();
  if (elements.loginView) elements.loginView.classList.remove("hidden");
  if (elements.adminMain) elements.adminMain.classList.add("hidden");
}

function showAdmin() {
  if (elements.loginView) elements.loginView.classList.add("hidden");
  if (elements.adminMain) elements.adminMain.classList.remove("hidden");
  elements.loginForm?.reset();
  if (elements.activeAdmin && activeAdmin) {
    const roleLabel = activeAdmin.role ? ` · rolle: ${activeAdmin.role}` : "";
    elements.activeAdmin.textContent = `Logget ind som ${activeAdmin.name} (${activeAdmin.email})${roleLabel}`;
  }
}

function setupNavigation() {
  if (elements.navLinks?.forEach) {
    elements.navLinks.forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.view || "overview";
        switchView(view);
      });
    });
  }

  if (elements.toolbarTargets?.forEach) {
    elements.toolbarTargets.forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.view;
        if (view) {
          switchView(view);
        }
        scrollToTarget(button.dataset.target);
        if (button.classList.contains("toolbar-link")) {
          markToolbarLink(button);
        }
      });
    });
  }

  switchView(activeView);
}

function switchView(view) {
  if (!view) return;
  activeView = view;
  if (elements.navLinks?.forEach) {
    elements.navLinks.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
  }
  const toolbarButtons = elements.toolbarLinks
    ? Array.from(elements.toolbarLinks)
    : [];
  const matchingToolbar = toolbarButtons.find(
    (button) => button.dataset.view === view
  );
  markToolbarLink(matchingToolbar || null);
  updateViewPanels();
}

function updateViewPanels() {
  if (elements.viewPanels?.forEach) {
    elements.viewPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.viewPanel !== activeView);
    });
  }
}

function markToolbarLink(activeButton) {
  if (!elements.toolbarLinks?.forEach) return;
  elements.toolbarLinks.forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function scrollToTarget(selector) {
  if (!selector) return;
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- STATE via FIRESTORE ----------

function ensureStateDefaults(data = {}) {
  const seedEmployees = DEFAULTS.employees || [];
  const employees = (data.employees || seedEmployees).map((emp) => ({
    ...emp,
    lastStatusChange: emp.lastStatusChange || new Date().toISOString(),
  }));

  const qrLinks = {
    employee: (data.qrLinks?.employee || (DEFAULTS.qrLinks?.employee || "")).trim(),
  };

  const policyLinks = {
    nda: (data.policyLinks?.nda || (DEFAULTS.policyLinks?.nda || "")).trim(),
  };

  const settings = {
    kiosk: {
      table: data.settings?.kiosk?.table || "local_state",
      id: data.settings?.kiosk?.id || "local",
      lastSynced: data.settings?.kiosk?.lastSynced || null,
    },
  };

  return {
    employees,
    guests: data.guests || [],
    logs: data.logs || [],
    screensaver: {
      slides: normalizeSlides(
        data.screensaver?.slides || data.slides || DEFAULTS.slides || []
      ),
    },
    qrLinks,
    policyLinks,
    settings,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeSlides(slides) {
  const fallback =
    Array.isArray(slides) && slides.length ? slides : DEFAULTS.slides || [];
  return fallback
    .map((slide, index) => ({
      id: slide.id || `slide-${Date.now()}-${index}`,
      theme: slide.theme || "fjord",
      headline: slide.headline || "",
      description: slide.description || "",
      image: slide.image || "",
      storagePath: slide.storagePath || null,
      order: typeof slide.order === "number" ? slide.order : index,
      createdAt: slide.createdAt || null,
      updatedAt: slide.updatedAt || null,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function serializeForStorage(data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

async function bootstrapRemoteState() {
  await fetchRemoteState(true);
  startSyncLoop();
}

function startSyncLoop() {
  if (typeof window === "undefined") return;
  if (syncTimer) {
    window.clearInterval(syncTimer);
  }
  syncTimer = window.setInterval(() => {
    void fetchRemoteState();
  }, POLL_INTERVAL);
}

function stopSyncLoop() {
  if (typeof window === "undefined") return;
  if (syncTimer) {
    window.clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function fetchRemoteState(force = false) {
  try {
    const docRef = db.collection(STATE_COLLECTION).doc(STATE_DOC_ID);
    const snap = await docRef.get();
    if (!snap.exists) {
      await pushStateToServer(true);
      appendSyncLog("Ingen tidligere data fundet. Oprettede ny state i Firestore.");
      return;
    }

    const payload = snap.data();
    if (!payload?.state) return;

    if (
      !force &&
      lastSyncedAt &&
      payload.state.updatedAt &&
      payload.state.updatedAt === lastSyncedAt
    ) {
      return;
    }

    state = ensureStateDefaults(payload.state);
    lastSyncedAt = state.updatedAt;
    renderAll();
    appendSyncLog("Data opdateret fra Firestore.");
  } catch (error) {
    console.error("Kunne ikke hente state", error);
    if (!handleFirestorePermissionError(error, "hente data")) {
      appendSyncLog(`Kunne ikke hente data fra Firestore: ${error.message}`);
    }
  }
}

async function pushStateToServer(forceCreate = false) {
  if (isSyncing && !forceCreate) return;
  isSyncing = true;

  try {
    const docRef = db.collection(STATE_COLLECTION).doc(STATE_DOC_ID);
    const now = new Date().toISOString();
    const payload = {
      state: serializeForStorage({
        ...state,
        updatedAt: now,
      }),
    };

    await docRef.set(payload, { merge: true });

    state = ensureStateDefaults(payload.state);
    lastSyncedAt = state.updatedAt;
    renderAll();
    appendSyncLog("Ændringer gemt i Firestore.");
  } catch (error) {
    console.error("Kunne ikke gemme state", error);
    if (!handleFirestorePermissionError(error, "gemme ændringer")) {
      appendSyncLog(`Kunne ikke gemme til Firestore: ${error.message}`);
    }
  } finally {
    isSyncing = false;
  }
}

function commitState() {
  void pushStateToServer();
}

// ---------- RENDER ----------

function renderAll() {
  renderStats();
  renderActivityLog();
  renderExportOptions();
  renderEmployeeList();
  renderAbsenceList();
  renderScreensaverAdmin();
  renderQrPreview();
  renderPolicySettings();
}

function renderStats() {
  if (!elements.statGrid) return;
  const onsite = state.employees.filter((emp) => emp.status === "onsite").length;
  const remote = state.employees.filter((emp) => emp.status === "remote").length;
  const away = state.employees.filter((emp) => emp.status === "away").length;
  const guestsToday = state.guests.filter((guest) => isToday(guest.timestamp)).length;
  const statusChangesToday = state.logs.filter(
    (log) => log.type === "status-change" && isToday(log.timestamp)
  ).length;

  const cards = [
    { label: "Medarbejdere i alt", value: state.employees.length },
    { label: "På kontoret", value: onsite },
    { label: "Arbejde hjemmefra", value: remote },
    { label: "Registreret fravær", value: away },
    { label: "Check-ins i dag", value: statusChangesToday },
    { label: "Gæster i dag", value: guestsToday },
  ];

  elements.statGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span class="stat-label">${card.label}</span>
          <span class="stat-value">${card.value}</span>
        </article>
      `
    )
    .join("");
}

function renderActivityLog() {
  if (!elements.activityBody) return;
  const typeFilter = elements.activityTypeFilter?.value || "all";
  const departmentFilter = elements.activityDepartmentFilter?.value || "all";

  const departmentMap = new Map(
    state.employees.map((emp) => [emp.id, emp.department])
  );

  const rows = state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter((entry) => {
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (departmentFilter !== "all" && entry.employeeId) {
        const department = departmentMap.get(entry.employeeId);
        if (department !== departmentFilter) return false;
      }
      return true;
    })
    .map((entry) => {
      const timestamp = escapeHtml(formatDateTime(entry.timestamp));
      if (entry.type === "status-change") {
        const employee = state.employees.find((emp) => emp.id === entry.employeeId);
        const name = employee
          ? `${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}`
          : escapeHtml(entry.employeeId || "");
        const detail = entry.note
          ? `${escapeHtml(entry.status)} · ${escapeHtml(entry.note)}`
          : escapeHtml(entry.status);
        return `
          <tr>
            <td>${timestamp}</td>
            <td>${name}</td>
            <td>Status</td>
            <td>${detail}</td>
          </tr>
        `;
      }
      if (entry.type === "guest-checkin") {
        const guest = entry.guest || {};
        const host = state.employees.find((emp) => emp.id === guest.hostId);
        const hostLabel = host
          ? `${escapeHtml(host.firstName)} ${escapeHtml(host.lastName)}`
          : "Ukendt vært";
        return `
          <tr>
            <td>${timestamp}</td>
            <td>${escapeHtml(guest.name || "Gæst")}</td>
            <td>Gæst</td>
            <td>Besøger ${hostLabel}${
              guest.company ? ` · ${escapeHtml(guest.company)}` : ""
            }</td>
          </tr>
        `;
      }
      return "";
    })
    .join("");

  elements.activityBody.innerHTML =
    rows || `<tr><td colspan="4">Ingen hændelser endnu.</td></tr>`;

  populateDepartmentFilter();
}

function populateDepartmentFilter() {
  if (!elements.activityDepartmentFilter) return;
  const departments = Array.from(
    new Set(state.employees.map((emp) => emp.department))
  ).sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  const current = elements.activityDepartmentFilter.value;
  elements.activityDepartmentFilter.innerHTML =
    '<option value="all">Alle afdelinger</option>' +
    departments
      .map((dept) => {
        const safe = escapeHtml(dept || "");
        return `<option value="${safe}">${safe}</option>`;
      })
      .join("");
  if (current) {
    elements.activityDepartmentFilter.value = current;
  }
}

function renderExportOptions() {
  if (!elements.exportEmployee) return;
  const options = state.employees
    .slice()
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        "da",
        { sensitivity: "base" }
      )
    )
    .map((emp) => {
      const name = `${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`;
      return `<option value="${escapeHtml(emp.id)}">${name}</option>`;
    })
    .join("");
  elements.exportEmployee.innerHTML = `<option value="all">Alle medarbejdere</option>${options}`;
}

function renderEmployeeList() {
  if (!elements.employeeList) return;
  elements.employeeList.innerHTML = "";

  state.employees
    .slice()
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        "da",
        { sensitivity: "base" }
      )
    )
    .forEach((employee) => {
      const item = document.createElement("div");
      item.className = "list-item";

      const info = document.createElement("div");
      const name = `${escapeHtml(employee.firstName)} ${escapeHtml(
        employee.lastName
      )}`;
      const role = escapeHtml(employee.role || "Ingen titel");
      const department = escapeHtml(employee.department || "");
      const contact = escapeHtml(employee.contact || "");
      info.innerHTML = `
        <strong>${name}</strong>
        <small>${department} · ${role}</small>
        <small>${contact}</small>
      `;

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Redigér";
      edit.addEventListener("click", () => populateEmployeeForm(employee));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Slet";
      remove.addEventListener("click", () => deleteEmployee(employee.id));

      actions.append(edit, remove);
      item.append(info, actions);
      elements.employeeList.appendChild(item);
    });
}

function renderAbsenceList() {
  if (!elements.absenceList) return;
  elements.absenceList.innerHTML = "";
  const awayEmployees = state.employees.filter((emp) => emp.status === "away");
  if (!awayEmployees.length) {
    elements.absenceList.innerHTML =
      "<p>Ingen registreret fravær lige nu.</p>";
    return;
  }

  awayEmployees
    .slice()
    .sort((a, b) =>
      a.lastName.localeCompare(b.lastName, "da", { sensitivity: "base" })
    )
    .forEach((employee) => {
      const item = document.createElement("div");
      item.className = "list-item";
      const from = employee.absence?.from
        ? formatDate(employee.absence.from)
        : "Ukendt start";
      const to = employee.absence?.to
        ? formatDate(employee.absence.to)
        : "Ukendt slut";
      const name = `${escapeHtml(employee.firstName)} ${escapeHtml(
        employee.lastName
      )}`;
      const department = escapeHtml(employee.department || "");
      item.innerHTML = `
        <div>
          <strong>${name}</strong>
          <small>${department}</small>
          <span class="absence-chip">${escapeHtml(from)} → ${escapeHtml(
        to
      )}</span>
        </div>
      `;
      elements.absenceList.appendChild(item);
    });
}

function renderScreensaverAdmin() {
  if (!elements.screensaverAdmin) return;
  const slides = state.screensaver?.slides || [];
  if (!slides.length) {
    elements.screensaverAdmin.innerHTML =
      '<p>Ingen slides endnu. Brug "Tilføj slide" for at starte billedbanken.</p>';
    return;
  }

  elements.screensaverAdmin.innerHTML = slides
    .map((slide, index) => {
      const themeOptions = [
        { value: "fjord", label: "Fjord · kølig blå" },
        { value: "aurora", label: "Aurora · grøn gradient" },
        { value: "ocean", label: "Ocean · dyb turkis" },
        { value: "sand", label: "Sand · varm neutral" },
        { value: "forest", label: "Forest · nordisk grøn" },
      ]
        .map((theme) => {
          const selected = theme.value === slide.theme ? "selected" : "";
          const value = escapeHtml(theme.value);
          const label = escapeHtml(theme.label);
          return `<option value="${value}" ${selected}>${label}</option>`;
        })
        .join("");

      const slideId = escapeHtml(slide.id);
      const previewImg = escapeHtml(slide.image || "");
      const lastUpdated = slide.updatedAt
        ? escapeHtml(formatDateTime(slide.updatedAt))
        : "Ikke gemt endnu";

      return `
        <div class="list-item slide-admin" data-slide-id="${slideId}">
          <div class="slide-admin-main">
            <div class="slide-preview" aria-live="polite">
              <img
                src="${previewImg}"
                alt="Forhåndsvisning af slide"
                data-slide-preview-img
                class="${slide.image ? "" : "hidden"}"
              />
              <span data-slide-preview-placeholder class="${slide.image ? "hidden" : ""}">
                Intet billede endnu
              </span>
            </div>
            <div class="slide-admin-fields">
              <div>
                <strong>Slide ${index + 1}</strong>
                <small>ID: ${slideId}</small>
              </div>
              <label><span>Tema</span><select data-field="theme">${themeOptions}</select></label>
              <label><span>Overskrift</span><input data-field="headline" value="${escapeHtml(
                slide.headline
              )}" /></label>
              <label><span>Beskrivelse</span><input data-field="description" value="${escapeHtml(
                slide.description
              )}" /></label>
              <label><span>Billede-URL</span><input data-field="image" value="${escapeHtml(
                slide.image || ""
              )}" /></label>
              <small class="slide-meta">Sidst opdateret: ${lastUpdated}</small>
            </div>
          </div>
          <div class="list-actions">
            <button type="button" data-action="upload">Upload</button>
            <button type="button" data-action="save" class="ghost">Gem</button>
            <button type="button" data-action="up">Op</button>
            <button type="button" data-action="down">Ned</button>
            <button type="button" data-action="delete">Slet</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderQrPreview() {
  if (elements.qrEmployee) elements.qrEmployee.value = state.qrLinks.employee || "";
  if (elements.qrEmployeeLink)
    elements.qrEmployeeLink.textContent =
      state.qrLinks.employee || "Ingen URL angivet";
}

function renderPolicySettings() {
  if (elements.policyNdaLink) {
    elements.policyNdaLink.value = state.policyLinks?.nda || "";
  }
}

// ---------- FORM HANDLERE ----------

function handleEmployeeSubmit(event) {
  event.preventDefault();
  if (!elements.employeeFirst || !elements.employeeLast || !elements.employeeDepartment)
    return;

  const id = elements.employeeId.value;
  const payload = {
    firstName: elements.employeeFirst.value.trim(),
    lastName: elements.employeeLast.value.trim(),
    department: elements.employeeDepartment.value.trim(),
    role: elements.employeeRole.value.trim(),
    contact: elements.employeeContact.value.trim(),
    photo: elements.employeePhoto.value.trim(),
  };

  if (!payload.firstName || !payload.lastName || !payload.department) return;

  if (id) {
    const employee = state.employees.find((emp) => emp.id === id);
    if (!employee) return;
    Object.assign(employee, payload);
    appendSyncLog(`Opdaterede ${employee.firstName} ${employee.lastName}.`);
  } else {
    const employee = {
      ...payload,
      id: `emp-${crypto.randomUUID()}`,
      status: "away",
      lastStatusChange: new Date().toISOString(),
      statusNotes: "Ny medarbejder - registrer status",
    };
    state.employees.push(employee);
    appendSyncLog(
      `Tilføjede ny medarbejder: ${employee.firstName} ${employee.lastName}.`
    );
  }

  resetEmployeeForm();
  renderAll();
  commitState();
}

function resetEmployeeForm() {
  elements.employeeForm?.reset();
  if (elements.employeeId) elements.employeeId.value = "";
}

function populateEmployeeForm(employee) {
  if (!elements.employeeForm) return;
  elements.employeeId.value = employee.id;
  elements.employeeFirst.value = employee.firstName;
  elements.employeeLast.value = employee.lastName;
  elements.employeeDepartment.value = employee.department;
  elements.employeeRole.value = employee.role || "";
  elements.employeeContact.value = employee.contact || "";
  elements.employeePhoto.value = employee.photo || "";
  elements.employeeFirst.focus();
}

function deleteEmployee(id) {
  state.employees = state.employees.filter((emp) => emp.id !== id);
  appendSyncLog(`Fjernede medarbejder ${id}.`);
  renderAll();
  commitState();
}

function handleSlideFieldChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const container = event.target.closest("[data-slide-id]");
  if (!container) return;
  const slideId = container.dataset.slideId;
  const slide = state.screensaver.slides.find((item) => item.id === slideId);
  if (!slide) return;
  slide[field] = event.target.value;
  slide.updatedAt = new Date().toISOString();
  if (field === "image") {
    updateSlidePreview(container, slide.image);
  }
  commitState();
}

function handleSlideAdminClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;
  const container = event.target.closest("[data-slide-id]");
  if (!container) return;
  const slideId = container.dataset.slideId;
  const slide = state.screensaver.slides.find((item) => item.id === slideId);
  if (!slide) return;

  if (action === "upload") {
    pendingSlideUploadId = slideId;
    elements.slideUpload?.click();
  }

  if (action === "save") {
    slide.updatedAt = new Date().toISOString();
    commitState();
    appendSyncLog(`Gemte slide ${slideId}.`);
  }

  if (action === "up") {
    reorderSlide(slideId, -1);
  }

  if (action === "down") {
    reorderSlide(slideId, 1);
  }

  if (action === "delete") {
    void deleteSlide(slideId);
  }
}

function handleAddSlide() {
  const slide = {
    id: `slide-${crypto.randomUUID()}`,
    theme: "fjord",
    headline: "",
    description: "",
    image: "",
    order: state.screensaver.slides.length,
    createdAt: new Date().toISOString(),
  };
  state.screensaver.slides.push(slide);
  renderScreensaverAdmin();
  commitState();
  appendSyncLog("Tilføjede nyt slide.");
}

function reorderSlide(slideId, delta) {
  const slides = state.screensaver.slides;
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= slides.length) return;
  const [moved] = slides.splice(index, 1);
  slides.splice(newIndex, 0, moved);
  slides.forEach((slide, idx) => {
    slide.order = idx;
  });
  renderScreensaverAdmin();
  commitState();
}

async function handleSlideUploadChange(event) {
  const file = event.target.files?.[0];
  if (!file || !pendingSlideUploadId) {
    event.target.value = "";
    return;
  }
  if (!storage) {
    appendSyncLog("Firebase Storage er ikke initialiseret.");
    event.target.value = "";
    pendingSlideUploadId = null;
    return;
  }

  const slide = state.screensaver.slides.find(
    (item) => item.id === pendingSlideUploadId
  );
  pendingSlideUploadId = null;
  event.target.value = "";
  if (!slide) return;

  try {
    const path = createSlideStoragePath(slide, file);
    const ref = storage.ref().child(path);
    const snapshot = await ref.put(file);
    const imageUrl = await snapshot.ref.getDownloadURL();

    const previousPath = slide.storagePath;
    slide.image = imageUrl;
    slide.storagePath = path;
    slide.updatedAt = new Date().toISOString();
    renderScreensaverAdmin();
    commitState();
    appendSyncLog(`Opdaterede pauseskærmsbillede for ${slide.id}.`);
    if (previousPath && previousPath !== path) {
      removeSlideAsset(previousPath);
    }
  } catch (error) {
    console.error("Fejl ved upload af slide", error);
    appendSyncLog(`Kunne ikke uploade billede: ${error.message}`);
  }
}

async function deleteSlide(slideId) {
  const slides = state.screensaver.slides;
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return;
  const [removed] = slides.splice(index, 1);
  slides.forEach((slide, idx) => {
    slide.order = idx;
  });
  renderScreensaverAdmin();
  commitState();
  appendSyncLog("Fjernede slide.");
  if (removed?.storagePath) {
    removeSlideAsset(removed.storagePath);
  }
}

function handleQrSubmit(event) {
  event.preventDefault();
  state.qrLinks.employee = elements.qrEmployee?.value.trim() || "";
  renderQrPreview();
  commitState();
  appendSyncLog("Opdaterede link til medarbejder-QR.");
}

function handlePolicySubmit(event) {
  event.preventDefault();
  const value = elements.policyNdaLink?.value.trim() || "";
  state.policyLinks = state.policyLinks || {};
  state.policyLinks.nda = value;
  renderPolicySettings();
  commitState();
  if (elements.policyFeedback) {
    elements.policyFeedback.textContent = value
      ? "NDA-link opdateret."
      : "NDA-link fjernet.";
  }
  appendSyncLog("Opdaterede NDA-link.");
}

function updateSlidePreview(container, imageUrl) {
  if (!container) return;
  const previewImg = container.querySelector("[data-slide-preview-img]");
  const previewPlaceholder = container.querySelector(
    "[data-slide-preview-placeholder]"
  );
  if (previewImg) {
    if (imageUrl) {
      previewImg.src = imageUrl;
      previewImg.classList.remove("hidden");
      previewPlaceholder?.classList.add("hidden");
    } else {
      previewImg.src = "";
      previewImg.classList.add("hidden");
      previewPlaceholder?.classList.remove("hidden");
    }
  }
}

// ---------- HJÆLPEFUNKTIONER ----------

function removeSlideAsset(storagePath) {
  if (!storagePath) return;
  const ref = storage.ref().child(storagePath);
  ref
    .delete()
    .then(() => {
      appendSyncLog("Fjernede slide-asset fra Storage.");
    })
    .catch((error) => {
      console.warn("Kunne ikke fjerne slide-asset", error);
    });
}

function createSlideStoragePath(slide, file) {
  const rawName = (file?.name || "").toLowerCase();
  const extensionMatch = rawName.match(/\.([a-z0-9]+)$/i);
  const extension = (extensionMatch?.[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  return `${STORAGE_FOLDER}/${slide.id}.${extension || "jpg"}`;
}

function handleExportSubmit(event) {
  event.preventDefault();
  const employeeFilter = elements.exportEmployee?.value || "all";
  const from = elements.exportFrom?.value;
  const to = elements.exportTo?.value;
  const includeGuests = elements.exportIncludeGuests?.checked !== false;
  const includeStatus = elements.exportIncludeStatus?.checked !== false;

  const logs = state.logs.filter((entry) => {
    if (entry.type === "guest-checkin" && !includeGuests) return false;
    if (entry.type === "status-change" && !includeStatus) return false;
    if (
      employeeFilter !== "all" &&
      entry.employeeId &&
      entry.employeeId !== employeeFilter
    )
      return false;
    if (from && new Date(entry.timestamp) < new Date(from)) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (new Date(entry.timestamp) > end) return false;
    }
    return true;
  });

  const rows = [
    ["timestamp", "type", "employeeId", "employeeName", "department", "details"],
    ...logs.map((entry) => {
      if (entry.type === "status-change") {
        const employee = state.employees.find(
          (emp) => emp.id === entry.employeeId
        );
        const details = [
          entry.status,
          entry.note || "",
          entry.absence?.from || "",
          entry.absence?.to || "",
        ]
          .filter(Boolean)
          .join(" · ");
        return [
          entry.timestamp,
          "status-change",
          entry.employeeId,
          employee ? `${employee.firstName} ${employee.lastName}` : "",
          employee?.department || "",
          details,
        ];
      }
      if (entry.type === "guest-checkin") {
        const guest = entry.guest || {};
        const host = state.employees.find((emp) => emp.id === guest.hostId);
        const details = `Guest: ${guest.name || ""}; Company: ${
          guest.company || ""
        }; Host: ${
          host ? `${host.firstName} ${host.lastName}` : "Ukendt"
        }`;
        return [
          entry.timestamp,
          "guest-checkin",
          guest.hostId || "",
          host ? `${host.firstName} ${host.lastName}` : "",
          host?.department || "",
          details,
        ];
      }
      return [entry.timestamp, entry.type, entry.employeeId || "", "", "", ""];
    }),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateLabel = new Date().toISOString().split("T")[0];
  link.download = `subra-export-${dateLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  if (elements.exportFeedback) {
    elements.exportFeedback.textContent = `Eksporterede ${logs.length} hændelser.`;
  }
  appendSyncLog("Eksporterede CSV-data.");
}

function escapeCsv(value) {
  if (value == null) return "";
  const stringValue = String(value);
  if (/[";\n]/.test(stringValue)) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function appendSyncLog(message) {
  const timestamp = new Date().toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  if (elements.syncLog) {
    const entry = document.createElement("div");
    entry.textContent = `${timestamp} · ${message}`;
    elements.syncLog.prepend(entry);
    while (elements.syncLog.childElementCount > 120) {
      elements.syncLog.lastElementChild?.remove();
    }
  } else {
    console.info(`[ADMIN SYNC ${timestamp}] ${message}`);
  }
}

function handleFirestorePermissionError(error, actionLabel) {
  const isPermissionError =
    error?.code === "permission-denied" ||
    error?.message?.toLowerCase().includes("missing or insufficient permissions");
  if (!isPermissionError) {
    return false;
  }

  if (!permissionErrorNotified) {
    const readableAction = actionLabel || "læse/skrive";
    appendSyncLog(
      `Firestore nægtede adgang til at ${readableAction}. Tjek sikkerhedsregler og rettigheder for den pågældende bruger.`
    );
    permissionErrorNotified = true;
  }
  stopSyncLoop();
  return true;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.toLocaleDateString("da-DK")} ${date.toLocaleTimeString(
    "da-DK",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("da-DK");
}

function isToday(value) {
  if (!value) return false;
  const today = new Date();
  const date = new Date(value);
  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
