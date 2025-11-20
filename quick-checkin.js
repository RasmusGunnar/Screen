const backendMode = (window.SUBRA_LOCAL_CONFIG?.backendMode || 'firebase').toLowerCase();
const firebaseAdapter = window.SubraFirebase || null;
const localAdapter = window.SubraLocalBackend || null;
const dataAdapter = (backendMode === 'local' && localAdapter) || firebaseAdapter;

let LOCAL_CONFIG = null;
let adapterReady = false;
let state = ensureStateDefaults();
let stateUnsubscribe = null;
let lastSyncedAt = null;

const STATUS_LABELS = {
  onsite: 'På kontoret',
  remote: 'Hjemmearbejde',
  left: 'Gået hjem for i dag',
  away: 'Fravær',
  unknown: 'Ikke registreret',
};

const elements = {
  search: document.getElementById('qc-search'),
  list: document.getElementById('qc-employee-list'),
  statusText: document.getElementById('qc-status-text'),
  counter: document.getElementById('qc-counter'),
  syncButton: document.getElementById('qc-sync'),
};

initQuickCheckin();

function applyLocalConfig(config) {
  LOCAL_CONFIG = config || {};
  if (dataAdapter?.configure) {
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

async function initQuickCheckin() {
  applyLocalConfig(window.SUBRA_LOCAL_CONFIG || {});
  setupEvents();
  await bootstrapState();
}

function setupEvents() {
  elements.search?.addEventListener('input', renderEmployees);
  elements.syncButton?.addEventListener('click', () => refreshFromBackend(true));
}

async function bootstrapState() {
  if (!dataAdapter) {
    setStatus('Ingen backend tilgængelig. Viser kun lokale data.', true);
    renderEmployees();
    return;
  }

  dataAdapter.init(getAdapterOptions());
  try {
    if (dataAdapter.ensureKioskAuth) {
      await dataAdapter.ensureKioskAuth(LOCAL_CONFIG?.kiosk?.authMode || 'anonymous');
    }
    adapterReady = dataAdapter.isReady ? dataAdapter.isReady() : true;
  } catch (error) {
    setStatus(`Kunne ikke logge ind: ${error.message}`, true);
    renderEmployees();
    return;
  }

  await refreshFromBackend(true);
  startRealtime();
}

function startRealtime() {
  if (!adapterReady || !dataAdapter?.subscribeToState) return;
  const realtimeEnabled =
    LOCAL_CONFIG?.enableRealtime !== undefined
      ? LOCAL_CONFIG.enableRealtime
      : LOCAL_CONFIG?.firebase?.enableRealtime;

  if (realtimeEnabled) {
    if (stateUnsubscribe) stateUnsubscribe();
    stateUnsubscribe = dataAdapter.subscribeToState((remoteState) => {
      if (!remoteState) return;
      const normalized = ensureStateDefaults(remoteState);
      if (lastSyncedAt && normalized.updatedAt === lastSyncedAt) {
        return;
      }
      state = normalized;
      lastSyncedAt = state.updatedAt;
      renderEmployees();
      setStatus(`Synkroniseret kl. ${formatClock(new Date())}`);
    });
    return;
  }

  if (!stateUnsubscribe) {
    const timer = setInterval(() => refreshFromBackend(false), 10000);
    stateUnsubscribe = () => clearInterval(timer);
  }
}

async function refreshFromBackend(showNotice = false) {
  if (!adapterReady || !dataAdapter?.fetchState) {
    setStatus('Backend er ikke klar.', true);
    return;
  }

  try {
    const remoteState = await dataAdapter.fetchState();
    if (remoteState) {
      state = ensureStateDefaults(remoteState);
      lastSyncedAt = state.updatedAt;
      renderEmployees();
      if (showNotice) setStatus(`Opdaterede fra backend kl. ${formatClock(new Date())}`);
      return;
    }
    if (showNotice) setStatus('Ingen state fundet i backend – viser lokale defaults.', true);
  } catch (error) {
    setStatus(`Kunne ikke hente data: ${error.message}`, true);
  }
}

function renderEmployees() {
  if (!elements.list) return;
  const query = elements.search?.value?.toLowerCase()?.trim() || '';
  const employees = state.employees
    .slice()
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', { sensitivity: 'base' }))
    .filter((emp) => {
      if (!query) return true;
      const haystack = `${emp.firstName} ${emp.lastName} ${emp.department}`.toLowerCase();
      return haystack.includes(query);
    });

  elements.counter.textContent = `${employees.length} medarbejdere`;

  if (!employees.length) {
    elements.list.innerHTML = '<p class="qc-empty">Ingen medarbejdere matchede din søgning.</p>';
    return;
  }

  elements.list.innerHTML = '';
  employees.forEach((employee) => {
    const card = document.createElement('article');
    card.className = 'qc-card';
    card.dataset.id = employee.id;

    const header = document.createElement('header');
    const title = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = `${employee.firstName} ${employee.lastName}`;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = [employee.department, employee.role].filter(Boolean).join(' · ');
    title.append(name, meta);

    const pill = document.createElement('span');
    pill.className = 'qc-status-pill';
    const status = employee.status || 'unknown';
    pill.dataset.status = status;
    pill.textContent = STATUS_LABELS[status] || STATUS_LABELS.unknown;

    header.append(title, pill);

    const statusText = document.createElement('p');
    statusText.className = 'status-text';
    statusText.textContent = formatStatusText(employee);

    const actions = document.createElement('div');
    actions.className = 'qc-actions';

    const onsite = document.createElement('button');
    onsite.className = 'primary';
    onsite.dataset.action = 'checkin';
    onsite.textContent = 'Tjek ind';

    const checkout = document.createElement('button');
    checkout.className = 'ghost';
    checkout.dataset.action = 'checkout';
    checkout.textContent = 'Gå hjem for i dag';

    const remote = document.createElement('button');
    remote.className = 'ghost';
    remote.dataset.action = 'remote';
    remote.textContent = 'Arbejd hjemme';

    actions.append(onsite, checkout, remote);

    actions.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      handleAction(employee.id, action);
    });

    card.append(header, statusText, actions);
    elements.list.appendChild(card);
  });
}

function handleAction(employeeId, action) {
  if (action === 'checkin') {
    updateEmployeeStatus(employeeId, 'onsite', 'Tjekket ind via hurtig side');
  }
  if (action === 'checkout') {
    updateEmployeeStatus(employeeId, 'left', 'Gået hjem for i dag');
  }
  if (action === 'remote') {
    updateEmployeeStatus(employeeId, 'remote', 'Markeret som hjemmearbejde via QR');
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

  logEvent({ type: 'status-change', employeeId: employee.id, status, note });
  renderEmployees();
  commitState();
}

function formatStatusText(employee) {
  const timestamp = employee.lastStatusChange ? new Date(employee.lastStatusChange) : null;
  const timeString = timestamp ? timestamp.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '';

  switch (employee.status) {
    case 'onsite':
      return `På kontoret siden ${timeString}`;
    case 'remote':
      return employee.statusNotes || `Hjemmearbejde (${timeString})`;
    case 'left':
      return employee.statusNotes || `Gået hjem for i dag (${timeString})`;
    case 'away':
      return employee.statusNotes || 'Registreret fravær';
    default:
      return 'Ingen status registreret endnu.';
  }
}

function logEvent(entry) {
  state.logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (state.logs.length > 500) {
    state.logs = state.logs.slice(0, 500);
  }
}

async function commitState(nextState) {
  state = ensureStateDefaults(nextState || state);
  state.updatedAt = new Date().toISOString();
  state.settings = state.settings || {};
  state.settings.kiosk = state.settings.kiosk || {};
  state.settings.kiosk.id =
    state.settings.kiosk.id || LOCAL_CONFIG?.stateDocId || LOCAL_CONFIG?.firebase?.stateDocId || 'local';
  state.settings.kiosk.lastSynced = state.updatedAt;

  if (!adapterReady || !dataAdapter?.saveState) {
    setStatus('Ændringerne er gemt lokalt men kunne ikke pushes til backend.', true);
    return;
  }

  try {
    await dataAdapter.saveState(state);
    setStatus(`Gemte ændringer kl. ${formatClock(new Date())}`);
  } catch (error) {
    setStatus(`Kunne ikke gemme i backend: ${error.message}`, true);
  }
}

function ensureStateDefaults(data = {}) {
  const employees = (data.employees || (window.SUBRA_DEFAULTS?.employees || [])).map((emp) => ({
    ...emp,
    lastStatusChange: emp.lastStatusChange || new Date().toISOString(),
  }));

  const qrLinks = {
    employee: (data.qrLinks?.employee || window.SUBRA_DEFAULTS?.qrLinks?.employee || '').trim(),
    guest: (data.qrLinks?.guest || window.SUBRA_DEFAULTS?.qrLinks?.guest || '').trim(),
  };

  const policyLinks = {
    nda: (data.policyLinks?.nda || window.SUBRA_DEFAULTS?.policyLinks?.nda || '').trim(),
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
    visitors: {
      timeline: data.visitors?.timeline || [],
      remembered: data.visitors?.remembered || [],
      preregistrations: data.visitors?.preregistrations || [],
    },
    deliveries: data.deliveries || [],
    spaces: {
      bookings: data.spaces?.bookings || [],
      resources: data.spaces?.resources || [],
    },
    evacuation: {
      lastRefreshed: data.evacuation?.lastRefreshed || null,
      roster: data.evacuation?.roster || [],
    },
    screensaver: {
      slides: normalizeSlides(data.screensaver?.slides || data.slides || (window.SUBRA_DEFAULTS?.slides || [])),
    },
    qrLinks,
    policyLinks,
    settings,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeSlides(slides) {
  const fallback = Array.isArray(slides) && slides.length ? slides : window.SUBRA_DEFAULTS?.slides || [];
  return fallback
    .map((slide, index) => ({
      id: slide.id || `slide-${Date.now()}-${index}`,
      theme: slide.theme || 'fjord',
      headline: slide.headline || '',
      description: slide.description || '',
      image: slide.image || '',
      storagePath: slide.storagePath || null,
      uploadedName: slide.uploadedName || '',
      order: typeof slide.order === 'number' ? slide.order : index,
      createdAt: slide.createdAt || null,
      updatedAt: slide.updatedAt || null,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function formatClock(date) {
  return date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function setStatus(message, isError = false) {
  if (!elements.statusText) return;
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? '#fca5a5' : 'var(--muted)';
}
