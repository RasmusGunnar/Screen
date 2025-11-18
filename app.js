const INACTIVITY_TIMEOUT = 60000; // 60 sekunder før pauseskærm
const backendMode = (window.SUBRA_LOCAL_CONFIG?.backendMode || 'firebase').toLowerCase();
const firebaseAdapter = window.SubraFirebase || null;
const localAdapter = window.SubraLocalBackend || null;
const dataAdapter = (backendMode === 'local' && localAdapter) || firebaseAdapter;
let LOCAL_CONFIG = null;
let adapterReady = false;
let stateUnsubscribe = null;
let lastSyncedAt = null;
let syncTimer = null;
const POLL_INTERVAL = 15000;

applyLocalConfig(window.SUBRA_LOCAL_CONFIG || null);

const DEFAULTS = window.SUBRA_DEFAULTS || {};
const seedEmployees = DEFAULTS.employees || [];
const defaultSlides = DEFAULTS.slides || [];
const DEFAULT_QR_LINKS = DEFAULTS.qrLinks || { employee: '', guest: '' };
const DEFAULT_POLICY_LINKS = DEFAULTS.policyLinks || { nda: '' };

const SLIDE_THEMES = [
  { value: 'fjord', label: 'Fjord · kølig blå' },
  { value: 'aurora', label: 'Aurora · grøn gradient' },
  { value: 'ocean', label: 'Ocean · dyb turkis' },
  { value: 'sand', label: 'Sand · varm neutral' },
  { value: 'forest', label: 'Forest · nordisk grøn' },
];

const SUMMARY_LABELS = {
  onsite: 'På kontoret i dag',
  remote: 'Arbejder hjemmefra',
  away: 'Registreret fravær',
  guests: 'Dagens gæster',
};

const STATUS_LABELS = {
  onsite: 'På kontoret',
  remote: 'Arbejder hjemmefra',
  away: 'Fravær',
  unknown: 'Ingen status registreret',
};

const DEPARTMENT_ORDER = [
  'Administration',
  'Produktion',
  'Analyse og Inspection',
  'R&D',
  'Værksted',
];

const SUMMARY_EMPTY_MESSAGES = {
  onsite: 'Der er ingen medarbejdere registreret på kontoret lige nu.',
  remote: 'Ingen medarbejdere er registreret som hjemmearbejde.',
  away: 'Der er ikke registreret fravær i dag.',
  guests: 'Ingen gæster er registreret endnu i dag.',
};

function applyLocalConfig(config) {
  LOCAL_CONFIG = config || {};
  if (dataAdapter && dataAdapter.configure) {
    dataAdapter.configure(getAdapterOptions());
  }
}

function getAdapterOptions() {
  const realtime =
    LOCAL_CONFIG?.enableRealtime !== undefined
      ? LOCAL_CONFIG.enableRealtime
      : LOCAL_CONFIG?.firebase?.enableRealtime;
  return {
    ...(LOCAL_CONFIG?.firebase || {}),
    baseUrl: LOCAL_CONFIG?.baseUrl || '',
    enableRealtime: realtime,
    stateCollection: LOCAL_CONFIG?.stateCollection,
    stateDocId: LOCAL_CONFIG?.stateDocId,
    storageFolder: LOCAL_CONFIG?.storageFolder,
  };
}

let state = ensureStateDefaults();
let inactivityTimer;
let activeModalEmployee = null;
let screensaverInterval;
let pendingSlideUploadId = null;
let isSyncing = false;

const elements = {
  screensaver: document.getElementById('screensaver'),
  slideTemplate: document.getElementById('screensaver-slide-template'),
  main: document.getElementById('main-app'),
  departments: document.getElementById('departments'),
  search: document.getElementById('employee-search'),
  summaryCards: document.querySelectorAll('[data-summary-target]'),
  summaryValues: document.querySelectorAll('[data-summary]'),
  guestForm: document.getElementById('guest-form'),
  guestHost: document.getElementById('guest-host'),
  guestLog: document.getElementById('guest-log'),
  guestNdaLink: document.getElementById('guest-nda-link'),
  statusModal: document.getElementById('status-modal'),
  modalClose: document.getElementById('modal-close'),
  modalEmployee: document.getElementById('modal-employee'),
  statusForm: document.getElementById('status-form'),
  statusType: document.getElementById('status-type'),
  absenceFrom: document.getElementById('absence-from'),
  absenceTo: document.getElementById('absence-to'),
  statusNotes: document.getElementById('status-notes'),
  adminToggle: document.getElementById('admin-toggle'),
  adminDrawer: document.getElementById('admin-drawer'),
  drawerClose: document.getElementById('drawer-close'),
  employeeForm: document.getElementById('employee-form'),
  employeeList: document.getElementById('employee-list'),
  employeeId: document.getElementById('employee-id'),
  employeeFirst: document.getElementById('employee-first'),
  employeeLast: document.getElementById('employee-last'),
  employeeRole: document.getElementById('employee-role'),
  employeeDepartment: document.getElementById('employee-department'),
  employeeContact: document.getElementById('employee-contact'),
  employeePhoto: document.getElementById('employee-photo'),
  resetForm: document.getElementById('reset-form'),
  exportData: document.getElementById('export-data'),
  importData: document.getElementById('import-data'),
  importFile: document.getElementById('import-file'),
  syncOutput: document.getElementById('sync-output'),
  liveClock: document.getElementById('live-clock'),
  screensaverAdmin: document.getElementById('screensaver-admin'),
  addSlide: document.getElementById('add-slide'),
  slideUpload: document.getElementById('slide-upload'),
  qrForm: document.getElementById('qr-form'),
  qrEmployee: document.getElementById('qr-employee'),
  employeeQrCanvas: document.getElementById('employee-qr'),
  employeeQrLink: document.getElementById('employee-qr-link'),
  summaryModal: document.getElementById('summary-modal'),
  summaryClose: document.getElementById('summary-close'),
  summaryTitle: document.getElementById('summary-title'),
  summaryList: document.getElementById('summary-list'),
};

init();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', stopSyncLoop);
}

async function init() {
  attachEvents();
  renderSlides();
  renderAll();
  await bootstrapRemoteState();
  restartScreensaverCycle();
  tickClock();
  setInterval(tickClock, 1000);
}

function ensureStateDefaults(data = {}) {
  const employees = (data.employees || seedEmployees).map((emp) => ({
    ...emp,
    lastStatusChange: emp.lastStatusChange || new Date().toISOString(),
  }));

  const qrLinks = {
    employee: (data.qrLinks?.employee || DEFAULT_QR_LINKS.employee).trim(),
    guest: (data.qrLinks?.guest || DEFAULT_QR_LINKS.guest).trim(),
  };

  const policyLinks = {
    nda: (data.policyLinks?.nda || DEFAULT_POLICY_LINKS.nda).trim(),
  };

  const settings = {
    kiosk: {
      table: data.settings?.kiosk?.table || 'local_state',
      id: data.settings?.kiosk?.id || 'local',
      lastSynced: data.settings?.kiosk?.lastSynced || null,
    },
  };

  return {
    employees,
    guests: data.guests || [],
    logs: data.logs || [],
    screensaver: {
      slides: normalizeSlides(data.screensaver?.slides || data.slides || defaultSlides),
    },
    qrLinks,
    policyLinks,
    settings,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeSlides(slides) {
  const fallback = Array.isArray(slides) && slides.length ? slides : defaultSlides;
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

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForStorage(data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

function cloneState(source = state) {
  return JSON.parse(JSON.stringify(source));
}

async function bootstrapRemoteState() {
  if (!dataAdapter) {
    appendSyncOutput('Backend er ikke indlæst. Viser kun lokale data.');
    return;
  }

  dataAdapter.init(getAdapterOptions());

  if (!dataAdapter.isReady || !dataAdapter.isReady()) {
    appendSyncOutput('Backend er ikke konfigureret endnu. Opdater konfigurationen.');
    return;
  }

  try {
    if (dataAdapter.ensureKioskAuth) {
      await dataAdapter.ensureKioskAuth(LOCAL_CONFIG?.kiosk?.authMode || 'anonymous');
    }
    adapterReady = dataAdapter.isReady ? dataAdapter.isReady() : true;
  } catch (error) {
    appendSyncOutput(`Kunne ikke logge ind i backend: ${error.message}`);
    return;
  }

  await fetchRemoteState(true);
  startSyncLoop();
}

function commitState(nextState) {
  state = ensureStateDefaults(nextState || state);
  state.updatedAt = new Date().toISOString();
  state.settings = state.settings || {};
  state.settings.kiosk = state.settings.kiosk || {};
  state.settings.kiosk.id =
    state.settings.kiosk.id || LOCAL_CONFIG?.stateDocId || LOCAL_CONFIG?.firebase?.stateDocId || 'local';
  state.settings.kiosk.lastSynced = state.updatedAt;
  void pushStateToBackend();
}

function startSyncLoop() {
  if (typeof window === 'undefined') return;
  if (!adapterReady) {
    return;
  }

  const realtimeEnabled =
    LOCAL_CONFIG?.enableRealtime !== undefined
      ? LOCAL_CONFIG.enableRealtime
      : LOCAL_CONFIG?.firebase?.enableRealtime;

  if (realtimeEnabled) {
    if (stateUnsubscribe) {
      stateUnsubscribe();
    }
    try {
      stateUnsubscribe = dataAdapter.subscribeToState((remoteState) => {
        if (!remoteState) {
          return;
        }
        const normalized = ensureStateDefaults(remoteState);
        if (lastSyncedAt && normalized.updatedAt === lastSyncedAt) {
          return;
        }
        state = normalized;
        lastSyncedAt = state.updatedAt;
        renderSlides();
        renderAll();
        updateQrCodes();
        updateGuestPolicyLink();
      });
    } catch (error) {
      appendSyncOutput(`Realtime-opdatering fejlede: ${error.message}`);
    }
    return;
  }

  if (stateUnsubscribe) {
    stateUnsubscribe();
    stateUnsubscribe = null;
  }
  if (syncTimer) {
    window.clearInterval(syncTimer);
  }
  syncTimer = window.setInterval(() => {
    void fetchRemoteState();
  }, POLL_INTERVAL);
}

function stopSyncLoop() {
  if (syncTimer && typeof window !== 'undefined') {
    window.clearInterval(syncTimer);
    syncTimer = null;
  }
  if (stateUnsubscribe) {
    stateUnsubscribe();
    stateUnsubscribe = null;
  }
}

async function fetchRemoteState(force = false) {
  if (!adapterReady || !dataAdapter?.isReady()) {
    return;
  }

  try {
    const remoteState = await dataAdapter.fetchState();
    if (!remoteState) {
      appendSyncOutput('Ingen data fundet i backend endnu – bruger lokale defaults.');
      return;
    }

    if (!force && lastSyncedAt && remoteState.updatedAt && remoteState.updatedAt === lastSyncedAt) {
      return;
    }

    state = ensureStateDefaults(remoteState);
    lastSyncedAt = state.updatedAt;
    renderSlides();
    renderAll();
    updateQrCodes();
    updateGuestPolicyLink();
  } catch (error) {
    appendSyncOutput(`Kunne ikke hente data fra backend: ${error.message}`);
  }
}

async function pushStateToBackend() {
  if (isSyncing) return;
  if (!adapterReady || !dataAdapter?.isReady()) {
    appendSyncOutput('Backend er ikke klar – ændringer gemmes lokalt.');
    return;
  }
  isSyncing = true;

  try {
    const saved = await dataAdapter.saveState(serializeForStorage(state));
    state = ensureStateDefaults(saved);
    lastSyncedAt = state.updatedAt;
    renderSlides();
    renderAll();
    appendSyncOutput('Ændringer gemt i backend.');
  } catch (error) {
    console.error('Kunne ikke gemme state til backend', error);
    appendSyncOutput(`Kunne ikke gemme til backend: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

function attachEvents() {
  elements.screensaver.addEventListener('click', () => {
    hideScreensaver();
    resetInactivityTimer();
  });

  document.addEventListener('click', resetInactivityTimer, { passive: true });
  document.addEventListener('touchstart', resetInactivityTimer, { passive: true });
  document.addEventListener('mousemove', resetInactivityTimer, { passive: true });

  elements.search?.addEventListener('input', (event) => renderDepartments(event.target.value));

  elements.summaryCards?.forEach((card) =>
    card.addEventListener('click', () => openSummaryModal(card.dataset.summaryTarget))
  );
  elements.summaryClose?.addEventListener('click', closeSummaryModal);
  elements.summaryModal?.addEventListener('click', (event) => {
    if (event.target === elements.summaryModal) {
      closeSummaryModal();
    }
  });
  if (elements.summaryModal) {
    document.addEventListener('keydown', handleSummaryKeydown);
  }

  elements.departments?.addEventListener('click', handleDepartmentClick);

  elements.guestForm?.addEventListener('submit', handleGuestSubmit);

  elements.modalClose?.addEventListener('click', closeModal);
  elements.statusForm?.addEventListener('submit', handleStatusSubmit);

  elements.adminToggle?.addEventListener('click', toggleDrawer);
  elements.drawerClose?.addEventListener('click', toggleDrawer);

  elements.employeeForm?.addEventListener('submit', handleEmployeeSubmit);
  elements.resetForm?.addEventListener('click', () => {
    elements.employeeForm?.reset();
    if (elements.employeeId) elements.employeeId.value = '';
  });

  elements.exportData?.addEventListener('click', exportData);
  if (elements.importData && elements.importFile) {
    elements.importData.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', handleImport);
  }

  document.querySelectorAll('[data-quick]').forEach((button) =>
    button.addEventListener('click', handleQuickAction)
  );

  elements.screensaverAdmin?.addEventListener('input', handleSlideFieldChange);
  elements.screensaverAdmin?.addEventListener('click', handleSlideAdminClick);
  elements.addSlide?.addEventListener('click', handleAddSlide);
  elements.slideUpload?.addEventListener('change', handleSlideUploadChange);
  elements.qrForm?.addEventListener('submit', handleQrSubmit);
}

function renderSlides() {
  if (!elements.screensaver) return;
  elements.screensaver.innerHTML = '';

  const slides = state.screensaver?.slides || [];
  if (!slides.length) {
    const hint = document.createElement('p');
    hint.className = 'screensaver-hint';
    hint.textContent = 'Tilføj et slide i adminportalen for at starte.';
    elements.screensaver.appendChild(hint);
    elements.slides = [];
    return;
  }

  slides.forEach((data) => {
    let slideNode;
    if (elements.slideTemplate?.content?.firstElementChild) {
      slideNode = elements.slideTemplate.content.firstElementChild.cloneNode(true);
    } else {
      slideNode = document.createElement('div');
      slideNode.className = 'slide';
      slideNode.innerHTML = `
        <div class="overlay overlay-top-left">
          <img src="assets/LOGO_SUBRA_sort_transp-web.png" alt="SUBRA" class="logo" />
        </div>
        <div class="overlay overlay-bottom-center">
          <p class="welcome-tagline"></p>
          <p class="welcome-instruction"></p>
        </div>
      `;
    }

    slideNode.dataset.theme = data.theme || 'fjord';
    const tagline = slideNode.querySelector('.welcome-tagline');
    const instruction = slideNode.querySelector('.welcome-instruction');
    if (tagline) tagline.textContent = data.headline || '';
    if (instruction) instruction.textContent = data.description || '';
    slideNode.setAttribute(
      'aria-label',
      `${data.headline || 'Slide'}${data.description ? ` – ${data.description}` : ''}`
    );

    if (data.image) {
      slideNode.style.setProperty('--slide-image', `url("${data.image}")`);
    } else {
      slideNode.style.removeProperty('--slide-image');
    }

    elements.screensaver.appendChild(slideNode);
  });

  elements.slides = Array.from(elements.screensaver.querySelectorAll('.slide'));
  restartScreensaverCycle();
}

function renderAll() {
  renderDepartments(elements.search?.value || '');
  renderSummary();
  populateGuestHost();
  renderGuestLog();
  renderEmployeeAdminList();
  renderScreensaverAdmin();
  updateQrCodes();
  updateGuestPolicyLink();
  if (!elements.summaryModal?.classList.contains('hidden')) {
    renderSummaryDetails(elements.summaryModal.dataset.summaryType);
  }
}

function renderDepartments(filter = '') {
  const filterValue = filter?.toLowerCase().trim() || '';
  const container = elements.departments;
  container.innerHTML = '';

  const grouped = groupEmployees(state.employees);
  const fallbackDepartments = Array.from(grouped.keys()).filter((dept) => !DEPARTMENT_ORDER.includes(dept));
  const sortedFallback = fallbackDepartments.sort((a, b) => a.localeCompare(b, 'da', { sensitivity: 'base' }));
  const departmentsToRender = [...new Set([...DEPARTMENT_ORDER, ...sortedFallback])];

  departmentsToRender.forEach((department) => {
    const employees = grouped.get(department) || [];
    const filteredEmployees = employees.filter((emp) => {
      if (!filterValue) return true;
      const haystack = `${emp.firstName} ${emp.lastName} ${emp.department} ${emp.role}`.toLowerCase();
      return haystack.includes(filterValue);
    });

    if (!filteredEmployees.length && filterValue) {
      return;
    }

    const departmentCard = document.createElement('article');
    departmentCard.className = 'department-card';

    const header = document.createElement('div');
    header.className = 'department-header';

    const title = document.createElement('h2');
    title.className = 'department-name';
    title.textContent = department;

    const count = document.createElement('span');
    count.className = 'department-count';
    count.textContent = `${filteredEmployees.length} medarbejdere`;

    header.append(title, count);
    departmentCard.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'employee-grid';

    const priority = { onsite: 0, remote: 1, away: 2 };
    const employeesToRender = filteredEmployees
      .slice()
      .sort((a, b) => {
        const priorityA = priority[a.status] ?? 3;
        const priorityB = priority[b.status] ?? 3;
        if (priorityA !== priorityB) return priorityA - priorityB;
        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '', 'da', { sensitivity: 'base' });
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.firstName || '').localeCompare(b.firstName || '', 'da', { sensitivity: 'base' });
      });

    if (!employeesToRender.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'department-empty';
      emptyState.textContent = 'Ingen medarbejdere registreret.';
      grid.appendChild(emptyState);
    } else {
      employeesToRender.forEach((employee) => {
        grid.appendChild(createEmployeeCard(employee));
      });
    }

    departmentCard.appendChild(grid);
    container.appendChild(departmentCard);
  });
}

function groupEmployees(employees) {
  const map = new Map();
  employees.forEach((employee) => {
    const key = employee.department?.trim() || 'Ukendt afdeling';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(employee);
  });

  return map;
}

function createEmployeeCard(employee) {
  const card = document.createElement('div');
  card.className = 'employee-card';
  card.dataset.id = employee.id;
  const status = employee.status || 'unknown';
  card.dataset.status = status;

  const indicator = document.createElement('span');
  indicator.className = 'status-indicator';
  indicator.dataset.status = status;
  indicator.setAttribute('aria-hidden', 'true');
  indicator.title = STATUS_LABELS[status] || STATUS_LABELS.unknown;

  const info = document.createElement('div');
  info.className = 'employee-info';

  const name = document.createElement('h3');
  name.textContent = `${employee.firstName} ${employee.lastName}`;

  const role = document.createElement('p');
  role.className = 'role';
  role.textContent = employee.role || '';

  const statusText = document.createElement('p');
  statusText.className = 'status-text';
  statusText.textContent = formatStatusText(employee);

  info.append(name, role, statusText);

  const actions = document.createElement('div');
  actions.className = 'employee-actions';

  const checkInButton = document.createElement('button');
  checkInButton.className = 'primary';
  checkInButton.dataset.action = 'checkin';
  checkInButton.textContent = 'Tjek ind';

  const checkOutButton = document.createElement('button');
  checkOutButton.className = 'ghost';
  checkOutButton.dataset.action = 'checkout';
  checkOutButton.textContent = 'Tjek ud';

  const statusButton = document.createElement('button');
  statusButton.className = 'ghost';
  statusButton.dataset.action = 'status';
  statusButton.textContent = 'Status & fravær';

  actions.append(checkInButton, checkOutButton, statusButton);

  card.append(indicator, info, actions);
  return card;
}

function formatStatusText(employee) {
  const timestamp = employee.lastStatusChange ? new Date(employee.lastStatusChange) : null;
  const timeString = timestamp ? timestamp.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '';

  switch (employee.status) {
    case 'onsite':
      return `På kontoret siden ${timeString}`;
    case 'remote':
      return employee.statusNotes || `Arbejder hjemme (${timeString})`;
    case 'away':
      if (employee.absence?.from || employee.absence?.to) {
        const from = employee.absence?.from ? formatDate(employee.absence.from) : 'ukendt';
        const to = employee.absence?.to ? formatDate(employee.absence.to) : 'ubestemt';
        return `Fravær: ${from} – ${to}${employee.statusNotes ? ` · ${employee.statusNotes}` : ''}`;
      }
      return employee.statusNotes || 'Fravær registreret';
    case 'unknown':
      return 'Ingen status registreret i dag.';
    default:
      return 'Ingen status registreret i dag.';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('da-DK');
}

function handleDepartmentClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.target.closest('.employee-card');
  if (!card) return;

  const employee = state.employees.find((emp) => emp.id === card.dataset.id);
  if (!employee) return;

  if (action === 'checkin') {
    updateEmployeeStatus(employee.id, 'onsite', 'Ankommet');
  }

  if (action === 'checkout') {
    updateEmployeeStatus(employee.id, 'remote', 'Arbejder hjemmefra efter checkout');
  }

  if (action === 'status') {
    openStatusModal(employee);
  }
}

function updateEmployeeStatus(id, status, note = '') {
  const employee = state.employees.find((emp) => emp.id === id);
  if (!employee) return;

  employee.status = status;
  employee.lastStatusChange = new Date().toISOString();
  employee.statusNotes = note || employee.statusNotes || '';
  if (status !== 'away') {
    employee.absence = undefined;
  }

  logEvent({
    type: 'status-change',
    employeeId: employee.id,
    status,
    note,
  });

  renderAll();
  commitState();
}

function openStatusModal(employee) {
  activeModalEmployee = employee;
  elements.modalEmployee.textContent = `${employee.firstName} ${employee.lastName}`;
  elements.statusType.value = employee.status || 'onsite';
  elements.absenceFrom.value = employee.absence?.from || '';
  elements.absenceTo.value = employee.absence?.to || '';
  elements.statusNotes.value = employee.statusNotes || '';
  elements.statusModal.classList.remove('hidden');
}

function closeModal() {
  elements.statusModal.classList.add('hidden');
  activeModalEmployee = null;
}

function handleStatusSubmit(event) {
  event.preventDefault();
  if (!activeModalEmployee) return;

  const status = elements.statusType.value;
  const absence = {
    from: elements.absenceFrom.value || undefined,
    to: elements.absenceTo.value || undefined,
  };
  const notes = elements.statusNotes.value;

  const employee = state.employees.find((emp) => emp.id === activeModalEmployee.id);
  if (!employee) return;

  employee.status = status;
  employee.statusNotes = notes;
  employee.lastStatusChange = new Date().toISOString();
  employee.absence = status === 'away' ? absence : undefined;

  logEvent({
    type: 'status-change',
    employeeId: employee.id,
    status,
    note: notes,
    absence,
  });

  renderAll();
  commitState();
  closeModal();
}

function renderSummary() {
  const counters = {
    onsite: 0,
    remote: 0,
    away: 0,
    guests: state.guests.filter((guest) => isToday(guest.timestamp)).length,
  };

  state.employees.forEach((employee) => {
    if (employee.status === 'onsite') counters.onsite += 1;
    if (employee.status === 'remote') counters.remote += 1;
    if (employee.status === 'away') counters.away += 1;
  });

  elements.summaryValues.forEach((node) => {
    const key = node.dataset.summary;
    node.textContent = counters[key] ?? 0;
  });
}

function openSummaryModal(type) {
  if (!elements.summaryModal || !elements.summaryList) return;
  const summaryType = type || 'onsite';
  elements.summaryModal.dataset.summaryType = summaryType;

  if (elements.summaryTitle) {
    elements.summaryTitle.textContent = SUMMARY_LABELS[summaryType] || 'Detaljer';
  }

  renderSummaryDetails(summaryType);

  elements.summaryModal.classList.remove('hidden');
  elements.summaryModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => elements.summaryClose?.focus(), 0);
}

function closeSummaryModal() {
  if (!elements.summaryModal) return;
  elements.summaryModal.classList.add('hidden');
  elements.summaryModal.setAttribute('aria-hidden', 'true');
  delete elements.summaryModal.dataset.summaryType;
}

function handleSummaryKeydown(event) {
  if (event.key !== 'Escape') return;
  if (elements.summaryModal?.classList.contains('hidden')) return;
  closeSummaryModal();
}

function renderSummaryDetails(type) {
  if (!elements.summaryList) return;
  elements.summaryList.innerHTML = '';

  if (type === 'guests') {
    const todayGuests = state.guests.filter((guest) => isToday(guest.timestamp));
    if (!todayGuests.length) {
      elements.summaryList.innerHTML = `<p class="summary-empty">${SUMMARY_EMPTY_MESSAGES.guests}</p>`;
      return;
    }

    todayGuests.forEach((guest) => {
      const host = state.employees.find((emp) => emp.id === guest.hostId);
      const entry = document.createElement('article');
      entry.className = 'summary-entry';
      const time = new Date(guest.timestamp).toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
      });
      entry.innerHTML = `
        <strong>${escapeHtml(guest.name)}${guest.company ? ` · ${escapeHtml(guest.company)}` : ''}</strong>
        <span>${host ? `${escapeHtml(host.firstName)} ${escapeHtml(host.lastName)}` : 'Ukendt vært'}</span>
        <small>${time}${guest.purpose ? ` · ${escapeHtml(guest.purpose)}` : ''}</small>
      `;
      elements.summaryList.appendChild(entry);
    });
    return;
  }

  const employees = state.employees
    .filter((employee) => employee.status === type)
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', {
      sensitivity: 'base',
    }));

  if (!employees.length) {
    elements.summaryList.innerHTML = `<p class="summary-empty">${
      SUMMARY_EMPTY_MESSAGES[type] || 'Ingen registreringer endnu.'
    }</p>`;
    return;
  }

  employees.forEach((employee) => {
    const entry = document.createElement('article');
    entry.className = 'summary-entry';
    entry.innerHTML = `
      <strong>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</strong>
      <span>${escapeHtml(employee.department)}${employee.role ? ` · ${escapeHtml(employee.role)}` : ''}</span>
      <small>${escapeHtml(formatStatusText(employee))}</small>
    `;
    elements.summaryList.appendChild(entry);
  });
}

function populateGuestHost() {
  const select = elements.guestHost;
  select.innerHTML = '';

  groupEmployees(state.employees).forEach((employees) => {
    employees
      .slice()
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'da', { sensitivity: 'base' }))
      .forEach((employee) => {
        if (employee.status === 'away') return;
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = `${employee.firstName} ${employee.lastName} · ${employee.department}`;
        select.appendChild(option);
      });
  });
}

function handleGuestSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const guest = {
    id: crypto.randomUUID(),
    name: form['guest-name'].value.trim(),
    company: form['guest-company'].value.trim(),
    hostId: form['guest-host'].value,
    purpose: form['guest-purpose'].value.trim(),
    timestamp: new Date().toISOString(),
  };

  if (!guest.name || !guest.hostId) return;
  if (!form['guest-nda']?.checked || !form['guest-it']?.checked) {
    alert('Gæster skal acceptere politikkerne for at fortsætte.');
    return;
  }

  state.guests.unshift(guest);
  logEvent({ type: 'guest-checkin', guest });
  notifyHost(guest);
  form.reset();
  renderAll();
  commitState();
}

function renderGuestLog() {
  const container = elements.guestLog;
  container.innerHTML = '';

  const todayGuests = state.guests.filter((guest) => isToday(guest.timestamp));
  if (!todayGuests.length) {
    container.innerHTML = '<p>Ingen gæster registreret endnu i dag.</p>';
    return;
  }

  todayGuests.slice(0, 6).forEach((guest) => {
    const host = state.employees.find((emp) => emp.id === guest.hostId);
    const entry = document.createElement('div');
    entry.className = 'guest-entry';
    entry.innerHTML = `
      <strong>${guest.name}${guest.company ? ` · ${guest.company}` : ''}</strong>
      <div>Besøger: ${host ? `${host.firstName} ${host.lastName}` : 'Ukendt'}</div>
      <small>${new Date(guest.timestamp).toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
      })} · Formål: ${guest.purpose || 'Ikke angivet'}</small>
    `;
    container.appendChild(entry);
  });
}

function updateGuestPolicyLink() {
  if (!elements.guestNdaLink) return;
  const link = elements.guestNdaLink;
  const url = state.policyLinks?.nda || '';

  if (url) {
    link.href = url;
    link.classList.remove('disabled');
    link.textContent = 'SUBRAs NDA (PDF)';
    link.removeAttribute('aria-disabled');
    link.tabIndex = 0;
  } else {
    link.removeAttribute('href');
    link.classList.add('disabled');
    link.textContent = 'SUBRAs NDA (link mangler)';
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
  }
}

function notifyHost(guest) {
  const host = state.employees.find((emp) => emp.id === guest.hostId);
  const message = host
    ? `SMS til ${host.firstName} ${host.lastName}: ${guest.name} er ankommet og venter i receptionen.`
    : `Gæst ${guest.name} registreret.`;
  appendSyncOutput(message);
}

function appendSyncOutput(message) {
  const timestamp = new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (elements.syncOutput) {
    elements.syncOutput.textContent = `${timestamp} · ${message}\n${elements.syncOutput.textContent}`;
  } else {
    console.info(`[SUBRA SYNC ${timestamp}] ${message}`);
  }
}

function handleEmployeeSubmit(event) {
  event.preventDefault();
  const id = elements.employeeId.value;
  const payload = {
    firstName: elements.employeeFirst.value.trim(),
    lastName: elements.employeeLast.value.trim(),
    role: elements.employeeRole.value.trim(),
    department: elements.employeeDepartment.value.trim(),
    contact: elements.employeeContact.value.trim(),
    photo: elements.employeePhoto.value.trim(),
  };

  if (!payload.firstName || !payload.lastName || !payload.department) {
    return;
  }

  if (id) {
    const employee = state.employees.find((emp) => emp.id === id);
    Object.assign(employee, payload);
    appendSyncOutput(`Opdaterede ${employee.firstName} ${employee.lastName}.`);
  } else {
    const employee = {
      ...payload,
      id: `emp-${crypto.randomUUID()}`,
      status: 'away',
      lastStatusChange: new Date().toISOString(),
      statusNotes: 'Ny medarbejder - registrer status',
    };
    state.employees.push(employee);
    appendSyncOutput(`Tilføjede ny medarbejder: ${employee.firstName} ${employee.lastName}.`);
  }

  elements.employeeForm.reset();
  elements.employeeId.value = '';
  renderAll();
  commitState();
}

function renderEmployeeAdminList() {
  const container = elements.employeeList;
  if (!container) return;
  container.innerHTML = '';

  state.employees
    .slice()
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', { sensitivity: 'base' }))
    .forEach((employee) => {
      const item = document.createElement('div');
      item.className = 'drawer-item';
      const info = document.createElement('div');
      info.innerHTML = `
        <strong>${employee.firstName} ${employee.lastName}</strong>
        <small>${employee.department} · ${employee.role || 'Ingen titel'}</small>
      `;

      const actions = document.createElement('div');

      const editButton = document.createElement('button');
      editButton.innerHTML = '✏️';
      editButton.addEventListener('click', () => populateEmployeeForm(employee));

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '🗑️';
      deleteButton.addEventListener('click', () => deleteEmployee(employee.id));

      actions.append(editButton, deleteButton);

      item.append(info, actions);
      container.appendChild(item);
    });
}

function renderScreensaverAdmin() {
  if (!elements.screensaverAdmin) return;
  const slides = state.screensaver?.slides || [];
  if (!slides.length) {
    elements.screensaverAdmin.innerHTML =
      '<p class="drawer-empty">Ingen slides endnu. Tilføj dit første billede for at aktivere pauseskærmen.</p>';
  } else {
    elements.screensaverAdmin.innerHTML = slides
      .map((slide, index) => {
        const themeOptions = SLIDE_THEMES.map((theme) => {
          const selected = theme.value === slide.theme ? 'selected' : '';
          return `<option value="${theme.value}" ${selected}>${theme.label}</option>`;
        }).join('');

        const previewStyle = slide.image ? `style="background-image:url('${escapeHtml(slide.image)}')"` : '';

        return `
          <article class="slide-admin-card" data-slide-id="${slide.id}">
            <div class="slide-thumb" ${previewStyle} aria-label="Forhåndsvisning"></div>
            <div class="slide-fields">
              <label>Overskrift<input data-field="headline" value="${escapeHtml(slide.headline)}" maxlength="60" /></label>
              <label>Beskrivelse<textarea data-field="description" rows="2" maxlength="120">${escapeHtml(
                slide.description
              )}</textarea></label>
              <label>Tema<select data-field="theme">${themeOptions}</select></label>
            </div>
            <div class="slide-controls">
              <button type="button" class="ghost" data-action="upload">Upload billede</button>
              <div class="reorder-buttons">
                <button type="button" data-action="move-up" ${index === 0 ? 'disabled' : ''}>▲</button>
                <button type="button" data-action="move-down" ${index === slides.length - 1 ? 'disabled' : ''}>▼</button>
              </div>
              <button type="button" class="ghost danger" data-action="delete">Fjern</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

}

function updateQrCodes() {
  if (!elements.employeeQrCanvas) return;
  renderQrCode(elements.employeeQrCanvas, state.qrLinks.employee, 'Medarbejder QR-kode');

  if (elements.employeeQrLink) {
    elements.employeeQrLink.textContent = state.qrLinks.employee ? `→ ${state.qrLinks.employee}` : '';
  }
  if (elements.qrEmployee) elements.qrEmployee.value = state.qrLinks.employee || '';
}

function renderQrCode(container, url, ariaLabel) {
  container.innerHTML = '';
  container.setAttribute('aria-label', ariaLabel);

  if (!url) {
    const placeholder = document.createElement('p');
    placeholder.className = 'qr-placeholder';
    placeholder.textContent = 'Angiv et link i adminportalen for at generere en QR-kode.';
    container.appendChild(placeholder);
    return;
  }

  if (typeof QRCode === 'undefined') {
    const warning = document.createElement('p');
    warning.className = 'qr-placeholder';
    warning.textContent = 'QR-biblioteket kunne ikke indlæses.';
    container.appendChild(warning);
    return;
  }

  new QRCode(container, {
    text: url,
    width: 240,
    height: 240,
    colorDark: '#1f2933',
    colorLight: '#f9fafb',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function handleSlideFieldChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const card = event.target.closest('[data-slide-id]');
  if (!card) return;

  const slide = state.screensaver.slides.find((item) => item.id === card.dataset.slideId);
  if (!slide) return;

  slide[field] = event.target.value;
  slide.updatedAt = new Date().toISOString();
  if (field === 'headline' || field === 'description' || field === 'theme') {
    renderSlides();
  }
  commitState();
}

function handleSlideAdminClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;
  const card = event.target.closest('[data-slide-id]');
  if (!card) return;
  const slideId = card.dataset.slideId;

  if (action === 'upload') {
    pendingSlideUploadId = slideId;
    elements.slideUpload?.click();
    return;
  }

  if (action === 'delete') {
    deleteSlide(slideId);
    return;
  }

  if (action === 'move-up') {
    reorderSlide(slideId, -1);
    return;
  }

  if (action === 'move-down') {
    reorderSlide(slideId, 1);
  }
}

function handleAddSlide() {
  const slides = state.screensaver.slides;
  const slide = {
    id: `slide-${Date.now()}`,
    headline: 'Ny slide',
    description: 'Tilføj en kort tekst om velkomsten.',
    theme: SLIDE_THEMES[slides.length % SLIDE_THEMES.length]?.value || 'fjord',
    image: '',
    order: slides.length,
    storagePath: null,
    createdAt: new Date().toISOString(),
  };

  slides.push(slide);
  renderSlides();
  renderScreensaverAdmin();
  commitState();
  appendSyncOutput('Tilføjede et nyt slide til pauseskærmen.');
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

  renderSlides();
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
    if (!adapterReady || !dataAdapter?.isReady()) {
      throw new Error('Backend er ikke konfigureret til uploads');
    }

    const upload = await dataAdapter.uploadSlide(file);
    slide.image = upload.downloadURL;
    slide.storagePath = upload.storagePath || null;
    slide.updatedAt = new Date().toISOString();

    renderSlides();
    renderScreensaverAdmin();
    commitState();
    appendSyncOutput('Opdaterede pauseskærmsbilledet i backend.');
  } catch (error) {
    console.error('Fejl ved upload af slide', error);
    appendSyncOutput(`Kunne ikke uploade billede: ${error.message}`);
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

  renderSlides();
  renderScreensaverAdmin();
  commitState();
  appendSyncOutput('Fjernede slide fra pauseskærmen.');

  if (removed?.storagePath) {
    void removeSlideAsset(removed.storagePath);
  }
}

async function handleQrSubmit(event) {
  event.preventDefault();
  state.qrLinks.employee = elements.qrEmployee?.value.trim() || '';
  updateQrCodes();
  commitState();
  appendSyncOutput('Opdaterede QR-links.');
}

function populateEmployeeForm(employee) {
  elements.employeeId.value = employee.id;
  elements.employeeFirst.value = employee.firstName;
  elements.employeeLast.value = employee.lastName;
  elements.employeeRole.value = employee.role || '';
  elements.employeeDepartment.value = employee.department;
  elements.employeeContact.value = employee.contact || '';
  elements.employeePhoto.value = employee.photo || '';
}

function deleteEmployee(id) {
  state.employees = state.employees.filter((emp) => emp.id !== id);
  appendSyncOutput(`Fjernede medarbejder: ${id}`);
  renderAll();
  commitState();
}

function logEvent(entry) {
  state.logs.unshift({ ...entry, timestamp: new Date().toISOString() });
}

function handleQuickAction(event) {
  const action = event.currentTarget.dataset.quick;
  if (action === 'checkin') {
    state.employees.forEach((employee) => {
      employee.status = 'onsite';
      employee.lastStatusChange = new Date().toISOString();
      employee.statusNotes = 'Registreret via hurtig handling';
      employee.absence = undefined;
    });
    appendSyncOutput('Alle medarbejdere markeret som til stede (brandøvelse).');
  }

  if (action === 'checkout') {
    state.employees.forEach((employee) => {
      employee.status = 'away';
      employee.lastStatusChange = new Date().toISOString();
      employee.statusNotes = 'Registreret som ude af bygningen.';
      employee.absence = undefined;
    });
    appendSyncOutput('Alle markeret som ude af bygningen.');
  }

  if (action === 'rollcall') {
    const onsite = state.employees.filter((employee) => employee.status === 'onsite');
    const names = onsite.map((employee) => `${employee.firstName} ${employee.lastName}`).join(', ');
    appendSyncOutput(`Evakueringsliste (${onsite.length}): ${names || 'Ingen på kontoret'}.`);
  }

  renderAll();
  commitState();
}

function exportData() {
  const payload = ensureStateDefaults(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `subra-kiosk-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  appendSyncOutput('Eksporterede data til JSON.');
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.employees) throw new Error('Ugyldig fil');
      state = ensureStateDefaults(imported);
      appendSyncOutput(`Importerede data fra ${file.name}.`);
      renderSlides();
      renderAll();
      commitState();
    } catch (error) {
      appendSyncOutput(`Kunne ikke importere fil: ${error.message}`);
    }
  };
  reader.readAsText(file);
  elements.importFile.value = '';
}

  function removeSlideAsset(storagePath) {
    if (!storagePath) return;
    if (!adapterReady || !dataAdapter?.isReady()) {
      return;
    }

    void dataAdapter.deleteSlide(storagePath).catch((error) => {
      console.warn('Kunne ikke slette slide-asset', error);
    });
  }

function isToday(timestamp) {
  const today = new Date();
  const date = new Date(timestamp);
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function tickClock() {
  if (!elements.liveClock) return;
  const now = new Date();
  const formatted = now.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const date = now.toLocaleDateString('da-DK', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  elements.liveClock.innerHTML = `<strong>${formatted}</strong><br /><span>${capitalize(date)}</span>`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function restartScreensaverCycle() {
  if (screensaverInterval) {
    clearInterval(screensaverInterval);
  }

  if (!elements.slides || !elements.slides.length) {
    screensaverInterval = null;
    return;
  }

  elements.slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === 0);
  });

  let currentIndex = 0;
  screensaverInterval = setInterval(() => {
    if (!elements.slides.length) return;
    elements.slides[currentIndex]?.classList.remove('active');
    currentIndex = (currentIndex + 1) % elements.slides.length;
    elements.slides[currentIndex]?.classList.add('active');
  }, 8000);
}

function hideScreensaver() {
  elements.screensaver.classList.add('hidden');
  elements.main.classList.remove('hidden');
}

function showScreensaver() {
  elements.screensaver.classList.remove('hidden');
  elements.main.classList.add('hidden');
}

function resetInactivityTimer() {
  if (elements.main.classList.contains('hidden')) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showScreensaver, INACTIVITY_TIMEOUT);
}

function toggleDrawer() {
  if (!elements.adminDrawer) return;
  const isVisible = elements.adminDrawer.classList.contains('visible');
  elements.adminDrawer.classList.toggle('visible', !isVisible);
  elements.adminDrawer.classList.toggle('hidden', isVisible);
  elements.adminDrawer.setAttribute('aria-hidden', String(isVisible));
}

function showToast(message) {
  appendSyncOutput(message);
}

function startIdleWatcher() {
  resetInactivityTimer();
}

startIdleWatcher();
