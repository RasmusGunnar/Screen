const INACTIVITY_TIMEOUT = 60000; // 60 sekunder før pauseskærm
const SUPABASE_CONFIG = window.SUBRA_SUPABASE_CONFIG || null;
const SUPABASE_TABLE = window.SUBRA_KIOSK_TABLE || 'kiosk_state';
const SUPABASE_ROW_ID = window.SUBRA_KIOSK_DOCUMENT || 'subra-main';
const SUPABASE_BUCKET = window.SUBRA_ASSET_BUCKET || 'kiosk-assets';
const SUPABASE_STORAGE_FOLDER = window.SUBRA_ASSET_FOLDER || 'screensaver';

const DEFAULTS = window.SUBRA_DEFAULTS || {};
const seedEmployees = DEFAULTS.employees || [];
const defaultSlides = DEFAULTS.slides || [];
const DEFAULT_QR_LINKS = DEFAULTS.qrLinks || { employee: '', guest: '' };

const SLIDE_THEMES = [
  { value: 'fjord', label: 'Fjord · kølig blå' },
  { value: 'aurora', label: 'Aurora · grøn gradient' },
  { value: 'ocean', label: 'Ocean · dyb turkis' },
  { value: 'sand', label: 'Sand · varm neutral' },
  { value: 'forest', label: 'Forest · nordisk grøn' },
];

let state = ensureStateDefaults();
let inactivityTimer;
let activeModalEmployee = null;
let activePolicyEmployee = null;
let pendingPolicyAction = null;
let screensaverInterval;
let pendingSlideUploadId = null;
let supabaseClient = null;
let supabaseChannel = null;
let isCloudReady = false;
let isApplyingRemoteState = false;
let hasCloudWarning = false;

const elements = {
  screensaver: document.getElementById('screensaver'),
  slideTemplate: document.getElementById('screensaver-slide-template'),
  main: document.getElementById('main-app'),
  departments: document.getElementById('departments'),
  search: document.getElementById('employee-search'),
  searchResults: document.getElementById('employee-search-results'),
  summaryValues: document.querySelectorAll('[data-summary]'),
  guestForm: document.getElementById('guest-form'),
  guestHost: document.getElementById('guest-host'),
  guestLog: document.getElementById('guest-log'),
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
  policyModal: document.getElementById('policy-modal'),
  policyForm: document.getElementById('policy-form'),
  policyEmployee: document.getElementById('policy-employee'),
  policyNda: document.getElementById('policy-nda'),
  policyIt: document.getElementById('policy-it'),
  policyCancel: document.getElementById('policy-cancel'),
  policyClose: document.getElementById('policy-close'),
  screensaverAdmin: document.getElementById('screensaver-admin'),
  addSlide: document.getElementById('add-slide'),
  slideUpload: document.getElementById('slide-upload'),
  qrForm: document.getElementById('qr-form'),
  qrEmployee: document.getElementById('qr-employee'),
  qrGuest: document.getElementById('qr-guest'),
  employeeQrCanvas: document.getElementById('employee-qr'),
  guestQrCanvas: document.getElementById('guest-qr'),
  employeeQrLink: document.getElementById('employee-qr-link'),
  guestQrLink: document.getElementById('guest-qr-link'),
};

init();

async function init() {
  attachEvents();
  renderSlides();
  renderAll();
  await initializeSupabase();
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
      slides: normalizeSlides(data.screensaver?.slides || data.slides || defaultSlides),
    },
    qrLinks,
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

function cloneState(source = state) {
  return JSON.parse(JSON.stringify(source));
}

function commitState(nextState) {
  state = ensureStateDefaults(nextState || state);

  if (!supabaseClient) {
    if (!hasCloudWarning) {
      appendSyncOutput('Sky-synkronisering er ikke initialiseret. Tjek Supabase-konfigurationen.');
      hasCloudWarning = true;
    }
    return;
  }

  if (!isCloudReady) {
    if (!hasCloudWarning) {
      appendSyncOutput('Venter på forbindelse til skyen. Ændringer sendes, så snart forbindelsen er klar.');
      hasCloudWarning = true;
    }
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
  void supabaseClient
    .from(SUPABASE_TABLE)
    .upsert({ id: SUPABASE_ROW_ID, payload: snapshot, updated_at: snapshot.updatedAt })
    .then(({ error }) => {
      if (error) throw error;
      hasCloudWarning = false;
      appendSyncOutput('Skyen er opdateret.');
    })
    .catch((error) => {
      console.error('Kunne ikke gemme state i skyen', error);
      appendSyncOutput('Kunne ikke gemme til skyen. Kontrollér Supabase-forbindelsen.');
    });
}

function attachEvents() {
  elements.screensaver.addEventListener('click', () => {
    hideScreensaver();
    resetInactivityTimer();
  });

  document.addEventListener('click', resetInactivityTimer, { passive: true });
  document.addEventListener('touchstart', resetInactivityTimer, { passive: true });
  document.addEventListener('mousemove', resetInactivityTimer, { passive: true });

  elements.search?.addEventListener('input', (event) => {
    const value = event.target.value;
    renderSearchResults(value);
    renderDepartments(value);
  });

  elements.searchResults?.addEventListener('click', handleSearchResultClick);

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

  elements.policyForm?.addEventListener('submit', handlePolicySubmit);
  elements.policyCancel?.addEventListener('click', closePolicyModal);
  elements.policyClose?.addEventListener('click', closePolicyModal);

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
          <img src="assets/logo.svg" alt="SUBRA" class="logo" />
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
  const filterValue = elements.search ? elements.search.value : '';
  renderSearchResults(filterValue);
  renderDepartments(filterValue);
  renderSummary();
  populateGuestHost();
  renderGuestLog();
  renderEmployeeAdminList();
  renderScreensaverAdmin();
  updateQrCodes();
}

function renderSearchResults(filter = '') {
  const container = elements.searchResults;
  if (!container) return;

  const filterValue = normalizeFilterValue(filter);
  container.innerHTML = '';
  container.classList.remove('empty');

  if (!filterValue) {
    container.classList.add('empty');
    container.appendChild(createSearchPlaceholder('Søg efter en medarbejder for at registrere ankomst eller afgang.'));
    return;
  }

  const filtered = state.employees
    .filter((employee) => matchesSearchTerm(employee, filterValue))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'da', { sensitivity: 'base' }));

  const matches = filtered.slice(0, 8);

  if (!matches.length) {
    container.classList.add('empty');
    container.appendChild(createSearchPlaceholder('Ingen medarbejdere matcher din søgning.'));
    return;
  }

  container.classList.remove('empty');
  matches.forEach((employee) => {
    container.appendChild(createSearchResultItem(employee));
  });

  if (filtered.length > matches.length) {
    container.appendChild(
      createSearchPlaceholder('Viser de første resultater. Brug afdelingsoversigten for at se resten.', 'overflow-hint')
    );
  }
}

function createSearchPlaceholder(message, modifierClass = '') {
  const paragraph = document.createElement('p');
  paragraph.className = 'search-placeholder';
  if (modifierClass) {
    paragraph.classList.add(modifierClass);
  }
  paragraph.textContent = message;
  return paragraph;
}

function createSearchResultItem(employee) {
  const item = document.createElement('article');
  item.className = 'search-result';
  item.dataset.id = employee.id;

  const row = document.createElement('div');
  row.className = 'search-result-row';

  const meta = document.createElement('div');
  meta.className = 'search-result-meta';

  const name = document.createElement('strong');
  name.textContent = `${employee.firstName} ${employee.lastName}`;

  const secondary = document.createElement('span');
  secondary.textContent = employee.role
    ? `${employee.department} · ${employee.role}`
    : employee.department;

  meta.append(name, secondary);

  const status = document.createElement('span');
  status.className = 'search-status';
  status.textContent = formatStatusText(employee);

  row.append(meta, status);

  const actions = document.createElement('div');
  actions.className = 'search-actions';

  const checkIn = document.createElement('button');
  checkIn.className = 'primary';
  checkIn.type = 'button';
  checkIn.dataset.action = 'checkin';
  checkIn.dataset.id = employee.id;
  checkIn.textContent = 'Tjek ind';
  checkIn.disabled = employee.status === 'onsite';

  const checkOut = document.createElement('button');
  checkOut.className = 'ghost';
  checkOut.type = 'button';
  checkOut.dataset.action = 'checkout';
  checkOut.dataset.id = employee.id;
  checkOut.textContent = 'Tjek ud';
  checkOut.disabled = employee.status === 'remote';

  const statusButton = document.createElement('button');
  statusButton.className = 'ghost';
  statusButton.type = 'button';
  statusButton.dataset.action = 'status';
  statusButton.dataset.id = employee.id;
  statusButton.textContent = 'Status & fravær';

  actions.append(checkIn, checkOut, statusButton);

  item.append(row, actions);
  return item;
}

function normalizeFilterValue(filter) {
  return (filter || '').toString().toLowerCase().trim();
}

function matchesSearchTerm(employee, filterValue) {
  if (!filterValue) return true;
  const haystack = `${employee.firstName} ${employee.lastName} ${employee.department} ${employee.role}`.toLowerCase();
  return haystack.includes(filterValue);
}

function renderDepartments(filter = '') {
  const container = elements.departments;
  if (!container) return;
  const filterValue = normalizeFilterValue(filter);
  container.innerHTML = '';

  const grouped = groupEmployees(state.employees);

  grouped.forEach(([department, employees]) => {
    const filteredEmployees = employees.filter((emp) => matchesSearchTerm(emp, filterValue));

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

    filteredEmployees
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'da', { sensitivity: 'base' }))
      .forEach((employee) => {
        grid.appendChild(createEmployeeCard(employee));
      });

    departmentCard.appendChild(grid);
    container.appendChild(departmentCard);
  });
}

function groupEmployees(employees) {
  const map = new Map();
  employees.forEach((employee) => {
    const key = employee.department;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(employee);
  });

  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'da', { sensitivity: 'base' }));
}

function createEmployeeCard(employee) {
  const card = document.createElement('div');
  card.className = 'employee-card';
  card.dataset.id = employee.id;
  card.dataset.status = employee.status || 'away';

  const avatar = document.createElement('div');
  avatar.className = 'employee-avatar';
  if (employee.photo) {
    const img = document.createElement('img');
    img.src = employee.photo;
    img.alt = `${employee.firstName} ${employee.lastName}`;
    avatar.appendChild(img);
  } else {
    avatar.textContent = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`;
  }

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

  card.append(avatar, info, actions);
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
    default:
      return 'Ingen registrering endnu';
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

  handleEmployeeAction(card.dataset.id, action);
}

function handleSearchResultClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const employeeId = event.target.dataset.id || event.target.closest('.search-result')?.dataset.id;
  if (!employeeId) return;

  handleEmployeeAction(employeeId, action);
}

function handleEmployeeAction(employeeId, action) {
  const employee = state.employees.find((emp) => emp.id === employeeId);
  if (!employee) return;

  if (action === 'checkin') {
    if (!hasAcceptedPolicies(employee.id)) {
      openPolicyModal(employee, () => updateEmployeeStatus(employee.id, 'onsite', 'Ankommet'));
    } else {
      updateEmployeeStatus(employee.id, 'onsite', 'Ankommet');
    }
  }

  if (action === 'checkout') {
    updateEmployeeStatus(employee.id, 'remote', 'Arbejder hjemmefra efter checkout');
  }

  if (action === 'status') {
    openStatusModal(employee);
  }
}

function hasAcceptedPolicies(employeeId) {
  const record = state.policyAcknowledgements?.[employeeId];
  return Boolean(record?.nda && record?.it);
}

function openPolicyModal(employee, onAccept) {
  activePolicyEmployee = employee;
  pendingPolicyAction = onAccept;
  if (elements.policyEmployee) {
    elements.policyEmployee.textContent = `${employee.firstName} ${employee.lastName}`;
  }
  if (elements.policyForm) {
    elements.policyForm.reset();
  }
  if (elements.policyModal) {
    elements.policyModal.classList.remove('hidden');
    elements.policyModal.setAttribute('aria-hidden', 'false');
  }
  if (elements.policyNda) {
    setTimeout(() => elements.policyNda.focus(), 0);
  }
}

function closePolicyModal() {
  if (elements.policyModal) {
    elements.policyModal.classList.add('hidden');
    elements.policyModal.setAttribute('aria-hidden', 'true');
  }
  if (elements.policyForm) {
    elements.policyForm.reset();
  }
  activePolicyEmployee = null;
  pendingPolicyAction = null;
}

function handlePolicySubmit(event) {
  event.preventDefault();
  if (!activePolicyEmployee || typeof pendingPolicyAction !== 'function') {
    closePolicyModal();
    return;
  }

  if (!elements.policyNda?.checked || !elements.policyIt?.checked) {
    alert('Accepter begge politikker for at fortsætte.');
    return;
  }

  state.policyAcknowledgements = state.policyAcknowledgements || {};
  state.policyAcknowledgements[activePolicyEmployee.id] = {
    nda: true,
    it: true,
    timestamp: new Date().toISOString(),
  };

  const action = pendingPolicyAction;
  closePolicyModal();
  commitState();
  action();
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

function populateGuestHost() {
  const select = elements.guestHost;
  select.innerHTML = '';

  groupEmployees(state.employees).forEach(([, employees]) => {
    employees
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
      const policyRecord = state.policyAcknowledgements?.[employee.id];
      const acceptedDate = policyRecord?.timestamp
        ? new Date(policyRecord.timestamp).toLocaleDateString('da-DK')
        : null;
      const policyLabel = acceptedDate ? `Politikker accepteret ${acceptedDate}` : 'Manglende politik-godkendelse';
      info.innerHTML = `
        <strong>${employee.firstName} ${employee.lastName}</strong>
        <small>${employee.department} · ${employee.role || 'Ingen titel'}</small>
        <small class="policy-state">${policyLabel}</small>
      `;

      const actions = document.createElement('div');

      const resetPolicyButton = document.createElement('button');
      resetPolicyButton.innerHTML = '📄';
      resetPolicyButton.title = 'Nulstil politik-godkendelser';
      resetPolicyButton.addEventListener('click', () => resetPolicyAcknowledgement(employee.id));

      const editButton = document.createElement('button');
      editButton.innerHTML = '✏️';
      editButton.addEventListener('click', () => populateEmployeeForm(employee));

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '🗑️';
      deleteButton.addEventListener('click', () => deleteEmployee(employee.id));

      actions.append(resetPolicyButton, editButton, deleteButton);

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
  if (!elements.employeeQrCanvas || !elements.guestQrCanvas) return;
  renderQrCode(elements.employeeQrCanvas, state.qrLinks.employee, 'Medarbejder QR-kode');
  renderQrCode(elements.guestQrCanvas, state.qrLinks.guest, 'Gæste QR-kode');

  if (elements.employeeQrLink) {
    elements.employeeQrLink.textContent = state.qrLinks.employee ? `→ ${state.qrLinks.employee}` : '';
  }
  if (elements.guestQrLink) {
    elements.guestQrLink.textContent = state.qrLinks.guest ? `→ ${state.qrLinks.guest}` : '';
  }
  if (elements.qrEmployee) elements.qrEmployee.value = state.qrLinks.employee || '';
  if (elements.qrGuest) elements.qrGuest.value = state.qrLinks.guest || '';
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

    renderSlides();
    renderScreensaverAdmin();
    commitState();
    appendSyncOutput('Opdaterede pauseskærmsbilledet via Supabase Storage.');
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
    await deleteStorageAsset(removed.storagePath);
  }
}

async function initializeSupabase() {
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    appendSyncOutput('Supabase SDK kunne ikke indlæses.');
    return;
  }

  if (!SUPABASE_CONFIG?.url || !SUPABASE_CONFIG?.anonKey) {
    appendSyncOutput('Tilføj dine Supabase-nøgler i supabase-config.js for at aktivere synkronisering.');
    return;
  }

  try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      realtime: { params: { eventsPerSecond: 2 } },
    });

    await ensureCloudState();
    subscribeToCloudState();
    isCloudReady = true;
    appendSyncOutput(
      `Forbundet til Supabase-projektet ${new URL(SUPABASE_CONFIG.url).host}. Alle ændringer gemmes i skyen.`
    );
  } catch (error) {
    console.error('Kunne ikke initialisere Supabase', error);
    appendSyncOutput('Kunne ikke oprette forbindelse til Supabase. Kontrollér konfigurationen i supabase-config.js.');
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
      state = seed;
    } else {
      state = ensureStateDefaults(data.payload);
    }
    renderSlides();
    renderAll();
  } catch (error) {
    console.error('Kunne ikke hente state fra Supabase', error);
    appendSyncOutput('Kunne ikke hente data fra skyen. Prøv at genindlæse siden.');
  }
}

function subscribeToCloudState() {
  if (!supabaseClient) return;

  if (supabaseChannel) {
    supabaseClient.removeChannel(supabaseChannel);
  }

  supabaseChannel = supabaseClient
    .channel(`subra-kiosk-${SUPABASE_ROW_ID}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SUPABASE_TABLE, filter: `id=eq.${SUPABASE_ROW_ID}` },
      (payload) => {
        if (!payload?.new?.payload || isApplyingRemoteState) return;
        isApplyingRemoteState = true;
        isCloudReady = true;
        hasCloudWarning = false;
        state = ensureStateDefaults(payload.new.payload);
        renderSlides();
        renderAll();
        isApplyingRemoteState = false;
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isCloudReady = true;
      }
    });
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

async function handleQrSubmit(event) {
  event.preventDefault();
  state.qrLinks.employee = elements.qrEmployee?.value.trim() || '';
  state.qrLinks.guest = elements.qrGuest?.value.trim() || '';
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
  if (state.policyAcknowledgements?.[id]) {
    delete state.policyAcknowledgements[id];
  }
  appendSyncOutput(`Fjernede medarbejder: ${id}`);
  renderAll();
  commitState();
}

function resetPolicyAcknowledgement(id) {
  if (state.policyAcknowledgements?.[id]) {
    delete state.policyAcknowledgements[id];
    const employee = state.employees.find((emp) => emp.id === id);
    appendSyncOutput(
      `Politik-godkendelser nulstillet for ${employee ? `${employee.firstName} ${employee.lastName}` : id}.`
    );
    renderAll();
    commitState();
  } else {
    appendSyncOutput('Ingen politik-godkendelser at nulstille.');
  }
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
