const backendMode = (window.SUBRA_LOCAL_CONFIG?.backendMode || 'firebase').toLowerCase();
const firebaseAdapter = window.SubraFirebase || null;
const localAdapter = window.SubraLocalBackend || null;
const dataAdapter = (backendMode === 'local' && localAdapter) || firebaseAdapter;

let LOCAL_CONFIG = null;
let adapterReady = false;
let state = ensureStateDefaults();
let stateUnsubscribe = null;
let lastSyncedAt = null;
let dailyResetTimer = null;

const DAILY_RESET_HOUR = 12;

const elements = {
  form: document.getElementById('vr-guest-form'),
  host: document.getElementById('vr-guest-host'),
  log: document.getElementById('vr-guest-log'),
  logCount: document.getElementById('vr-log-count'),
  ndaLink: document.getElementById('vr-guest-nda-link'),
  signature: document.getElementById('vr-guest-signature'),
  signatureStatus: document.getElementById('vr-signature-status'),
  signatureClear: document.getElementById('vr-signature-clear'),
  signatureData: document.getElementById('vr-guest-signature-data'),
  statusText: document.getElementById('vr-status-text'),
  syncButton: document.getElementById('vr-sync'),
};

const signaturePadState = {
  isDrawing: false,
  hasSignature: false,
  ctx: null,
  canvas: null,
};

initVisitorRegistration();

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

async function initVisitorRegistration() {
  applyLocalConfig(window.SUBRA_LOCAL_CONFIG || {});
  setupEvents();
  initSignaturePad();
  populateHosts();
  updatePolicyLink();
  renderGuestLog();
  await bootstrapState();
  checkDailyReset();
}

function setupEvents() {
  elements.form?.addEventListener('submit', handleGuestSubmit);
  elements.signatureClear?.addEventListener('click', resetSignaturePad);
  elements.syncButton?.addEventListener('click', () => refreshFromBackend(true));
}

async function bootstrapState() {
  if (!dataAdapter) {
    setStatus('Ingen backend tilgængelig. Viser kun lokale data.', true);
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
      renderGuestLog();
      populateHosts();
      updatePolicyLink();
      setStatus(`Synkroniseret kl. ${formatClock(new Date())}`);
      checkDailyReset();
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
      renderGuestLog();
      populateHosts();
      updatePolicyLink();
      if (showNotice) setStatus(`Opdaterede fra backend kl. ${formatClock(new Date())}`);
      checkDailyReset();
      return;
    }
    if (showNotice) setStatus('Ingen state fundet i backend – viser lokale defaults.', true);
  } catch (error) {
    setStatus(`Kunne ikke hente data: ${error.message}`, true);
  }
}

function handleGuestSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const guest = {
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `guest-${Date.now()}`,
    name: form['vr-guest-name'].value.trim(),
    company: form['vr-guest-company'].value.trim(),
    hostId: form['vr-guest-host'].value,
    purpose: form['vr-guest-purpose'].value.trim(),
    signature: form['vr-guest-signature-data']?.value || '',
    timestamp: new Date().toISOString(),
  };

  if (!guest.name || !guest.hostId) {
    setStatus('Udfyld venligst navn og værtsfelt.', true);
    return;
  }

  if (!form['vr-guest-nda']?.checked) {
    setStatus('Gæsten skal acceptere NDA.', true);
    return;
  }

  state.guests.unshift(guest);
  logEvent({ type: 'guest-checkin', guest });
  notifyHost(guest);
  renderGuestLog();
  form.reset();
  resetSignaturePad();
  setStatus('Gæst registreret.');
  commitState();
}

function renderGuestLog() {
  if (!elements.log) return;
  const todayGuests = state.guests.filter((guest) => isToday(guest.timestamp));
  if (elements.logCount) elements.logCount.textContent = todayGuests.length;

  elements.log.innerHTML = '';
  if (!todayGuests.length) {
    const empty = document.createElement('p');
    empty.className = 'vr-empty';
    empty.textContent = 'Ingen registreringer endnu i dag.';
    elements.log.appendChild(empty);
    return;
  }

  todayGuests.slice(0, 12).forEach((guest) => {
    const host = state.employees.find((emp) => emp.id === guest.hostId);
    const entry = document.createElement('div');
    entry.className = 'entry';
    const time = new Date(guest.timestamp).toLocaleTimeString('da-DK', {
      hour: '2-digit',
      minute: '2-digit',
    });
    entry.innerHTML = `
      <strong>${escapeHtml(guest.name)}${guest.company ? ` · ${escapeHtml(guest.company)}` : ''}</strong>
      <span>${host ? `${escapeHtml(host.firstName)} ${escapeHtml(host.lastName)}` : 'Ukendt vært'}</span>
      <small>${time}${guest.purpose ? ` · ${escapeHtml(guest.purpose)}` : ''}</small>
    `;
    elements.log.appendChild(entry);
  });
}

function populateHosts() {
  const select = elements.host;
  if (!select) return;
  select.innerHTML = '';

  const employees = state.employees.slice().sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'da', { sensitivity: 'base' })
  );

  employees.forEach((employee) => {
    if (employee.status === 'away') return;
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = `${employee.firstName} ${employee.lastName} · ${employee.department}`;
    select.appendChild(option);
  });
}

function initSignaturePad() {
  if (!elements.signature) return;

  signaturePadState.canvas = elements.signature;
  signaturePadState.ctx = signaturePadState.canvas.getContext('2d');

  const canvas = signaturePadState.canvas;
  canvas.addEventListener('pointerdown', startSignatureStroke);
  canvas.addEventListener('pointermove', drawSignatureStroke);
  canvas.addEventListener('pointerup', endSignatureStroke);
  canvas.addEventListener('pointerleave', endSignatureStroke);

  window.addEventListener('resize', resizeSignatureCanvas);
  resizeSignatureCanvas();
  resetSignaturePad();
}

function startSignatureStroke(event) {
  if (!signaturePadState.canvas || !signaturePadState.ctx) return;
  event.preventDefault();
  const { x, y } = getCanvasCoordinates(event);
  signaturePadState.isDrawing = true;
  signaturePadState.ctx.beginPath();
  signaturePadState.ctx.moveTo(x, y);
}

function drawSignatureStroke(event) {
  if (!signaturePadState.isDrawing || !signaturePadState.ctx) return;
  event.preventDefault();
  const { x, y } = getCanvasCoordinates(event);
  signaturePadState.ctx.lineTo(x, y);
  signaturePadState.ctx.stroke();
  signaturePadState.hasSignature = true;
}

function endSignatureStroke(event) {
  if (!signaturePadState.isDrawing) return;
  event.preventDefault();
  signaturePadState.isDrawing = false;
  updateSignatureValue();
}

function getCanvasCoordinates(event) {
  const rect = signaturePadState.canvas.getBoundingClientRect();
  const point = event.changedTouches ? event.changedTouches[0] : event;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function resizeSignatureCanvas() {
  if (!signaturePadState.canvas || !signaturePadState.ctx) return;

  const parentWidth = signaturePadState.canvas.parentElement?.clientWidth || 0;
  signaturePadState.canvas.width = parentWidth || 440;
  signaturePadState.canvas.height = 140;
  signaturePadState.ctx.lineWidth = 2.5;
  signaturePadState.ctx.lineCap = 'round';
  signaturePadState.ctx.lineJoin = 'round';
  signaturePadState.ctx.strokeStyle = '#e2e8f0';

  if (signaturePadState.hasSignature) {
    updateSignatureValue();
  }
}

function updateSignatureValue() {
  if (!elements.signatureData || !signaturePadState.canvas) return;
  elements.signatureData.value = signaturePadState.hasSignature
    ? signaturePadState.canvas.toDataURL('image/png')
    : '';
  updateSignatureStatus();
}

function updateSignatureStatus() {
  if (!elements.signatureStatus) return;
  elements.signatureStatus.textContent = signaturePadState.hasSignature
    ? 'Underskrift registreret.'
    : 'Ingen underskrift endnu.';
}

function resetSignaturePad() {
  if (!signaturePadState.canvas || !signaturePadState.ctx) return;
  signaturePadState.ctx.clearRect(
    0,
    0,
    signaturePadState.canvas.width,
    signaturePadState.canvas.height
  );
  signaturePadState.hasSignature = false;
  signaturePadState.isDrawing = false;
  updateSignatureValue();
}

function updatePolicyLink() {
  if (!elements.ndaLink) return;
  const link = elements.ndaLink;
  link.href = state.policyLinks?.nda || '#';
  link.textContent = state.policyLinks?.nda ? 'SUBRAs NDA' : 'NDA-link mangler';
}

function notifyHost(guest) {
  const host = state.employees.find((emp) => emp.id === guest.hostId);
  const message = host
    ? `SMS til ${host.firstName} ${host.lastName}: ${guest.name} er ankommet og venter i receptionen.`
    : `Gæst ${guest.name} registreret.`;
  setStatus(message);
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

function checkDailyReset(now = new Date()) {
  const resetPerformed = performDailyReset(now);
  scheduleNextDailyReset(now);
  if (resetPerformed) {
    renderGuestLog();
    populateHosts();
    void commitState();
  }
}

function scheduleNextDailyReset(now = new Date()) {
  if (dailyResetTimer) {
    window.clearTimeout(dailyResetTimer);
    dailyResetTimer = null;
  }

  const nextReset = new Date(now);
  nextReset.setHours(DAILY_RESET_HOUR, 0, 0, 0);
  if (nextReset <= now) {
    nextReset.setDate(nextReset.getDate() + 1);
  }

  const delay = Math.max(nextReset.getTime() - now.getTime(), 1000);
  dailyResetTimer = window.setTimeout(() => checkDailyReset(), delay);
}

function performDailyReset(now = new Date()) {
  const lastReset = state.lastResetAt ? new Date(state.lastResetAt) : null;
  const threshold = calculateResetThreshold(now);

  if (lastReset && lastReset >= threshold) {
    return false;
  }

  let changed = false;
  const timestamp = now.toISOString();

  state.employees = state.employees.map((employee) => {
    if (employee.status === 'away') return employee;
    if (!employee.status || employee.status === 'unknown') {
      return {
        ...employee,
        status: 'unknown',
        statusNotes: '',
        absence: undefined,
        lastStatusChange: timestamp,
      };
    }
    changed = true;
    return {
      ...employee,
      status: 'unknown',
      statusNotes: '',
      absence: undefined,
      lastStatusChange: timestamp,
    };
  });

  if (changed || !state.lastResetAt) {
    state.lastResetAt = timestamp;
    logEvent({ type: 'daily-reset', timestamp });
  }

  return changed;
}

function calculateResetThreshold(reference = new Date()) {
  const todayNoon = new Date(reference);
  todayNoon.setHours(DAILY_RESET_HOUR, 0, 0, 0);
  if (reference >= todayNoon) {
    return todayNoon;
  }
  const yesterdayNoon = new Date(todayNoon);
  yesterdayNoon.setDate(yesterdayNoon.getDate() - 1);
  return yesterdayNoon;
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
    lastResetAt: data.lastResetAt || null,
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

function isToday(timestamp) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
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

function formatClock(date) {
  return date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function setStatus(message, isError = false) {
  if (!elements.statusText) return;
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? '#fca5a5' : 'var(--muted)';
}
