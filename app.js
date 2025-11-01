const STORAGE_KEY = 'subra-kiosk-state-v2';
const INACTIVITY_TIMEOUT = 60000; // 60 sekunder før pauseskærm

const seedEmployees = [
  {
    id: 'emp-anna-andersen',
    firstName: 'Anna',
    lastName: 'Andersen',
    role: 'Design Lead',
    department: 'Brand & Design',
    contact: 'anna.andersen@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=200&q=80',
    status: 'onsite',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Ankom 08:02',
  },
  {
    id: 'emp-bjorn-larsen',
    firstName: 'Bjørn',
    lastName: 'Larsen',
    role: 'Digital Designer',
    department: 'Brand & Design',
    contact: '+45 33 11 22 33',
    photo:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=facearea&w=200&q=80',
    status: 'remote',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Arbejder hjemme hele dagen',
  },
  {
    id: 'emp-nora-holm',
    firstName: 'Nora',
    lastName: 'Holm',
    role: 'Studio Coordinator',
    department: 'Brand & Design',
    contact: 'nora.holm@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&q=80',
    status: 'away',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Barsel til 31/10',
    absence: {
      from: new Date().toISOString().split('T')[0],
      to: '2024-10-31',
    },
  },
  {
    id: 'emp-jens-iversen',
    firstName: 'Jens',
    lastName: 'Iversen',
    role: 'Chief Technology Officer',
    department: 'Digital Platforms',
    contact: 'jens.iversen@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&w=200&q=80',
    status: 'onsite',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Ankom 07:48',
  },
  {
    id: 'emp-ulla-krogh',
    firstName: 'Ulla',
    lastName: 'Krogh',
    role: 'Solutions Architect',
    department: 'Digital Platforms',
    contact: 'ulla.krogh@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&w=200&q=80',
    status: 'onsite',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Ankom 08:15',
  },
  {
    id: 'emp-mikkel-foss',
    firstName: 'Mikkel',
    lastName: 'Foss',
    role: 'Frontend Engineer',
    department: 'Digital Platforms',
    contact: 'mikkel.foss@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&w=200&q=80',
    status: 'remote',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Opsætning af ny release hjemmefra',
  },
  {
    id: 'emp-signe-nygaard',
    firstName: 'Signe',
    lastName: 'Nygaard',
    role: 'Head of People',
    department: 'People & Culture',
    contact: 'signe.nygaard@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=200&q=80',
    status: 'onsite',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Ankom 08:20',
  },
  {
    id: 'emp-louise-kaspersen',
    firstName: 'Louise',
    lastName: 'Kaspersen',
    role: 'People Partner',
    department: 'People & Culture',
    contact: 'louise.kaspersen@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&w=200&q=80',
    status: 'onsite',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Ankom 08:05',
  },
  {
    id: 'emp-emil-soerensen',
    firstName: 'Emil',
    lastName: 'Sørensen',
    role: 'People Coordinator',
    department: 'People & Culture',
    contact: 'emil.soerensen@subra.dk',
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&q=80',
    status: 'away',
    lastStatusChange: new Date().toISOString(),
    statusNotes: 'Sygdom - forventet tilbage 25/09',
    absence: {
      from: new Date().toISOString().split('T')[0],
      to: '2024-09-25',
    },
  },
];

const defaultSlides = [
  {
    id: 'slide-1',
    theme: 'fjord',
    headline: 'Velkommen til SUBRA',
    description: 'Registrer ankomst og afgang direkte på skærmen',
    image:
      'https://images.unsplash.com/photo-1529336953121-4974abd5ea47?auto=format&fit=crop&w=1080&q=80',
  },
  {
    id: 'slide-2',
    theme: 'aurora',
    headline: 'Nordisk ro, effektiv drift',
    description: 'Få fuldt overblik over medarbejdere og gæster',
    image:
      'https://images.unsplash.com/photo-1526481280695-3c4699d78ff0?auto=format&fit=crop&w=1080&q=80',
  },
  {
    id: 'slide-3',
    theme: 'ocean',
    headline: 'Tryghed og compliance',
    description: 'Politikker, logning og evakueringslister samlet ét sted',
    image:
      'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1080&q=80',
  },
];

const DEFAULT_QR_LINKS = {
  employee: 'https://subra-kiosk.example.com/employee',
  guest: 'https://subra-kiosk.example.com/guest',
};

const SLIDE_THEMES = [
  { value: 'fjord', label: 'Fjord · kølig blå' },
  { value: 'aurora', label: 'Aurora · grøn gradient' },
  { value: 'ocean', label: 'Ocean · dyb turkis' },
  { value: 'sand', label: 'Sand · varm neutral' },
  { value: 'forest', label: 'Forest · nordisk grøn' },
];

let state = loadState();
let inactivityTimer;
let activeModalEmployee = null;
let activePolicyEmployee = null;
let pendingPolicyAction = null;
let screensaverInterval;
let pendingSlideUploadId = null;
let firebaseApp = null;
let firebaseServices = { storage: null, firestore: null };
let firebaseSlideUnsubscribe = null;

const elements = {
  screensaver: document.getElementById('screensaver'),
  slideTemplate: document.getElementById('screensaver-slide-template'),
  main: document.getElementById('main-app'),
  departments: document.getElementById('departments'),
  search: document.getElementById('employee-search'),
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
  useFirebaseSlides: document.getElementById('use-firebase-slides'),
  firebaseForm: document.getElementById('firebase-form'),
  firebaseApiKey: document.getElementById('firebase-api-key'),
  firebaseAuthDomain: document.getElementById('firebase-auth-domain'),
  firebaseProjectId: document.getElementById('firebase-project-id'),
  firebaseStorageBucket: document.getElementById('firebase-storage-bucket'),
  firebaseMessagingSender: document.getElementById('firebase-messaging-sender'),
  firebaseAppId: document.getElementById('firebase-app-id'),
  clearFirebase: document.getElementById('clear-firebase'),
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
  await initializeFirebaseIfConfigured();
  renderSlides();
  renderAll();
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
    firebase: {
      config: data.settings?.firebase?.config || null,
      useSlidesStorage: Boolean(data.settings?.firebase?.useSlidesStorage),
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return ensureStateDefaults(parsed);
    }
  } catch (error) {
    console.warn('Kunne ikke indlæse gemte data', error);
  }

  return ensureStateDefaults();
}

function saveState() {
  try {
    state = ensureStateDefaults(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Kunne ikke gemme data', error);
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

  elements.search.addEventListener('input', () => renderDepartments(elements.search.value));

  elements.departments.addEventListener('click', handleDepartmentClick);

  elements.guestForm.addEventListener('submit', handleGuestSubmit);

  elements.modalClose.addEventListener('click', closeModal);
  elements.statusForm.addEventListener('submit', handleStatusSubmit);

  elements.adminToggle.addEventListener('click', toggleDrawer);
  elements.drawerClose.addEventListener('click', toggleDrawer);

  elements.employeeForm.addEventListener('submit', handleEmployeeSubmit);
  elements.resetForm.addEventListener('click', () => {
    elements.employeeForm.reset();
    elements.employeeId.value = '';
  });

  elements.exportData.addEventListener('click', exportData);
  elements.importData.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', handleImport);

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
  elements.useFirebaseSlides?.addEventListener('change', handleFirebaseSlideToggle);
  elements.firebaseForm?.addEventListener('submit', handleFirebaseSubmit);
  elements.clearFirebase?.addEventListener('click', handleFirebaseClear);
  elements.qrForm?.addEventListener('submit', handleQrSubmit);
}

function renderSlides() {
  if (!elements.screensaver) return;
  elements.screensaver.innerHTML = '';

  const slides = state.screensaver?.slides || [];
  if (!slides.length) {
    const hint = document.createElement('p');
    hint.className = 'screensaver-hint';
    hint.textContent = 'Tilføj et slide i adminpanelet for at starte.';
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
  renderDepartments(elements.search.value);
  renderSummary();
  populateGuestHost();
  renderGuestLog();
  renderEmployeeAdminList();
  renderScreensaverAdmin();
  renderFirebaseSettings();
  updateQrCodes();
  saveState();
}

function renderDepartments(filter = '') {
  const filterValue = filter?.toLowerCase().trim() || '';
  const container = elements.departments;
  container.innerHTML = '';

  const grouped = groupEmployees(state.employees);

  grouped.forEach(([department, employees]) => {
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

  const employee = state.employees.find((emp) => emp.id === card.dataset.id);
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
  elements.syncOutput.textContent = `${timestamp} · ${message}\n${elements.syncOutput.textContent}`;
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

  if (elements.useFirebaseSlides) {
    elements.useFirebaseSlides.checked = Boolean(state.settings?.firebase?.useSlidesStorage);
    elements.useFirebaseSlides.disabled = !state.settings?.firebase?.config?.apiKey;
  }
}

function renderFirebaseSettings() {
  if (!elements.firebaseForm) return;
  const config = state.settings?.firebase?.config || {};
  if (elements.firebaseApiKey) elements.firebaseApiKey.value = config.apiKey || '';
  if (elements.firebaseAuthDomain) elements.firebaseAuthDomain.value = config.authDomain || '';
  if (elements.firebaseProjectId) elements.firebaseProjectId.value = config.projectId || '';
  if (elements.firebaseStorageBucket) elements.firebaseStorageBucket.value = config.storageBucket || '';
  if (elements.firebaseMessagingSender) elements.firebaseMessagingSender.value = config.messagingSenderId || '';
  if (elements.firebaseAppId) elements.firebaseAppId.value = config.appId || '';
  if (elements.useFirebaseSlides) {
    elements.useFirebaseSlides.checked = Boolean(state.settings?.firebase?.useSlidesStorage);
    elements.useFirebaseSlides.disabled = !config.apiKey;
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
    placeholder.textContent = 'Angiv et link i adminpanelet for at generere en QR-kode.';
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
  saveState();
  void persistSlide(slide);
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
  saveState();
  void persistSlide(slide);
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
    void persistSlide(slide);
  });

  renderSlides();
  renderScreensaverAdmin();
  saveState();
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
    let uploadResult;
    if (shouldUseFirebaseSlides()) {
      uploadResult = await uploadSlideToFirebase(file, slide);
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      uploadResult = { url: dataUrl, path: null };
    }

    if (uploadResult?.path && slide.storagePath && uploadResult.path !== slide.storagePath) {
      await deleteFirebaseAsset(slide.storagePath);
    }

    slide.image = uploadResult.url;
    slide.storagePath = uploadResult.path;
    slide.updatedAt = new Date().toISOString();

    renderSlides();
    renderScreensaverAdmin();
    saveState();
    appendSyncOutput('Opdaterede pauseskærmsbilledet.');
    await persistSlide(slide);
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
  saveState();
  appendSyncOutput('Fjernede slide fra pauseskærmen.');

  if (shouldUseFirebaseSlides()) {
    try {
      await firebaseServices.firestore
        .collection('screensaverSlides')
        .doc(slideId)
        .delete();
      if (removed?.storagePath) {
        await deleteFirebaseAsset(removed.storagePath);
      }
    } catch (error) {
      console.warn('Kunne ikke fjerne slide fra Firebase', error);
    }
  }
}

async function persistSlide(slide) {
  if (!shouldUseFirebaseSlides()) return;
  try {
    const docRef = firebaseServices.firestore
      .collection('screensaverSlides')
      .doc(slide.id);
    const payload = {
      headline: slide.headline || '',
      description: slide.description || '',
      theme: slide.theme || 'fjord',
      image: slide.image || '',
      storagePath: slide.storagePath || null,
      order: typeof slide.order === 'number' ? slide.order : 0,
      updatedAt:
        firebase.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    };

    if (!slide.createdAt) {
      const createdValue = firebase.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
      payload.createdAt = createdValue;
      if (typeof createdValue === 'string') {
        slide.createdAt = createdValue;
      }
    }

    await docRef.set(payload, { merge: true });
  } catch (error) {
    console.warn('Kunne ikke synkronisere slide til Firebase', error);
  }
}

function shouldUseFirebaseSlides() {
  const config = state.settings?.firebase?.config;
  return Boolean(config && config.apiKey && state.settings?.firebase?.useSlidesStorage && firebaseServices.firestore);
}

async function initializeFirebaseIfConfigured() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK ikke indlæst.');
    return;
  }

  const config = state.settings?.firebase?.config;
  if (!config?.apiKey) {
    detachFirebaseSlideSubscription();
    firebaseServices = { storage: null, firestore: null };
    return;
  }

  try {
    if (firebaseApp && firebaseApp.options?.apiKey !== config.apiKey) {
      firebaseApp.delete?.();
      firebaseApp = null;
    }

    if (!firebaseApp) {
      const existing = firebase.apps?.find((app) => app.options?.apiKey === config.apiKey);
      firebaseApp = existing || firebase.initializeApp(config);
    }

    firebaseServices.storage = firebase.storage();
    firebaseServices.firestore = firebase.firestore();
  } catch (error) {
    console.warn('Kunne ikke initialisere Firebase', error);
    appendSyncOutput('Kunne ikke initialisere Firebase. Kontrollér nøglerne.');
    firebaseServices = { storage: null, firestore: null };
    return;
  }

  if (state.settings?.firebase?.useSlidesStorage) {
    await ensureCloudSlides();
  }
}

async function handleFirebaseSubmit(event) {
  event.preventDefault();
  const config = {
    apiKey: elements.firebaseApiKey?.value.trim() || undefined,
    authDomain: elements.firebaseAuthDomain?.value.trim() || undefined,
    projectId: elements.firebaseProjectId?.value.trim() || undefined,
    storageBucket: elements.firebaseStorageBucket?.value.trim() || undefined,
    messagingSenderId: elements.firebaseMessagingSender?.value.trim() || undefined,
    appId: elements.firebaseAppId?.value.trim() || undefined,
  };

  const hasValues = Object.values(config).some(Boolean);
  state.settings.firebase.config = hasValues ? config : null;
  if (!hasValues) {
    state.settings.firebase.useSlidesStorage = false;
  }
  saveState();
  await initializeFirebaseIfConfigured();
  renderFirebaseSettings();
  renderScreensaverAdmin();
  appendSyncOutput(hasValues ? 'Gemte Firebase-konfigurationen.' : 'Ryddede Firebase-konfigurationen.');
}

function handleFirebaseClear() {
  state.settings.firebase.config = null;
  state.settings.firebase.useSlidesStorage = false;
  detachFirebaseSlideSubscription();
  firebaseApp?.delete?.();
  firebaseApp = null;
  firebaseServices = { storage: null, firestore: null };
  renderFirebaseSettings();
  renderScreensaverAdmin();
  saveState();
  appendSyncOutput('Firebase-konfigurationen er ryddet.');
}

async function handleFirebaseSlideToggle(event) {
  state.settings.firebase.useSlidesStorage = event.target.checked;
  saveState();
  if (state.settings.firebase.useSlidesStorage) {
    await initializeFirebaseIfConfigured();
    if (shouldUseFirebaseSlides()) {
      await ensureCloudSlides();
      appendSyncOutput('Firebase-synkronisering for slides er aktiveret.');
    } else {
      appendSyncOutput('Firebase er ikke korrekt konfigureret endnu.');
      event.target.checked = false;
      state.settings.firebase.useSlidesStorage = false;
    }
  } else {
    detachFirebaseSlideSubscription();
    appendSyncOutput('Slides synkroniseres nu kun lokalt.');
  }
  renderFirebaseSettings();
}

function detachFirebaseSlideSubscription() {
  if (typeof firebaseSlideUnsubscribe === 'function') {
    firebaseSlideUnsubscribe();
  }
  firebaseSlideUnsubscribe = null;
}

async function ensureCloudSlides() {
  if (!firebaseServices.firestore) return;
  detachFirebaseSlideSubscription();

  firebaseSlideUnsubscribe = firebaseServices.firestore
    .collection('screensaverSlides')
    .orderBy('order')
    .onSnapshot(
      (snapshot) => {
        const slides = snapshot.docs.map((doc, index) => ({
          id: doc.id,
          ...doc.data(),
          order: typeof doc.data().order === 'number' ? doc.data().order : index,
        }));
        if (slides.length) {
          state.screensaver.slides = normalizeSlides(slides);
          renderSlides();
          renderScreensaverAdmin();
          saveState();
        }
      },
      (error) => console.warn('Firebase slides subscription fejlede', error)
    );

  const snapshot = await firebaseServices.firestore
    .collection('screensaverSlides')
    .orderBy('order')
    .get();

  if (snapshot.empty && state.screensaver.slides.length) {
    await Promise.all(
      state.screensaver.slides.map((slide, index) =>
        firebaseServices.firestore.collection('screensaverSlides').doc(slide.id).set({
          headline: slide.headline || '',
          description: slide.description || '',
          theme: slide.theme || 'fjord',
          image: slide.image || '',
          storagePath: slide.storagePath || null,
          order: index,
          createdAt: firebase.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
        })
      )
    );
  }
}

async function handleQrSubmit(event) {
  event.preventDefault();
  state.qrLinks.employee = elements.qrEmployee?.value.trim() || '';
  state.qrLinks.guest = elements.qrGuest?.value.trim() || '';
  updateQrCodes();
  saveState();
  appendSyncOutput('Opdaterede QR-links.');
}

async function uploadSlideToFirebase(file, slide) {
  if (!firebaseServices.storage) {
    throw new Error('Firebase Storage er ikke initialiseret.');
  }
  const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
  const path = `screensaver/${slide.id}-${Date.now()}-${safeName}`;
  const storageRef = firebaseServices.storage.ref(path);
  await storageRef.put(file);
  const url = await storageRef.getDownloadURL();
  return { url, path };
}

async function deleteFirebaseAsset(path) {
  if (!firebaseServices.storage || !path) return;
  try {
    await firebaseServices.storage.ref(path).delete();
  } catch (error) {
    console.warn('Kunne ikke slette fil i Firebase Storage', error);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
}

function resetPolicyAcknowledgement(id) {
  if (state.policyAcknowledgements?.[id]) {
    delete state.policyAcknowledgements[id];
    const employee = state.employees.find((emp) => emp.id === id);
    appendSyncOutput(
      `Politik-godkendelser nulstillet for ${employee ? `${employee.firstName} ${employee.lastName}` : id}.`
    );
    renderAll();
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
