const STORAGE_KEY = 'subra-kiosk-state-v1';
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

const screensaverSlides = [
  {
    id: 'slide-1',
    theme: 'fjord',
    headline: 'Welcome to SUBRA',
    description: 'Registrer your arrival and departure',
  },
  {
    id: 'slide-2',
    theme: 'aurora',
    headline: 'Stay inspired',
    description: 'Swipe to discover what happens at SUBRA',
  },
  {
    id: 'slide-3',
    theme: 'ocean',
    headline: 'Safety first',
    description: 'Registrer gæster og kolleger for fuldt overblik',
  },
];

let state = loadState();
let inactivityTimer;
let activeModalEmployee = null;

const elements = {
  screensaver: document.getElementById('screensaver'),
  slides: document.querySelectorAll('.screensaver .slide'),
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
};

init();

function init() {
  attachEvents();
  renderSlides();
  renderAll();
  startScreensaver();
  tickClock();
  setInterval(tickClock, 1000);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.employees = parsed.employees.map((emp) => ({
        ...emp,
        lastStatusChange: emp.lastStatusChange || new Date().toISOString(),
      }));
      parsed.guests = parsed.guests || [];
      parsed.logs = parsed.logs || [];
      return parsed;
    }
  } catch (error) {
    console.warn('Kunne ikke indlæse gemte data', error);
  }

  return {
    employees: seedEmployees,
    guests: [],
    logs: [],
  };
}

function saveState() {
  try {
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
}

function renderSlides() {
  elements.slides.forEach((slide, index) => {
    const data = screensaverSlides[index];
    if (!data) return;
    slide.dataset.theme = data.theme;
    slide.querySelector('.welcome-tagline').textContent = data.headline;
    slide.querySelector('.welcome-instruction').textContent = data.description;
  });
}

function renderAll() {
  renderDepartments(elements.search.value);
  renderSummary();
  populateGuestHost();
  renderGuestLog();
  renderEmployeeAdminList();
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
      info.innerHTML = `<strong>${employee.firstName} ${employee.lastName}</strong><small>${employee.department} · ${
        employee.role || 'Ingen titel'
      }</small>`;

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
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
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
      state = {
        employees: imported.employees,
        guests: imported.guests || [],
        logs: imported.logs || [],
      };
      appendSyncOutput(`Importerede data fra ${file.name}.`);
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

function startScreensaver() {
  let index = 0;
  elements.slides[index]?.classList.add('active');
  setInterval(() => {
    elements.slides[index]?.classList.remove('active');
    index = (index + 1) % elements.slides.length;
    elements.slides[index]?.classList.add('active');
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
