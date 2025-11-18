import { createServer } from 'node:http';
import { readFile, writeFile, access, mkdir, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const STATE_PATH = join(ROOT, 'data', 'state.json');
const SEED_STATE_PATH = join(ROOT, 'data', 'seed-state.json');
const ADMINS_PATH = join(ROOT, 'data', 'admins.json');
const UPLOAD_DIR = join(ROOT, 'uploads', 'slides');

const KIOSK_SERVICE_TOKEN = process.env.KIOSK_SERVICE_TOKEN || 'local-kiosk-token';
const SESSION_COOKIE = 'subra_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dage

const sessions = new Map();
let adminCache = null;

async function ensureFile(path, fallbackPath) {
  try {
    await access(path);
  } catch (error) {
    if (!fallbackPath) {
      await writeFile(path, JSON.stringify({}, null, 2), 'utf8');
      return;
    }

    const seed = JSON.parse(await readFile(fallbackPath, 'utf8'));
    const seeded = ensureStateDefaults(seed);
    await writeFile(path, JSON.stringify(seeded, null, 2), 'utf8');
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStateDefaults(input = {}) {
  const now = new Date().toISOString();
  const raw = clone(input || {});
  const state = {
    employees: [],
    guests: [],
    logs: [],
    visitors: { timeline: [], remembered: [], preregistrations: [] },
    deliveries: [],
    spaces: { bookings: [], resources: [] },
    evacuation: { lastRefreshed: now, roster: [] },
    screensaver: { slides: [] },
    qrLinks: { employee: '', guest: '' },
    policyLinks: { nda: '' },
    settings: { kiosk: { id: 'local', lastSynced: now } },
    updatedAt: now,
  };

  if (Array.isArray(raw.employees)) {
    state.employees = raw.employees.map((employee, index) => {
      const id = employee.id || `emp-${index}-${randomUUID()}`;
      const status = ['onsite', 'remote', 'away', 'unknown'].includes(employee.status)
        ? employee.status
        : 'unknown';
      const normalized = {
        id,
        firstName: (employee.firstName || '').toString().trim() || 'Ukendt',
        lastName: (employee.lastName || '').toString().trim() || 'Person',
        role: (employee.role || '').toString().trim(),
        department: (employee.department || '').toString().trim() || 'Ukendt afdeling',
        contact: (employee.contact || '').toString().trim(),
        photo: (employee.photo || '').toString().trim(),
        status,
        statusNotes: (employee.statusNotes || '').toString(),
        lastStatusChange: employee.lastStatusChange || now,
      };

      if (status === 'away' && employee.absence) {
        normalized.absence = {
          from: employee.absence.from || null,
          to: employee.absence.to || null,
        };
      }

      return normalized;
    });
  }

  if (Array.isArray(raw.guests)) {
    state.guests = raw.guests
      .map((guest) => ({
        id: guest.id || randomUUID(),
        name: (guest.name || '').toString().trim(),
        company: (guest.company || '').toString().trim(),
        hostId: guest.hostId || null,
        purpose: (guest.purpose || '').toString().trim(),
        timestamp: guest.timestamp || now,
      }))
      .filter((guest) => guest.name && guest.hostId);
  }

  if (Array.isArray(raw.logs)) {
    state.logs = raw.logs
      .map((entry) => ({
        ...entry,
        id: entry.id || randomUUID(),
        timestamp: entry.timestamp || now,
      }))
      .slice(0, 500);
  }

  if (raw.visitors) {
    const timeline = Array.isArray(raw.visitors.timeline) ? raw.visitors.timeline : [];
    const remembered = Array.isArray(raw.visitors.remembered) ? raw.visitors.remembered : [];
    const preregistrations = Array.isArray(raw.visitors.preregistrations)
      ? raw.visitors.preregistrations
      : [];

    state.visitors = {
      timeline: timeline.map((entry, index) => ({
        id: entry.id || `visit-${index}-${randomUUID()}`,
        name: (entry.name || '').toString().trim(),
        company: (entry.company || '').toString().trim(),
        hostName: (entry.hostName || '').toString().trim(),
        category: (entry.category || '').toString().trim(),
        signedInAt: entry.signedInAt || entry.timestamp || null,
        signedOutAt: entry.signedOutAt || null,
        status: entry.status || 'pending',
      })),
      remembered: remembered.map((person, index) => ({
        id: person.id || `remembered-${index}-${randomUUID()}`,
        name: (person.name || '').toString().trim(),
        company: (person.company || '').toString().trim(),
        hostName: (person.hostName || '').toString().trim(),
        email: (person.email || '').toString().trim(),
      })),
      preregistrations: preregistrations.map((entry, index) => ({
        id: entry.id || `pre-${index}-${randomUUID()}`,
        name: (entry.name || '').toString().trim(),
        company: (entry.company || '').toString().trim(),
        hostName: (entry.hostName || '').toString().trim(),
        arrivalDate: entry.arrivalDate || null,
        status: entry.status || 'invited',
      })),
    };
  }

  if (Array.isArray(raw.deliveries)) {
    state.deliveries = raw.deliveries.map((delivery, index) => ({
      id: delivery.id || `delivery-${index}-${randomUUID()}`,
      courier: (delivery.courier || '').toString().trim(),
      contact: (delivery.contact || '').toString().trim(),
      recipient: (delivery.recipient || '').toString().trim(),
      status: delivery.status || 'awaiting-pickup',
      receivedAt: delivery.receivedAt || now,
      type: (delivery.type || '').toString().trim(),
    }));
  }

  if (raw.spaces) {
    const bookings = Array.isArray(raw.spaces.bookings) ? raw.spaces.bookings : [];
    const resources = Array.isArray(raw.spaces.resources) ? raw.spaces.resources : [];

    state.spaces = {
      bookings: bookings.map((booking, index) => ({
        id: booking.id || `booking-${index}-${randomUUID()}`,
        resourceId: booking.resourceId || null,
        title: (booking.title || '').toString().trim(),
        start: booking.start || null,
        end: booking.end || null,
        organizer: (booking.organizer || '').toString().trim(),
        status: booking.status || 'tentative',
      })),
      resources: resources.map((resource, index) => ({
        id: resource.id || `resource-${index}-${randomUUID()}`,
        name: (resource.name || '').toString().trim(),
        location: (resource.location || '').toString().trim(),
        capacity: Number.isFinite(resource.capacity) ? resource.capacity : null,
        type: (resource.type || '').toString().trim(),
      })),
    };
  }

  if (raw.evacuation) {
    state.evacuation = {
      lastRefreshed: raw.evacuation.lastRefreshed || now,
      roster: Array.isArray(raw.evacuation.roster)
        ? raw.evacuation.roster.map((entry, index) => ({
            id: entry.id || `evac-${index}-${randomUUID()}`,
            name: (entry.name || '').toString().trim(),
            status: entry.status || 'unknown',
            contact: (entry.contact || '').toString().trim(),
          }))
        : [],
    };
  }

  if (raw.screensaver && Array.isArray(raw.screensaver.slides)) {
    state.screensaver.slides = raw.screensaver.slides.map((slide, index) => ({
      id: slide.id || `slide-${index}-${randomUUID()}`,
      theme: slide.theme || 'fjord',
      headline: (slide.headline || '').toString().trim(),
      description: (slide.description || '').toString().trim(),
      image: (slide.image || '').toString().trim(),
      order: Number.isFinite(slide.order) ? slide.order : index,
      storagePath: slide.storagePath || null,
      createdAt: slide.createdAt || now,
      updatedAt: slide.updatedAt || now,
    }));
  }

  if (raw.qrLinks) {
    state.qrLinks.employee = (raw.qrLinks.employee || '').toString().trim();
    state.qrLinks.guest = (raw.qrLinks.guest || '').toString().trim();
  }

  if (raw.policyLinks) {
    state.policyLinks.nda = (raw.policyLinks.nda || '').toString().trim();
  }

  if (raw.settings?.kiosk) {
    state.settings.kiosk.id = raw.settings.kiosk.id || state.settings.kiosk.id;
    state.settings.kiosk.lastSynced = raw.settings.kiosk.lastSynced || now;
  }

  state.updatedAt = raw.updatedAt || now;
  return state;
}

async function loadState() {
  await ensureFile(STATE_PATH, SEED_STATE_PATH);
  const file = await readFile(STATE_PATH, 'utf8');
  return ensureStateDefaults(JSON.parse(file || '{}'));
}

async function saveState(nextState) {
  const normalized = ensureStateDefaults(nextState);
  normalized.updatedAt = new Date().toISOString();
  normalized.settings.kiosk.lastSynced = normalized.updatedAt;
  await writeFile(STATE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function loadAdmins() {
  if (adminCache) return adminCache;
  const raw = await readFile(ADMINS_PATH, 'utf8');
  adminCache = JSON.parse(raw);
  return adminCache;
}

function hashPassword(password, salt) {
  return createHash('sha256').update(`${password}${salt}`).digest('hex');
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (!key || typeof value === 'undefined') return;
    cookies[key.trim()] = decodeURIComponent(value.trim());
  });
  return cookies;
}

function buildCorsHeaders(req) {
  const origin = req.headers?.origin;
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function notFound(res, headers = {}) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end('Not found');
}

function forbidden(res, headers = {}) {
  res.writeHead(403, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
}

function methodNotAllowed(res, headers = {}) {
  res.writeHead(405, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('invalid_json');
  }
}

async function ensureUploadsDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function mimeTypeFor(pathname) {
  const ext = extname(pathname).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const filePath = resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT)) {
    forbidden(res);
    return;
  }

  try {
    const stream = createReadStream(filePath);
    stream.on('error', () => notFound(res));
    res.writeHead(200, { 'Content-Type': mimeTypeFor(filePath) });
    stream.pipe(res);
  } catch (error) {
    notFound(res);
  }
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireWriteAccess(req, res) {
  const session = getSession(req);
  if (session) {
    return { allowed: true, session };
  }

  const token = req.headers['x-service-token'];
  if (token && token === KIOSK_SERVICE_TOKEN) {
    return { allowed: true, session: null };
  }

  return { allowed: false };
}

function sanitizeAdmin(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role || 'editor',
  };
}

function extForMime(mime) {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

async function handleSlideUpload(body) {
  if (!body?.dataUrl) {
    throw new Error('missing_data_url');
  }

  await ensureUploadsDir();

  const match = /^data:(.+);base64,(.+)$/i.exec(body.dataUrl);
  if (!match) {
    throw new Error('invalid_data_url');
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const id = body.id || `slide-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const filename = `${id}.${extForMime(mime)}`;
  const filePath = join(UPLOAD_DIR, filename);
  await writeFile(filePath, buffer);

  if (body.previousPath) {
    const previous = body.previousPath.replace(/^\//, '');
    const previousPath = join(ROOT, previous);
    if (previousPath.startsWith(join(ROOT, 'uploads'))) {
      try {
        await unlink(previousPath);
      } catch (_) {
        // ignore
      }
    }
  }

  return {
    id,
    imageUrl: `/uploads/slides/${filename}`,
    storagePath: `uploads/slides/${filename}`,
  };
}

async function handleSlideRemove(body) {
  if (!body?.storagePath) {
    throw new Error('missing_storage_path');
  }

  const relative = body.storagePath.replace(/^\/+/, '');
  const filePath = join(ROOT, relative);
  const uploadsRoot = join(ROOT, 'uploads');
  if (!filePath.startsWith(uploadsRoot)) {
    throw new Error('invalid_path');
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Service-Token',
      });
      res.end();
      return;
    }

    try {
      if (url.pathname === '/api/state') {
        if (req.method === 'GET') {
          const state = await loadState();
          sendJson(res, 200, { ok: true, state }, corsHeaders);
          return;
        }

        if (req.method === 'PUT') {
          const access = requireWriteAccess(req, res);
          if (!access.allowed) {
            sendJson(res, 401, { ok: false, error: 'unauthorized' }, corsHeaders);
            return;
          }

          const body = await readJsonBody(req);
          if (!body || typeof body !== 'object' || !body.state) {
            sendJson(res, 400, { ok: false, error: 'invalid_body' }, corsHeaders);
            return;
          }

          const saved = await saveState(body.state);
          sendJson(res, 200, { ok: true, state: saved }, corsHeaders);
          return;
        }

        methodNotAllowed(res, corsHeaders);
        return;
      }

      if (url.pathname === '/api/auth/login') {
        if (req.method !== 'POST') {
          methodNotAllowed(res, corsHeaders);
          return;
        }

        const body = await readJsonBody(req);
        const email = (body.email || '').toString().toLowerCase();
        const password = (body.password || '').toString();

        if (!email || !password) {
          sendJson(res, 400, { ok: false, error: 'missing_credentials' }, corsHeaders);
          return;
        }

        const admins = await loadAdmins();
        const admin = admins.find((item) => item.email.toLowerCase() === email);
        if (!admin) {
          sendJson(res, 401, { ok: false, error: 'invalid_credentials' }, corsHeaders);
          return;
        }

        const hash = hashPassword(password, admin.salt);
        if (hash !== admin.passwordHash) {
          sendJson(res, 401, { ok: false, error: 'invalid_credentials' }, corsHeaders);
          return;
        }

        const token = randomUUID();
        sessions.set(token, { ...sanitizeAdmin(admin), createdAt: Date.now() });
        const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(
          SESSION_MAX_AGE / 1000
        )}`;
        sendJson(
          res,
          200,
          { ok: true, admin: sanitizeAdmin(admin) },
          { ...corsHeaders, 'Set-Cookie': cookie }
        );
        return;
      }

      if (url.pathname === '/api/auth/logout') {
        if (req.method !== 'POST') {
          methodNotAllowed(res, corsHeaders);
          return;
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const token = cookies[SESSION_COOKIE];
        if (token) {
          sessions.delete(token);
        }

        sendJson(
          res,
          200,
          { ok: true },
          {
            ...corsHeaders,
            'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
          }
        );
        return;
      }

      if (url.pathname === '/api/auth/session') {
        if (req.method !== 'GET') {
          methodNotAllowed(res, corsHeaders);
          return;
        }

        const session = getSession(req);
        if (!session) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' }, corsHeaders);
          return;
        }

        sendJson(res, 200, { ok: true, admin: sanitizeAdmin(session) }, corsHeaders);
        return;
      }

      if (url.pathname === '/api/slides/upload') {
        const access = requireWriteAccess(req, res);
        if (!access.allowed) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' }, corsHeaders);
          return;
        }

        if (req.method !== 'POST') {
          methodNotAllowed(res, corsHeaders);
          return;
        }

        const body = await readJsonBody(req);
        const result = await handleSlideUpload(body);
        sendJson(res, 200, { ok: true, ...result }, corsHeaders);
        return;
      }

      if (url.pathname === '/api/slides/remove') {
        const access = requireWriteAccess(req, res);
        if (!access.allowed) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' }, corsHeaders);
          return;
        }

        if (req.method !== 'POST') {
          methodNotAllowed(res, corsHeaders);
          return;
        }

        const body = await readJsonBody(req);
        try {
          await handleSlideRemove(body);
          sendJson(res, 200, { ok: true }, corsHeaders);
        } catch (error) {
          console.warn('Kunne ikke fjerne slide-asset', error);
          sendJson(res, 400, { ok: false, error: error.message || 'unknown_error' }, corsHeaders);
        }
        return;
      }

      notFound(res, corsHeaders);
    } catch (error) {
      console.error('API error', error);
      if (error.message === 'invalid_json') {
        sendJson(res, 400, { ok: false, error: 'invalid_json' }, corsHeaders);
        return;
      }
      sendJson(res, 500, { ok: false, error: 'internal_error' }, corsHeaders);
    }
    return;
  }

  // Serve static assets and uploaded files
  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    await serveStatic(req, res, url);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    methodNotAllowed(res);
    return;
  }

  await serveStatic(req, res, url);
}

async function bootstrap() {
  await ensureFile(STATE_PATH, SEED_STATE_PATH);
  await ensureUploadsDir();
  await loadState();
  await loadAdmins();

  const server = createServer(requestHandler);
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`SUBRA kioskserver kører på http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Kunne ikke starte serveren', error);
  process.exit(1);
});
