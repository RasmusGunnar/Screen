// admin.js
// Admin-portal med autentificering, datavisning og redigeringsmuligheder

(function () {
  const LOCAL = window.SUBRA_LOCAL_CONFIG || {};
  const backendMode = (LOCAL.backendMode || 'firebase').toLowerCase();
  const adapter =
    (backendMode === 'local' && window.SubraLocalBackend) || window.SubraFirebase || null;
  const DEFAULTS = window.SUBRA_DEFAULTS || {};
  const cfg = {
    stateCollection: LOCAL.stateCollection || "kiosks",
    stateDocId: LOCAL.stateDocId || "subra-hq",
    storageFolder: LOCAL.storageFolder || `screensaver/${LOCAL.stateDocId || "subra-hq"}`,
    enableRealtime: true,
    baseUrl: LOCAL.baseUrl || "",
    backendMode,
  };

  const STATUS_LABELS = {
    onsite: "På kontoret",
    remote: "Arbejder hjemmefra",
    away: "Fravær",
    unknown: "Ukendt",
  };

  const TYPE_LABELS = {
    "status-change": "Statusændring",
    "guest-checkin": "Gæst",
    "employee-update": "Medarbejder",
    "settings-change": "Indstilling",
  };

  const MAX_LOG_ENTRIES = 500;

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
  const activityDepartmentFilter = $("activity-department-filter");
  const activityTypeFilter = $("activity-type-filter");
  const activityBody = $("activity-body");
  const exportForm = $("export-form");
  const exportEmployee = $("export-employee");
  const exportFrom = $("export-from");
  const exportTo = $("export-to");
  const exportIncludeGuests = $("export-include-guests");
  const exportIncludeStatus = $("export-include-status");
  const exportFeedback = $("export-feedback");
  const newEmployeeBtn = $("new-employee");
  const employeeForm = $("employee-form");
  const employeeId = $("employee-id");
  const employeeFirst = $("employee-first");
  const employeeLast = $("employee-last");
  const employeeRole = $("employee-role");
  const employeeDepartment = $("employee-department");
  const departmentOptionsList = $("department-options");
  const employeeContact = $("employee-contact");
  const employeePhoto = $("employee-photo");
  const resetFormBtn = $("reset-form");
  const employeeFeedback = $("employee-feedback");
  const employeeList = $("employee-list");
  const absenceList = $("absence-list");
  const screensaverAdmin = $("screensaver-admin");
  const slideFeedback = $("slide-feedback");
  const addSlideBtn = $("add-slide");
  const slideUpload = $("slide-upload");
  const qrForm = $("qr-form");
  const qrEmployee = $("qr-employee");
  const qrFeedback = $("qr-feedback");
  const qrEmployeeLink = $("qr-employee-link");
  const policyForm = $("policy-form");
  const policyNdaLink = $("policy-nda-link");
  const policyFeedback = $("policy-feedback");

  let currentState = ensureStateDefaults();
  let isSaving = false;

  function show(el) {
    el?.classList.remove("hidden");
  }

  function hide(el) {
    el?.classList.add("hidden");
  }

  function setError(msg) {
    if (loginError) {
      loginError.textContent = msg || "";
    }
  }

  function setHint(msg) {
    if (loginHint) {
      loginHint.textContent = msg || "";
    }
  }

  function setFeedback(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg || "";
    if (isError) {
      el.classList.add("error");
    } else {
      el.classList.remove("error");
    }
  }

  function clearFeedback(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.remove("error");
  }

  if (backendMode === "local") {
    setHint("Standardlogin (lokal backend): admin@subra.dk / admin");
  }

  setupEventListeners();

  // --- auth state
  adapter.onAuthStateChanged(async (user) => {
    if (user) {
      setError("");
      setHint("");
        if (activeAdmin) {
          activeAdmin.textContent = user.name || user.email || `(anon) ${user.uid}`;
        }
      hide(loginView);
      show(adminMain);
      await reloadState();
    } else {
      show(loginView);
      hide(adminMain);
      if (activeAdmin) {
        activeAdmin.textContent = "";
      }
    }
  });

  // --- login form
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("");
      setHint("Logger ind …");
      const email = loginEmail?.value.trim();
      const pass = loginPass?.value;
      try {
        await adapter.signInWithPassword(email, pass);
        setHint("");
      } catch (err) {
        setHint("");
      }
    });
  }

  // --- logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await adapter.signOut();
      } catch (e) {
        console.warn("Kunne ikke logge ud", e);
      }
    });
  }

  async function reloadState(showFeedback = false) {
    if (syncNowBtn) {
      syncNowBtn.disabled = true;
      syncNowBtn.textContent = "Synkroniserer…";
    }
    try {
      const remote = await adapter.fetchState();
      setState(remote || {});
      if (showFeedback) {
        setFeedback(exportFeedback, "Data opdateret.");
      }
    } catch (error) {
      console.error("Kunne ikke hente state", error);
      if (showFeedback) {
        setFeedback(exportFeedback, `Kunne ikke hente data: ${error.message}`, true);
      }
    } finally {
      if (syncNowBtn) {
        syncNowBtn.disabled = false;
        syncNowBtn.textContent = "Synkroniser nu";
      }
    }
  }

  function setState(nextState) {
    currentState = ensureStateDefaults(nextState);
    renderAll();
  }

  function renderAll() {
    renderStateSummary(currentState);
    updateDepartmentOptions(true);
    updateExportEmployeeOptions();
    renderActivity();
    renderEmployeeList();
    renderAbsenceList();
    renderSlides();
    renderQrLinks();
    renderPolicy();
  }

  function renderStateSummary(state) {
    if (!statGrid) return;
    if (!state) {
      statGrid.innerHTML = "";
      return;
    }

    const employees = Array.isArray(state.employees) ? state.employees : [];
    const guests = getGuestsForToday(state);
    const onsite = employees.filter((e) => e.status === "onsite").length;
    const remote = employees.filter((e) => e.status === "remote").length;
    const away = employees.filter((e) => e.status === "away").length;

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

  function renderActivity() {
    if (!activityBody) return;
    const logs = Array.isArray(currentState.logs) ? currentState.logs : [];
    const departmentFilter = activityDepartmentFilter?.value || "all";
    const typeFilter = activityTypeFilter?.value || "all";

    const filtered = logs.filter((entry) => {
      if (!entry) return false;
      if (typeFilter !== "all" && entry.type !== typeFilter) {
        return false;
      }
      if (departmentFilter !== "all") {
        const department = determineDepartment(entry);
        if (!department || department !== departmentFilter) {
          return false;
        }
      }
      return true;
    });

    if (!filtered.length) {
      activityBody.innerHTML = `
        <tr>
          <td colspan="4">Ingen aktiviteter matcher filtrene.</td>
        </tr>
      `;
      return;
    }

    activityBody.innerHTML = filtered.slice(0, 250).map((entry) => {
      const timestamp = escapeHtml(formatTimestamp(entry.timestamp));
      const subject = escapeHtml(getEntrySubject(entry));
      const typeLabel = escapeHtml(translateType(entry.type));
      const details = escapeHtml(getEntryDetails(entry));
      return `
        <tr>
          <td>${timestamp}</td>
          <td>${subject}</td>
          <td>${typeLabel}</td>
          <td>${details || "—"}</td>
        </tr>
      `;
    }).join("");
  }

  function renderEmployeeList() {
    if (!employeeList) return;
    const employees = (currentState.employees || []).slice().sort(compareEmployees);
    if (!employees.length) {
      employeeList.innerHTML = `<p class="muted">Ingen medarbejdere registreret endnu.</p>`;
      return;
    }

    const activeId = employeeId?.value;

    employeeList.innerHTML = employees
      .map((emp) => {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        const meta = [emp.department, emp.role].filter(Boolean).join(" · ");
        return `
          <div class="list-item${emp.id === activeId ? " active" : ""}" data-employee-id="${escapeHtml(emp.id)}">
            <div>
              <strong>${escapeHtml(fullName)}</strong>
              ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
            </div>
            <div class="list-actions">
              <button type="button" data-action="edit" data-id="${escapeHtml(emp.id)}">Rediger</button>
              <button type="button" data-action="delete" data-id="${escapeHtml(emp.id)}">Slet</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderAbsenceList() {
    if (!absenceList) return;
    const employees = Array.isArray(currentState.employees) ? currentState.employees : [];
    const awayEmployees = employees.filter((emp) => emp.status === "away" || emp.absence);
    if (!awayEmployees.length) {
      absenceList.innerHTML = `<p class="muted">Ingen registreret fravær lige nu.</p>`;
      return;
    }

    absenceList.innerHTML = awayEmployees
      .sort(compareEmployees)
      .map((emp) => {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        const range = formatAbsenceRange(emp.absence);
        return `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(fullName)}</strong>
              <small>${escapeHtml(emp.department || "")}</small>
            </div>
            <span class="absence-chip">${escapeHtml(range || STATUS_LABELS[emp.status] || "Fravær")}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderSlides() {
    if (!screensaverAdmin) return;
    const slides = currentState.screensaver?.slides || [];
    if (!slides.length) {
      screensaverAdmin.innerHTML = `<p class="muted">Ingen slides endnu. Upload filer eller placer assets i <code>${escapeHtml(cfg.storageFolder)}</code>.</p>`;
      return;
    }

    screensaverAdmin.innerHTML = slides
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((slide) => {
        const headline = slide.headline || slide.image || slide.id;
        const theme = slide.theme ? `Tema: ${slide.theme}` : "";
        const image = slide.image ? truncate(slide.image, 80) : "";
        const meta = [theme, image].filter(Boolean).join(" · ");
        return `
          <div class="list-item" data-slide-id="${escapeHtml(slide.id)}">
            <div>
              <strong>${escapeHtml(headline || "Slide")}</strong>
              ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
            </div>
            <div class="list-actions">
              <button type="button" data-action="delete-slide" data-id="${escapeHtml(slide.id)}">Fjern</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderQrLinks() {
    if (qrEmployee) {
      qrEmployee.value = currentState.qrLinks?.employee || "";
    }

    if (qrEmployeeLink) {
      const url = currentState.qrLinks?.employee || "";
      if (url) {
        const safeUrl = escapeAttribute(url);
        qrEmployeeLink.innerHTML = `<a href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
      } else {
        qrEmployeeLink.innerHTML = `<span class="muted">Ingen link angivet</span>`;
      }
    }

    clearFeedback(qrFeedback);
  }

  function renderPolicy() {
    if (policyNdaLink) {
      policyNdaLink.value = currentState.policyLinks?.nda || "";
    }
    clearFeedback(policyFeedback);
  }

  function updateDepartmentOptions(includeInputValue = false) {
    const inputDepartment = employeeDepartment?.value.trim();
    const departments = Array.from(
      new Set(
        (currentState.employees || [])
          .map((emp) => emp.department)
          .filter(Boolean)
      )
    );

    if (includeInputValue && inputDepartment) {
      departments.push(inputDepartment);
    }

    departments.sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));

    if (activityDepartmentFilter) {
      const previous = activityDepartmentFilter.value;
      activityDepartmentFilter.innerHTML = `
        <option value="all">Alle afdelinger</option>
        ${departments.map((dept) => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`).join("")}
      `;

      if (departments.includes(previous)) {
        activityDepartmentFilter.value = previous;
      } else {
        activityDepartmentFilter.value = "all";
      }
    }

    if (departmentOptionsList) {
      departmentOptionsList.innerHTML = departments
        .map((dept) => `<option value="${escapeAttribute(dept)}"></option>`)
        .join("");
    }
  }

  function updateExportEmployeeOptions() {
    if (!exportEmployee) return;
    const previous = exportEmployee.value;
    const employees = (currentState.employees || []).slice().sort(compareEmployees);
    exportEmployee.innerHTML = `
      <option value="all">Alle medarbejdere</option>
      ${employees
        .map((emp) => `<option value="${escapeHtml(emp.id)}">${escapeHtml(`${emp.firstName} ${emp.lastName}`.trim())}</option>`)
        .join("")}
    `;

    if (employees.some((emp) => emp.id === previous)) {
      exportEmployee.value = previous;
    } else {
      exportEmployee.value = "all";
    }
  }

  function determineDepartment(entry) {
    if (!entry) return null;
    if (entry.department) return entry.department;
    if (entry.employeeId) {
      const employee = currentState.employees?.find((emp) => emp.id === entry.employeeId);
      if (employee?.department) return employee.department;
    }
    if (entry.guest?.hostId) {
      const host = currentState.employees?.find((emp) => emp.id === entry.guest.hostId);
      if (host?.department) return host.department;
    }
    return null;
  }

  function getEntrySubject(entry) {
    if (!entry) return "Ukendt";
    if (entry.type === "guest-checkin" && entry.guest) {
      const guest = entry.guest;
      const parts = [guest.name, guest.company].filter(Boolean);
      return parts.length ? parts.join(" · ") : "Gæst";
    }
    if (entry.employeeId) {
      const employee = currentState.employees?.find((emp) => emp.id === entry.employeeId);
      if (employee) {
        return `${employee.firstName} ${employee.lastName}`.trim() || employee.id;
      }
      return entry.employeeName || entry.employeeId;
    }
    return entry.subject || "System";
  }

  function getEntryDetails(entry) {
    if (!entry) return "";
    const parts = [];
    if (entry.type === "status-change") {
      if (entry.status) {
        parts.push(`Status: ${translateStatus(entry.status)}`);
      }
      if (entry.note) {
        parts.push(entry.note);
      }
      if (entry.absence && (entry.absence.from || entry.absence.to)) {
        parts.push(`Periode: ${formatAbsenceRange(entry.absence)}`);
      }
    }
    if (entry.type === "guest-checkin" && entry.guest) {
      const guest = entry.guest;
      if (guest.hostId) {
        const host = currentState.employees?.find((emp) => emp.id === guest.hostId);
        if (host) {
          parts.push(`Vært: ${host.firstName} ${host.lastName}`.trim());
        }
      }
      if (guest.purpose) {
        parts.push(`Formål: ${guest.purpose}`);
      }
    }
    if (entry.type === "employee-update" && entry.change) {
      parts.push(entry.change);
    }
    if (entry.type === "settings-change") {
      if (entry.change) {
        parts.push(entry.change);
      }
      if (entry.note) {
        parts.push(entry.note);
      }
    }
    if (!parts.length && entry.details) {
      parts.push(entry.details);
    }
    return parts.join(" · ");
  }

  function translateStatus(status) {
    return STATUS_LABELS[status] || status || "Ukendt";
  }

  function translateType(type) {
    return TYPE_LABELS[type] || type || "Event";
  }

  function compareEmployees(a, b) {
    const last = (a.lastName || "").localeCompare(b.lastName || "", "da", { sensitivity: "base" });
    if (last !== 0) return last;
    return (a.firstName || "").localeCompare(b.firstName || "", "da", { sensitivity: "base" });
  }

  function formatAbsenceRange(absence) {
    if (!absence) return "Registreret fravær";
    const from = absence.from ? formatDate(absence.from) : "";
    const to = absence.to ? formatDate(absence.to) : "";
    if (from && to) return `${from} – ${to}`;
    if (from) return `Fra ${from}`;
    if (to) return `Til ${to}`;
    return "Registreret fravær";
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function getGuestsForToday(state) {
    const source = Array.isArray(state.guests)
      ? state.guests
      : Array.isArray(state.guestsToday)
      ? state.guestsToday
      : [];
    const today = new Date();
    return source.filter((guest) => {
      const date = new Date(guest.timestamp || guest.time || guest.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }

  function setupEventListeners() {
    if (syncNowBtn) {
      syncNowBtn.addEventListener("click", () => reloadState(true));
    }

    if (activityDepartmentFilter) {
      activityDepartmentFilter.addEventListener("change", renderActivity);
    }

    if (activityTypeFilter) {
      activityTypeFilter.addEventListener("change", renderActivity);
    }

    if (exportForm) {
      exportForm.addEventListener("submit", handleExportSubmit);
    }

    if (newEmployeeBtn) {
      newEmployeeBtn.addEventListener("click", () => {
        clearEmployeeForm();
        setFeedback(employeeFeedback, "Klar til at oprette ny medarbejder.");
        employeeFirst?.focus();
      });
    }

    if (employeeDepartment) {
      employeeDepartment.addEventListener("input", () => updateDepartmentOptions(true));
    }

    if (employeeForm) {
      employeeForm.addEventListener("submit", handleEmployeeSubmit);
    }

    if (resetFormBtn) {
      resetFormBtn.addEventListener("click", () => {
        clearEmployeeForm();
        setFeedback(employeeFeedback, "Formular nulstillet.");
      });
    }

    if (employeeList) {
      employeeList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = button.dataset.id;
        if (!id) return;
        if (button.dataset.action === "edit") {
          const employee = currentState.employees?.find((emp) => emp.id === id);
          if (employee) {
            populateEmployeeForm(employee);
            setFeedback(employeeFeedback, `Redigerer ${employee.firstName} ${employee.lastName}.`);
          }
        }
        if (button.dataset.action === "delete") {
          handleEmployeeDelete(id);
        }
      });
    }

    if (addSlideBtn) {
      addSlideBtn.addEventListener("click", () => slideUpload?.click());
    }

    if (slideUpload) {
      slideUpload.addEventListener("change", handleSlideUpload);
    }

    if (screensaverAdmin) {
      screensaverAdmin.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action='delete-slide']");
        if (!button) return;
        const id = button.dataset.id;
        if (!id) return;
        handleSlideDelete(id);
      });
    }

    if (qrForm) {
      qrForm.addEventListener("submit", handleQrSubmit);
    }

    if (policyForm) {
      policyForm.addEventListener("submit", handlePolicySubmit);
    }
  }

  async function handleEmployeeSubmit(event) {
    event.preventDefault();
    if (!employeeForm?.reportValidity()) {
      return;
    }

    const id = employeeId?.value.trim();
    const firstName = employeeFirst?.value.trim() || "";
    const lastName = employeeLast?.value.trim() || "";
    const department = employeeDepartment?.value.trim() || "";
    const role = employeeRole?.value.trim() || "";
    const contact = employeeContact?.value.trim() || "";
    const photo = employeePhoto?.value.trim() || "";

    if (!firstName || !lastName || !department) {
      setFeedback(employeeFeedback, "Udfyld fornavn, efternavn og afdeling.", true);
      return;
    }

    const now = new Date().toISOString();
    let message = "Opdaterede medarbejder.";
    let employee;

    if (id) {
      employee = currentState.employees?.find((emp) => emp.id === id);
      if (!employee) {
        setFeedback(employeeFeedback, "Kunne ikke finde medarbejderen i data.", true);
        return;
      }
      Object.assign(employee, {
        firstName,
        lastName,
        department,
        role,
        contact,
        photo,
      });
      message = "Opdaterede medarbejder.";
    } else {
      const newId = generateEmployeeId(firstName, lastName);
      employee = {
        id: newId,
        firstName,
        lastName,
        department,
        role,
        contact,
        photo,
        status: "unknown",
        statusNotes: "",
        lastStatusChange: now,
      };
      currentState.employees = currentState.employees || [];
      currentState.employees.push(employee);
      message = "Oprettede ny medarbejder.";
    }

    currentState.employees.sort(compareEmployees);
    logActivity({
      type: "employee-update",
      employeeId: employee.id,
      department: employee.department,
      change: message,
    });

    try {
      await persistState(employeeFeedback, message);
      clearEmployeeForm();
      renderAll();
    } catch (error) {
      console.error("Kunne ikke gemme medarbejder", error);
    }
  }

  function clearEmployeeForm() {
    if (!employeeForm) return;
    employeeForm.reset();
    if (employeeId) employeeId.value = "";
    clearFeedback(employeeFeedback);
  }

  function populateEmployeeForm(employee) {
    if (!employee) return;
    if (employeeId) employeeId.value = employee.id || "";
    if (employeeFirst) employeeFirst.value = employee.firstName || "";
    if (employeeLast) employeeLast.value = employee.lastName || "";
    if (employeeDepartment) employeeDepartment.value = employee.department || "";
    if (employeeRole) employeeRole.value = employee.role || "";
    if (employeeContact) employeeContact.value = employee.contact || "";
    if (employeePhoto) employeePhoto.value = employee.photo || "";
  }

  async function handleEmployeeDelete(id) {
    const employee = currentState.employees?.find((emp) => emp.id === id);
    if (!employee) {
      setFeedback(employeeFeedback, "Medarbejderen findes ikke længere.", true);
      return;
    }
    const confirmed = window.confirm(`Vil du slette ${employee.firstName} ${employee.lastName}?`);
    if (!confirmed) {
      return;
    }

    currentState.employees = currentState.employees.filter((emp) => emp.id !== id);
    logActivity({
      type: "employee-update",
      employeeId: id,
      department: employee.department,
      change: `Slettede ${employee.firstName} ${employee.lastName}.`,
    });

    if (employeeId?.value === id) {
      clearEmployeeForm();
    }

    try {
      await persistState(employeeFeedback, "Medarbejderen er fjernet.");
      renderAll();
    } catch (error) {
      console.error("Kunne ikke slette medarbejder", error);
    }
  }

  async function handleSlideUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFeedback(slideFeedback, "Uploader billede …");

    try {
      const upload = await adapter.uploadSlide(file, (snapshot) => {
        if (!slideFeedback) return;
        if (!snapshot?.bytesTransferred || !snapshot?.totalBytes) return;
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setFeedback(slideFeedback, `Uploader billede … ${percent}%`);
      });

      const now = new Date().toISOString();
      const headline = file.name ? file.name.replace(/\.[^.]+$/, "") : "Nyt slide";
      const slide = {
        id: `slide-${Date.now()}`,
        headline,
        description: "",
        theme: "fjord",
        image: upload.downloadURL,
        storagePath: upload.storagePath || null,
        order: (currentState.screensaver?.slides?.length || 0),
        createdAt: now,
        updatedAt: now,
      };

      currentState.screensaver = currentState.screensaver || { slides: [] };
      currentState.screensaver.slides = normalizeSlides([
        ...(currentState.screensaver.slides || []),
        slide,
      ]);
      currentState.slides = currentState.screensaver.slides;

      logActivity({
        type: "settings-change",
        change: `Tilføjede slide ${headline}.`,
      });

      await persistState(slideFeedback, "Slide tilføjet.");
      renderSlides();
    } catch (error) {
      console.error("Fejl ved upload af slide", error);
      setFeedback(slideFeedback, `Kunne ikke uploade billede: ${error.message}`, true);
    } finally {
      if (slideUpload) {
        slideUpload.value = "";
      }
    }
  }

  async function handleSlideDelete(id) {
    const slides = currentState.screensaver?.slides || [];
    const index = slides.findIndex((slide) => slide.id === id);
    if (index === -1) return;
    const slide = slides[index];
    const confirmed = window.confirm(`Vil du fjerne slide ${slide.headline || slide.id}?`);
    if (!confirmed) return;

    slides.splice(index, 1);
    slides.forEach((item, idx) => {
      item.order = idx;
    });
    currentState.slides = slides;

    logActivity({
      type: "settings-change",
      change: `Fjernede slide ${slide.headline || slide.id}.`,
    });

    try {
      await persistState(slideFeedback, "Slide fjernet.");
      renderSlides();
      if (slide?.storagePath) {
        try {
          await adapter.deleteSlide(slide.storagePath);
        } catch (error) {
          console.warn("Kunne ikke slette slide-asset", error);
        }
      }
    } catch (error) {
      console.error("Kunne ikke fjerne slide", error);
    }
  }

  async function handleQrSubmit(event) {
    event.preventDefault();
    const url = qrEmployee?.value.trim() || "";
    currentState.qrLinks = currentState.qrLinks || {};
    currentState.qrLinks.employee = url;

    logActivity({
      type: "settings-change",
      change: "Opdaterede medarbejder QR-link.",
      note: url,
    });

    try {
      await persistState(qrFeedback, "QR-link opdateret.");
      renderQrLinks();
    } catch (error) {
      console.error("Kunne ikke opdatere QR-link", error);
    }
  }

  async function handlePolicySubmit(event) {
    event.preventDefault();
    const url = policyNdaLink?.value.trim() || "";
    currentState.policyLinks = currentState.policyLinks || {};
    currentState.policyLinks.nda = url;

    logActivity({
      type: "settings-change",
      change: "Opdaterede NDA-link for gæster.",
      note: url,
    });

    try {
      await persistState(policyFeedback, "Link gemt.");
      renderPolicy();
    } catch (error) {
      console.error("Kunne ikke gemme politik-link", error);
    }
  }

  async function handleExportSubmit(event) {
    event.preventDefault();
    const logs = Array.isArray(currentState.logs) ? currentState.logs : [];
    if (!logs.length) {
      setFeedback(exportFeedback, "Ingen logposter at eksportere.");
      return;
    }

    const employeeFilter = exportEmployee?.value || "all";
    const includeGuests = exportIncludeGuests?.checked !== false;
    const includeStatus = exportIncludeStatus?.checked !== false;
    const fromDate = parseDateInput(exportFrom?.value, true);
    const toDate = parseDateInput(exportTo?.value, false);

    const filtered = logs.filter((entry) => {
      if (!entry) return false;
      if (entry.type === "guest-checkin" && !includeGuests) return false;
      if (entry.type === "status-change" && !includeStatus) return false;
      if (employeeFilter !== "all") {
        const matchesEmployee =
          entry.employeeId === employeeFilter || entry.guest?.hostId === employeeFilter;
        if (!matchesEmployee) return false;
      }
      if (!isWithinRange(entry.timestamp, fromDate, toDate)) return false;
      return true;
    });

    if (!filtered.length) {
      setFeedback(exportFeedback, "Ingen data matcher filtrene.", true);
      return;
    }

    const rows = filtered.map((entry) => {
      return [
        formatTimestamp(entry.timestamp),
        getEntrySubject(entry),
        translateType(entry.type),
        getEntryDetails(entry) || "",
      ];
    });

    const header = ["Tidspunkt", "Medarbejder/gæst", "Type", "Detaljer"];
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => formatCsvCell(cell)).join(";"))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const filename = `subra-aktivitetslog-${new Date().toISOString().split("T")[0]}.csv`;
    triggerDownload(blob, filename);
    setFeedback(exportFeedback, `Eksporterede ${rows.length} linjer.`);
  }

  function parseDateInput(value, isStart) {
    if (!value) return null;
    const suffix = isStart ? "T00:00:00" : "T23:59:59";
    const date = new Date(`${value}${suffix}`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function isWithinRange(timestamp, from, to) {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function formatCsvCell(value) {
    const text = `${value ?? ""}`.replace(/\r?\n|\r/g, " ").trim();
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function logActivity(entry) {
    currentState.logs = Array.isArray(currentState.logs) ? currentState.logs : [];
    currentState.logs.unshift({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    if (currentState.logs.length > MAX_LOG_ENTRIES) {
      currentState.logs.length = MAX_LOG_ENTRIES;
    }
  }

  async function persistState(feedbackEl, successMessage) {
    if (isSaving) return;
    isSaving = true;
    if (feedbackEl) {
      setFeedback(feedbackEl, "Gemmer …");
    }
    try {
      const payload = prepareStateForSave(currentState);
      const saved = await adapter.saveState(payload);
      currentState = ensureStateDefaults(saved);
      renderAll();
      if (feedbackEl) {
        setFeedback(feedbackEl, successMessage || "Ændringer gemt.");
      }
    } catch (error) {
      if (feedbackEl) {
        setFeedback(feedbackEl, `Kunne ikke gemme: ${error.message}`, true);
      }
      throw error;
    } finally {
      isSaving = false;
    }
  }

  function generateEmployeeId(firstName, lastName, existingList) {
    const slug = slugify(`${firstName} ${lastName}`.trim()) || `emp-${Date.now()}`;
    let base = `emp-${slug}`;
    let counter = 1;
    const existing = Array.isArray(existingList)
      ? existingList
      : Array.isArray(currentState?.employees)
      ? currentState.employees
      : [];
    const hasId = (id) => existing.some((emp) => emp.id === id);
    while (hasId(base)) {
      counter += 1;
      base = `emp-${slug}-${counter}`;
    }
    return base;
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function ensureStateDefaults(data = {}) {
    const source = data && typeof data === "object" ? data : {};
    const employeesSource = Array.isArray(source.employees)
      ? source.employees
      : Array.isArray(DEFAULTS.employees)
      ? DEFAULTS.employees
      : [];
    const logsSource = Array.isArray(source.logs) ? source.logs : [];
    const guestsSource = Array.isArray(source.guests)
      ? source.guests
      : Array.isArray(source.guestsToday)
      ? source.guestsToday
      : Array.isArray(DEFAULTS.guests)
      ? DEFAULTS.guests
      : [];
    const slidesSource = source.screensaver?.slides || source.slides || DEFAULTS.slides || [];

    const employees = [];
    employeesSource.forEach((raw) => {
      const normalized = normalizeEmployee(raw, employees);
      if (normalized) {
        employees.push(normalized);
      }
    });
    const logs = logsSource.map(normalizeLog).filter(Boolean);
    const guests = guestsSource.map(normalizeGuest).filter(Boolean);
    const slides = normalizeSlides(slidesSource);

    return {
      ...source,
      employees,
      logs,
      guests,
      guestsToday: guests,
      screensaver: {
        ...(source.screensaver || {}),
        slides,
      },
      slides,
      qrLinks: {
        employee: (source.qrLinks?.employee || DEFAULTS.qrLinks?.employee || "").trim(),
        guest: (source.qrLinks?.guest || DEFAULTS.qrLinks?.guest || "").trim(),
      },
      policyLinks: {
        nda: (source.policyLinks?.nda || DEFAULTS.policyLinks?.nda || "").trim(),
      },
      updatedAt: source.updatedAt || null,
    };
  }

  function normalizeEmployee(employee, existing = []) {
    if (!employee) return null;
    return {
      id: employee.id || generateEmployeeId(employee.firstName || "", employee.lastName || "", existing),
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      department: employee.department || "",
      role: employee.role || "",
      contact: employee.contact || "",
      photo: employee.photo || "",
      status: employee.status || "unknown",
      statusNotes: employee.statusNotes || "",
      lastStatusChange: employee.lastStatusChange || null,
      absence: employee.absence && (employee.absence.from || employee.absence.to)
        ? { from: employee.absence.from || "", to: employee.absence.to || "" }
        : undefined,
    };
  }

  function normalizeLog(entry) {
    if (!entry || typeof entry !== "object") return null;
    const timestamp = entry.timestamp || entry.time || new Date().toISOString();
    const normalized = {
      type: entry.type || "status-change",
      timestamp,
      employeeId: entry.employeeId || entry.employee?.id || null,
      employeeName: entry.employeeName || "",
      department: entry.department || null,
      note: entry.note || entry.notes || "",
      status: entry.status || null,
      absence: entry.absence ? { from: entry.absence.from || "", to: entry.absence.to || "" } : undefined,
      guest: entry.guest ? normalizeGuest(entry.guest) : null,
      change: entry.change || entry.description || "",
      details: entry.details || "",
      subject: entry.subject || "",
    };
    return normalized;
  }

  function normalizeGuest(guest) {
    if (!guest || typeof guest !== "object") return null;
    return {
      id: guest.id || `guest-${Date.now()}`,
      name: guest.name || "",
      company: guest.company || "",
      hostId: guest.hostId || guest.host?.id || null,
      purpose: guest.purpose || "",
      timestamp: guest.timestamp || guest.time || new Date().toISOString(),
    };
  }

  function normalizeSlides(slides) {
    return (Array.isArray(slides) ? slides : []).map((slide, index) => ({
      id: slide.id || `slide-${Date.now()}-${index}`,
      headline: slide.headline || "",
      description: slide.description || "",
      theme: slide.theme || "fjord",
      image: slide.image || "",
      storagePath: slide.storagePath || null,
      order: typeof slide.order === "number" ? slide.order : index,
      createdAt: slide.createdAt || null,
      updatedAt: slide.updatedAt || null,
    })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function prepareStateForSave(state) {
    const payload = serializeForStorage({
      ...state,
      slides: state.screensaver?.slides || state.slides || [],
      guests: state.guests || state.guestsToday || [],
      guestsToday: state.guests || state.guestsToday || [],
    });
    payload.screensaver = {
      ...(payload.screensaver || {}),
      slides: payload.slides || [],
    };
    return payload;
  }

  function serializeForStorage(data) {
    const seen = new WeakSet();

    function clean(value) {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      if (typeof value === "function") {
        return undefined;
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (isFirestoreNativeValue(value)) {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map((entry) => {
          const cleaned = clean(entry);
          return cleaned === undefined ? null : cleaned;
        });
      }

      if (typeof value === "object") {
        if (seen.has(value)) {
          return null;
        }
        seen.add(value);
        const result = {};
        Object.keys(value).forEach((key) => {
          const cleaned = clean(value[key]);
          if (cleaned !== undefined) {
            result[key] = cleaned;
          }
        });
        seen.delete(value);
        return result;
      }

      return value;
    }

    function isFirestoreNativeValue(value) {
      if (!value || !window.firebase || !window.firebase.firestore) {
        return false;
      }
      const firestore = window.firebase.firestore;
      if (firestore.Timestamp && value instanceof firestore.Timestamp) {
        return true;
      }
      if (firestore.GeoPoint && value instanceof firestore.GeoPoint) {
        return true;
      }
      if (firestore.DocumentReference && value instanceof firestore.DocumentReference) {
        return true;
      }
      if (firestore.Blob && value instanceof firestore.Blob) {
        return true;
      }
      // FieldValue-sentinels identificeres ved et internt flag `_methodName`
      if (typeof value === "object" && (value._methodName || value._isFieldValue)) {
        return true;
      }
      return false;
    }

    return clean(data);
  }

  function escapeHtml(value) {
    return `${value ?? ""}`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function truncate(value, length) {
    const text = `${value ?? ""}`;
    if (text.length <= length) return text;
    return `${text.slice(0, length - 1)}…`;
  }
})();
