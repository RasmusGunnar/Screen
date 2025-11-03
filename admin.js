const SUPABASE_CONFIG = window.SUBRA_SUPABASE_CONFIG || null;
const SUPABASE_TABLE = window.SUBRA_KIOSK_TABLE || 'kiosk_state';
const SUPABASE_ROW_ID = window.SUBRA_KIOSK_DOCUMENT || 'subra-main';
const SUPABASE_BUCKET = window.SUBRA_ASSET_BUCKET || 'kiosk-assets';
const SUPABASE_STORAGE_FOLDER = window.SUBRA_ASSET_FOLDER || 'screensaver';
const DEFAULTS = window.SUBRA_DEFAULTS || {};
const ADMIN_AUTH = window.SUBRA_ADMIN_AUTH || null;
const SLIDE_THEMES = [
  { value: 'fjord', label: 'Fjord · kølig blå' },
  { value: 'aurora', label: 'Aurora · grøn gradient' },
  { value: 'ocean', label: 'Ocean · dyb turkis' },
  { value: 'sand', label: 'Sand · varm neutral' },
  { value: 'forest', label: 'Forest · nordisk grøn' },
];

let state = ensureStateDefaults();
let supabaseClient = null;
let supabaseChannel = null;
let isCloudReady = false;
let isApplyingRemoteState = false;
let pendingSlideUploadId = null;
let activeAdmin = null;
const ADMIN_SESSION_KEY = 'subra-admin-session';

const elements = {
  loginView: document.getElementById('login-view'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPasscode: document.getElementById('login-passcode'),
  loginError: document.getElementById('login-error'),
  loginHint: document.getElementById('login-hint'),
  adminMain: document.getElementById('admin-main'),
  activeAdmin: document.getElementById('active-admin'),
  logout: document.getElementById('logout'),
  syncNow: document.getElementById('sync-now'),
  syncLog: document.getElementById('sync-log'),
  statGrid: document.getElementById('stat-grid'),
  activityBody: document.getElementById('activity-body'),
  activityTypeFilter: document.getElementById('activity-type-filter'),
  activityDepartmentFilter: document.getElementById('activity-department-filter'),
  exportForm: document.getElementById('export-form'),
  exportEmployee: document.getElementById('export-employee'),
  exportFrom: document.getElementById('export-from'),
  exportTo: document.getElementById('export-to'),
  exportIncludeGuests: document.getElementById('export-include-guests'),
  exportIncludeStatus: document.getElementById('export-include-status'),
  exportFeedback: document.getElementById('export-feedback'),
  employeeForm: document.getElementById('employee-form'),
  employeeId: document.getElementById('employee-id'),
  employeeFirst: document.getElementById('employee-first'),
  employeeLast: document.getElementById('employee-last'),
  employeeDepartment: document.getElementById('employee-department'),
  employeeRole: document.getElementById('employee-role'),
  employeeContact: document.getElementById('employee-contact'),
  employeePhoto: document.getElementById('employee-photo'),
  employeeList: document.getElementById('employee-list'),
  newEmployee: document.getElementById('new-employee'),
  resetForm: document.getElementById('reset-form'),
  absenceList: document.getElementById('absence-list'),
  screensaverAdmin: document.getElementById('screensaver-admin'),
  addSlide: document.getElementById('add-slide'),
  slideUpload: document.getElementById('slide-upload'),
  qrForm: document.getElementById('qr-form'),
  qrEmployee: document.getElementById('qr-employee'),
  qrGuest: document.getElementById('qr-guest'),
  qrEmployeeLink: document.getElementById('qr-employee-link'),
  qrGuestLink: document.getElementById('qr-guest-link'),
};

initializeAdmin();

function initializeAdmin() {
  if (elements.loginHint && ADMIN_AUTH?.hint) {
    elements.loginHint.textContent = ADMIN_AUTH.hint;
  }

  elements.loginForm?.addEventListener('submit', handleLoginSubmit);
  elements.logout?.addEventListener('click', handleLogout);
  elements.syncNow?.addEventListener('click', () => commitState());
  elements.activityTypeFilter?.addEventListener('change', renderActivityLog);
  elements.activityDepartmentFilter?.addEventListener('change', renderActivityLog);
  elements.exportForm?.addEventListener('submit', handleExportSubmit);
  elements.employeeForm?.addEventListener('submit', handleEmployeeSubmit);
  elements.resetForm?.addEventListener('click', resetEmployeeForm);
  elements.newEmployee?.addEventListener('click', () => {
    resetEmployeeForm();
    elements.employeeFirst?.focus();
  });
  elements.screensaverAdmin?.addEventListener('input', handleSlideFieldChange);
  elements.screensaverAdmin?.addEventListener('click', handleSlideAdminClick);
  elements.addSlide?.addEventListener('click', handleAddSlide);
  elements.slideUpload?.addEventListener('change', handleSlideUploadChange);
  elements.qrForm?.addEventListener('submit', handleQrSubmit);

  restoreSession();
}

function ensureStateDefaults(data = {}) {
  const seedEmployees = DEFAULTS.employees || [];
  const employees = (data.employees || seedEmployees).map((emp) => ({
    ...emp,
    lastStatusChange: emp.lastStatusChange || new Date().toISOString(),
  }));

  const qrLinks = {
    employee: (data.qrLinks?.employee || (DEFAULTS.qrLinks?.employee || '')).trim(),
    guest: (data.qrLinks?.guest || (DEFAULTS.qrLinks?.guest || '')).trim(),
  };

  const settings = {
    kiosk: {
      table: data.settings?.kiosk?.table || SUPABASE_TABLE,
      document: data.settings?.kiosk?.document || SUPABASE_ROW_ID,
      lastSynced: data.settings?.kiosk?.lastSynced || null,
    },
  };

  return {
    employees,
    guests: data.guests || [],
    logs: data.logs || [],
    policyAcknowledgements: data.policyAcknowledgements || {},
    screensaver: {
      slides: normalizeSlides(data.screensaver?.slides || data.slides || DEFAULTS.slides || []),
    },
    qrLinks,
    settings,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeSlides(slides) {
  const fallback = Array.isArray(slides) && slides.length ? slides : DEFAULTS.slides || [];
  return fallback
    .map((slide, index) => ({
      id: slide.id || `slide-${Date.now()}-${index}`,
      theme: slide.theme || 'fjord',
      headline: slide.headline || '',
      description: slide.description || '',
      image: slide.image || '',
      storagePath: slide.storagePath || null,
      order: typeof slide.order === 'number' ? slide.order : index,
      createdAt: slide.createdAt || null,
      updatedAt: slide.updatedAt || null,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!ADMIN_AUTH?.users?.length) {
    elements.loginError.textContent = 'Ingen administratorer er konfigureret. Opdater supabase-config.js';
    return;
  }

  const email = elements.loginEmail.value.trim().toLowerCase();
  const passcode = elements.loginPasscode.value;
  const user = ADMIN_AUTH.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    elements.loginError.textContent = 'Ugyldig kombination af e-mail og adgangskode';
    return;
  }

  try {
    const hash = await hashPasscode(passcode);
    if (hash !== user.passcodeHash) {
      elements.loginError.textContent = 'Ugyldig kombination af e-mail og adgangskode';
      return;
    }

    activeAdmin = {
      email: user.email,
      name: user.name || user.email,
    };
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ email: user.email }));
    elements.loginError.textContent = '';
    showAdmin();
    await initializeSupabase();
  } catch (error) {
    console.error('Login fejlede', error);
    elements.loginError.textContent = 'Kunne ikke validere login. Prøv igen.';
  }
}

async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function restoreSession() {
  try {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (!parsed?.email) return;
    const user = ADMIN_AUTH?.users?.find((item) => item.email.toLowerCase() === parsed.email.toLowerCase());
    if (!user) return;

    activeAdmin = {
      email: user.email,
      name: user.name || user.email,
    };
    showAdmin();
    void initializeSupabase();
  } catch (error) {
    console.warn('Kunne ikke gendanne admins session', error);
  }
}

function showAdmin() {
  if (elements.loginView) elements.loginView.classList.add('hidden');
  if (elements.adminMain) elements.adminMain.classList.remove('hidden');
  if (elements.activeAdmin && activeAdmin) {
    elements.activeAdmin.textContent = `Logget ind som ${activeAdmin.name} (${activeAdmin.email})`;
  }
}

function handleLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  activeAdmin = null;
  if (supabaseChannel && supabaseClient) {
    supabaseClient.removeChannel(supabaseChannel);
    supabaseChannel = null;
  }
  supabaseClient = null;
  isCloudReady = false;
  isApplyingRemoteState = false;
  state = ensureStateDefaults();
  renderAll();
  if (elements.loginView) elements.loginView.classList.remove('hidden');
  if (elements.adminMain) elements.adminMain.classList.add('hidden');
  elements.loginForm?.reset();
}

function applyRemoteState(remote) {
  isApplyingRemoteState = true;
  state = ensureStateDefaults(remote);
  renderAll();
  isApplyingRemoteState = false;
}

async function initializeSupabase() {
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    appendSyncLog('Supabase SDK kunne ikke indlæses. Kontrollér netværket.');
    return;
  }

  if (!SUPABASE_CONFIG?.url || !SUPABASE_CONFIG?.anonKey) {
    appendSyncLog('Tilføj dine Supabase-nøgler i supabase-config.js for at aktivere sky-synkronisering.');
    return;
  }

  try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      realtime: { params: { eventsPerSecond: 2 } },
    });

    await ensureCloudState();
    subscribeToCloudState();
    isCloudReady = true;
    appendSyncLog(`Forbundet til Supabase-projektet ${new URL(SUPABASE_CONFIG.url).host}.`);
  } catch (error) {
    console.error('Kunne ikke initialisere Supabase', error);
    appendSyncLog('Kunne ikke forbinde til Supabase. Kontrollér nøgler og netværk.');
    supabaseClient = null;
  }
}

async function ensureCloudState() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .select('payload')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data?.payload) {
      const seed = ensureStateDefaults(state);
      seed.updatedAt = new Date().toISOString();
      seed.settings.kiosk = {
        table: SUPABASE_TABLE,
        document: SUPABASE_ROW_ID,
        lastSynced: seed.updatedAt,
      };
      const { error: insertError } = await supabaseClient.from(SUPABASE_TABLE).upsert({
        id: SUPABASE_ROW_ID,
        payload: seed,
        updated_at: seed.updatedAt,
      });
      if (insertError) throw insertError;
      appendSyncLog('Oprettede nyt kiosk-dokument i Supabase.');
      applyRemoteState(seed);
    } else {
      applyRemoteState(data.payload);
    }
  } catch (error) {
    console.error('ensureCloudState fejlede', error);
    appendSyncLog('Kunne ikke hente initial data fra skyen.');
  }
}

function subscribeToCloudState() {
  if (!supabaseClient) return;
  if (supabaseChannel) supabaseClient.removeChannel(supabaseChannel);

  supabaseChannel = supabaseClient
    .channel(`admin-kiosk-${SUPABASE_ROW_ID}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SUPABASE_TABLE, filter: `id=eq.${SUPABASE_ROW_ID}` },
      (payload) => {
        if (!payload?.new?.payload || isApplyingRemoteState) return;
        applyRemoteState(payload.new.payload);
      }
    )
    .subscribe();
}

function commitState(nextState) {
  if (isApplyingRemoteState) return;
  state = ensureStateDefaults(nextState || state);
  if (!supabaseClient) {
    appendSyncLog('Sky-synkronisering er ikke aktiv. Gemningen springes over.');
    return;
  }

  if (!isCloudReady) {
    appendSyncLog('Venter på forbindelse til skyen. Prøv igen om et øjeblik.');
    return;
  }

  const snapshot = ensureStateDefaults(state);
  snapshot.updatedAt = new Date().toISOString();
  snapshot.settings.kiosk = {
    table: SUPABASE_TABLE,
    document: SUPABASE_ROW_ID,
    lastSynced: snapshot.updatedAt,
  };
  state = snapshot;

  supabaseClient
    .from(SUPABASE_TABLE)
    .upsert({ id: SUPABASE_ROW_ID, payload: snapshot, updated_at: snapshot.updatedAt })
    .then(({ error }) => {
      if (error) throw error;
      appendSyncLog('Skyen er opdateret.');
    })
    .catch((error) => {
      console.error('Kunne ikke gemme state', error);
      appendSyncLog('Fejl ved skrivning til Supabase.');
    });
}

function renderAll() {
  renderStats();
  renderActivityLog();
  renderExportOptions();
  renderEmployeeList();
  renderAbsenceList();
  renderScreensaverAdmin();
  renderQrPreview();
}

function renderStats() {
  if (!elements.statGrid) return;
  const onsite = state.employees.filter((emp) => emp.status === 'onsite').length;
  const remote = state.employees.filter((emp) => emp.status === 'remote').length;
  const away = state.employees.filter((emp) => emp.status === 'away').length;
  const guestsToday = state.guests.filter((guest) => isToday(guest.timestamp)).length;
  const statusChangesToday = state.logs.filter(
    (log) => log.type === 'status-change' && isToday(log.timestamp)
  ).length;

  const cards = [
    { label: 'Medarbejdere i alt', value: state.employees.length },
    { label: 'På kontoret', value: onsite },
    { label: 'Arbejde hjemmefra', value: remote },
    { label: 'Registreret fravær', value: away },
    { label: 'Check-ins i dag', value: statusChangesToday },
    { label: 'Gæster i dag', value: guestsToday },
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
    .join('');
}

function renderActivityLog() {
  if (!elements.activityBody) return;
  const typeFilter = elements.activityTypeFilter?.value || 'all';
  const departmentFilter = elements.activityDepartmentFilter?.value || 'all';

  const departmentMap = new Map(state.employees.map((emp) => [emp.id, emp.department]));

  const rows = state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (departmentFilter !== 'all' && entry.employeeId) {
        const department = departmentMap.get(entry.employeeId);
        if (department !== departmentFilter) return false;
      }
      return true;
    })
    .map((entry) => {
      const timestamp = escapeHtml(formatDateTime(entry.timestamp));
      if (entry.type === 'status-change') {
        const employee = state.employees.find((emp) => emp.id === entry.employeeId);
        const name = employee
          ? `${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}`
          : escapeHtml(entry.employeeId || '');
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
      if (entry.type === 'guest-checkin') {
        const guest = entry.guest || {};
        const host = state.employees.find((emp) => emp.id === guest.hostId);
        const hostLabel = host
          ? `${escapeHtml(host.firstName)} ${escapeHtml(host.lastName)}`
          : 'Ukendt vært';
        return `
          <tr>
            <td>${timestamp}</td>
            <td>${escapeHtml(guest.name || 'Gæst')}</td>
            <td>Gæst</td>
            <td>Besøger ${hostLabel}${guest.company ? ` · ${escapeHtml(guest.company)}` : ''}</td>
          </tr>
        `;
      }
      return '';
    })
    .join('');

  elements.activityBody.innerHTML = rows || `<tr><td colspan="4">Ingen hændelser endnu.</td></tr>`;

  populateDepartmentFilter();
}

function populateDepartmentFilter() {
  if (!elements.activityDepartmentFilter) return;
  const departments = Array.from(new Set(state.employees.map((emp) => emp.department))).sort((a, b) =>
    a.localeCompare(b, 'da', { sensitivity: 'base' })
  );
  const current = elements.activityDepartmentFilter.value;
  elements.activityDepartmentFilter.innerHTML =
    '<option value="all">Alle afdelinger</option>' +
    departments.map((dept) => {
      const safe = escapeHtml(dept);
      return `<option value="${safe}">${safe}</option>`;
    }).join('');
  if (current) {
    elements.activityDepartmentFilter.value = current;
  }
}

function renderExportOptions() {
  if (!elements.exportEmployee) return;
  const options = state.employees
    .slice()
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', {
      sensitivity: 'base',
    }))
    .map((emp) => {
      const name = `${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`;
      return `<option value="${escapeHtml(emp.id)}">${name}</option>`;
    })
    .join('');
  elements.exportEmployee.innerHTML = `<option value="all">Alle medarbejdere</option>${options}`;
}

function renderEmployeeList() {
  if (!elements.employeeList) return;
  elements.employeeList.innerHTML = '';

  state.employees
    .slice()
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', {
      sensitivity: 'base',
    }))
    .forEach((employee) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const info = document.createElement('div');
      const name = `${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}`;
      const role = escapeHtml(employee.role || 'Ingen titel');
      const department = escapeHtml(employee.department);
      const contact = escapeHtml(employee.contact || '');
      info.innerHTML = `
        <strong>${name}</strong>
        <small>${department} · ${role}</small>
        <small>${contact}</small>
      `;

      const actions = document.createElement('div');
      actions.className = 'list-actions';

      const resetPolicy = document.createElement('button');
      resetPolicy.type = 'button';
      resetPolicy.textContent = 'Politikker';
      resetPolicy.title = 'Nulstil NDA/IT-godkendelse';
      resetPolicy.addEventListener('click', () => resetPolicyAcknowledgement(employee.id));

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Redigér';
      edit.addEventListener('click', () => populateEmployeeForm(employee));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Slet';
      remove.addEventListener('click', () => deleteEmployee(employee.id));

      actions.append(resetPolicy, edit, remove);
      item.append(info, actions);
      elements.employeeList.appendChild(item);
    });
}

function renderAbsenceList() {
  if (!elements.absenceList) return;
  elements.absenceList.innerHTML = '';
  const awayEmployees = state.employees.filter((emp) => emp.status === 'away');
  if (!awayEmployees.length) {
    elements.absenceList.innerHTML = '<p>Ingen registreret fravær lige nu.</p>';
    return;
  }

  awayEmployees
    .slice()
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'da', { sensitivity: 'base' }))
    .forEach((employee) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const from = employee.absence?.from ? formatDate(employee.absence.from) : 'Ukendt start';
      const to = employee.absence?.to ? formatDate(employee.absence.to) : 'Ukendt slut';
      const name = `${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}`;
      const department = escapeHtml(employee.department);
      item.innerHTML = `
        <div>
          <strong>${name}</strong>
          <small>${department}</small>
          <span class="absence-chip">${escapeHtml(from)} → ${escapeHtml(to)}</span>
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
      const themeOptions = SLIDE_THEMES.map((theme) => {
        const selected = theme.value === slide.theme ? 'selected' : '';
        const value = escapeHtml(theme.value);
        const label = escapeHtml(theme.label);
        return `<option value="${value}" ${selected}>${label}</option>`;
      }).join('');
      const slideId = escapeHtml(slide.id);

      return `
        <div class="list-item" data-slide-id="${slideId}">
          <div>
            <strong>Slide ${index + 1}</strong>
            <small>ID: ${slideId}</small>
            <label><span>Tema</span><select data-field="theme">${themeOptions}</select></label>
            <label><span>Overskrift</span><input data-field="headline" value="${escapeHtml(slide.headline)}" /></label>
            <label><span>Beskrivelse</span><input data-field="description" value="${escapeHtml(slide.description)}" /></label>
            <label><span>Billede-URL</span><input data-field="image" value="${escapeHtml(slide.image || '')}" /></label>
          </div>
          <div class="list-actions">
            <button type="button" data-action="upload">Upload</button>
            <button type="button" data-action="up">Op</button>
            <button type="button" data-action="down">Ned</button>
            <button type="button" data-action="delete">Slet</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderQrPreview() {
  if (elements.qrEmployee) elements.qrEmployee.value = state.qrLinks.employee || '';
  if (elements.qrGuest) elements.qrGuest.value = state.qrLinks.guest || '';
  if (elements.qrEmployeeLink)
    elements.qrEmployeeLink.textContent = state.qrLinks.employee || 'Ingen URL angivet';
  if (elements.qrGuestLink) elements.qrGuestLink.textContent = state.qrLinks.guest || 'Ingen URL angivet';
}

function handleEmployeeSubmit(event) {
  event.preventDefault();
  if (!elements.employeeFirst || !elements.employeeLast || !elements.employeeDepartment) return;

  const id = elements.employeeId.value;
  const payload = {
    firstName: elements.employeeFirst.value.trim(),
    lastName: elements.employeeLast.value.trim(),
    department: elements.employeeDepartment.value.trim(),
    role: elements.employeeRole.value.trim(),
    contact: elements.employeeContact.value.trim(),
    photo: elements.employeePhoto.value.trim(),
  };

  if (!payload.firstName || !payload.lastName || !payload.department) {
    return;
  }

  if (id) {
    const employee = state.employees.find((emp) => emp.id === id);
    if (!employee) return;
    Object.assign(employee, payload);
    appendSyncLog(`Opdaterede ${employee.firstName} ${employee.lastName}.`);
  } else {
    const employee = {
      ...payload,
      id: `emp-${crypto.randomUUID()}`,
      status: 'away',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ny medarbejder - registrer status',
    };
    state.employees.push(employee);
    appendSyncLog(`Tilføjede ny medarbejder: ${employee.firstName} ${employee.lastName}.`);
  }

  resetEmployeeForm();
  renderAll();
  commitState();
}

function resetEmployeeForm() {
  elements.employeeForm?.reset();
  if (elements.employeeId) elements.employeeId.value = '';
}

function populateEmployeeForm(employee) {
  if (!elements.employeeForm) return;
  elements.employeeId.value = employee.id;
  elements.employeeFirst.value = employee.firstName;
  elements.employeeLast.value = employee.lastName;
  elements.employeeDepartment.value = employee.department;
  elements.employeeRole.value = employee.role || '';
  elements.employeeContact.value = employee.contact || '';
  elements.employeePhoto.value = employee.photo || '';
  elements.employeeFirst.focus();
}

function deleteEmployee(id) {
  state.employees = state.employees.filter((emp) => emp.id !== id);
  if (state.policyAcknowledgements?.[id]) {
    delete state.policyAcknowledgements[id];
  }
  appendSyncLog(`Fjernede medarbejder ${id}.`);
  renderAll();
  commitState();
}

function resetPolicyAcknowledgement(id) {
  if (state.policyAcknowledgements?.[id]) {
    delete state.policyAcknowledgements[id];
    appendSyncLog(`Nulstillede politikker for ${id}.`);
    commitState();
  } else {
    appendSyncLog('Ingen politik-godkendelser registreret for denne medarbejder.');
  }
}

function handleSlideFieldChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const container = event.target.closest('[data-slide-id]');
  if (!container) return;
  const slideId = container.dataset.slideId;
  const slide = state.screensaver.slides.find((item) => item.id === slideId);
  if (!slide) return;
  slide[field] = event.target.value;
  slide.updatedAt = new Date().toISOString();
  commitState();
}

function handleSlideAdminClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;
  const container = event.target.closest('[data-slide-id]');
  if (!container) return;
  const slideId = container.dataset.slideId;

  if (action === 'upload') {
    pendingSlideUploadId = slideId;
    elements.slideUpload?.click();
  }

  if (action === 'up') {
    reorderSlide(slideId, -1);
  }

  if (action === 'down') {
    reorderSlide(slideId, 1);
  }

  if (action === 'delete') {
    void deleteSlide(slideId);
  }
}

function handleAddSlide() {
  const slide = {
    id: `slide-${crypto.randomUUID()}`,
    theme: 'fjord',
    headline: '',
    description: '',
    image: '',
    order: state.screensaver.slides.length,
    createdAt: new Date().toISOString(),
  };
  state.screensaver.slides.push(slide);
  renderScreensaverAdmin();
  commitState();
  appendSyncLog('Tilføjede nyt slide.');
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
    event.target.value = '';
    return;
  }
  const slide = state.screensaver.slides.find((item) => item.id === pendingSlideUploadId);
  pendingSlideUploadId = null;
  event.target.value = '';
  if (!slide) return;

  try {
    if (!supabaseClient) {
      throw new Error('Supabase er ikke initialiseret.');
    }
    const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
    const path = `${SUPABASE_STORAGE_FOLDER}/${slide.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(SUPABASE_BUCKET)
      .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    const url = publicUrlData?.publicUrl;
    if (!url) throw new Error('Kunne ikke hente offentlig URL for filen.');

    if (slide.storagePath && slide.storagePath !== path) {
      await deleteStorageAsset(slide.storagePath);
    }
    slide.image = url;
    slide.storagePath = path;
    slide.updatedAt = new Date().toISOString();
    renderScreensaverAdmin();
    commitState();
    appendSyncLog('Opdaterede pauseskærmsbillede via upload.');
  } catch (error) {
    console.error('Fejl ved upload af slide', error);
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
  appendSyncLog('Fjernede slide.');
  if (removed?.storagePath) {
    await deleteStorageAsset(removed.storagePath);
  }
}

async function deleteStorageAsset(path) {
  if (!supabaseClient || !path) return;
  try {
    const { error } = await supabaseClient.storage.from(SUPABASE_BUCKET).remove([path]);
    if (error) throw error;
  } catch (error) {
    console.warn('Kunne ikke slette fil i Supabase Storage', error);
  }
}

function handleQrSubmit(event) {
  event.preventDefault();
  state.qrLinks.employee = elements.qrEmployee?.value.trim() || '';
  state.qrLinks.guest = elements.qrGuest?.value.trim() || '';
  renderQrPreview();
  commitState();
  appendSyncLog('Opdaterede QR-links.');
}

function handleExportSubmit(event) {
  event.preventDefault();
  const employeeFilter = elements.exportEmployee?.value || 'all';
  const from = elements.exportFrom?.value;
  const to = elements.exportTo?.value;
  const includeGuests = elements.exportIncludeGuests?.checked !== false;
  const includeStatus = elements.exportIncludeStatus?.checked !== false;

  const logs = state.logs.filter((entry) => {
    if (entry.type === 'guest-checkin' && !includeGuests) return false;
    if (entry.type === 'status-change' && !includeStatus) return false;
    if (employeeFilter !== 'all' && entry.employeeId && entry.employeeId !== employeeFilter) return false;
    if (from && new Date(entry.timestamp) < new Date(from)) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (new Date(entry.timestamp) > end) return false;
    }
    return true;
  });

  const rows = [
    ['timestamp', 'type', 'employeeId', 'employeeName', 'department', 'details'],
    ...logs.map((entry) => {
      if (entry.type === 'status-change') {
        const employee = state.employees.find((emp) => emp.id === entry.employeeId);
        const details = [entry.status, entry.note || '', entry.absence?.from || '', entry.absence?.to || '']
          .filter(Boolean)
          .join(' · ');
        return [
          entry.timestamp,
          'status-change',
          entry.employeeId,
          employee ? `${employee.firstName} ${employee.lastName}` : '',
          employee?.department || '',
          details,
        ];
      }
      if (entry.type === 'guest-checkin') {
        const guest = entry.guest || {};
        const host = state.employees.find((emp) => emp.id === guest.hostId);
        const details = `Guest: ${guest.name || ''}; Company: ${guest.company || ''}; Host: ${
          host ? `${host.firstName} ${host.lastName}` : 'Ukendt'
        }`;
        return [entry.timestamp, 'guest-checkin', guest.hostId || '', host ? `${host.firstName} ${host.lastName}` : '', host?.department || '', details];
      }
      return [entry.timestamp, entry.type, entry.employeeId || '', '', '', ''];
    }),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateLabel = new Date().toISOString().split('T')[0];
  link.download = `subra-export-${dateLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  if (elements.exportFeedback) {
    elements.exportFeedback.textContent = `Eksporterede ${logs.length} hændelser.`;
  }
  appendSyncLog('Eksporterede CSV-data.');
}

function escapeCsv(value) {
  if (value == null) return '';
  const stringValue = String(value);
  if (/[";\n]/.test(stringValue)) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function appendSyncLog(message) {
  const timestamp = new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (elements.syncLog) {
    const entry = document.createElement('div');
    entry.textContent = `${timestamp} · ${message}`;
    elements.syncLog.prepend(entry);
    while (elements.syncLog.childElementCount > 120) {
      elements.syncLog.lastElementChild?.remove();
    }
  } else {
    console.info(`[ADMIN SYNC ${timestamp}] ${message}`);
  }
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.toLocaleDateString('da-DK')} ${date.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('da-DK');
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

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

renderAll();
