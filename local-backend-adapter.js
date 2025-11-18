(function initSubraLocalBackend(global) {
  const adapter = {
    config: {
      baseUrl: '',
      enableRealtime: false,
    },
    initialized: false,
    currentUser: null,
    listeners: [],
    configure(options = {}) {
      this.config = { ...this.config, ...options };
      return this.config;
    },
    get baseOrigin() {
      if (this.config.baseUrl) return this.config.baseUrl;
      if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
      }
      return '';
    },
    buildUrl(path = '/') {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const base = this.baseOrigin;
      if (!base) return normalizedPath;
      return new URL(normalizedPath, base).toString();
    },
    init(options = {}) {
      this.configure(options);
      this.initialized = true;
      void this.refreshSession();
      return this;
    },
    isReady() {
      return this.initialized;
    },
    get baseUrl() {
      return this.config.baseUrl || '';
    },
    addListener(callback) {
      if (typeof callback !== 'function') return () => {};
      this.listeners.push(callback);
      return () => {
        this.listeners = this.listeners.filter((fn) => fn !== callback);
      };
    },
    emitAuthState(user) {
      this.listeners.forEach((fn) => {
        try {
          fn(user);
        } catch (error) {
          console.error('[SubraLocal] auth listener fejlede', error);
        }
      });
    },
    async refreshSession() {
      try {
        const res = await fetch(this.buildUrl('/api/auth/session'), {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) {
          this.currentUser = null;
          this.emitAuthState(null);
          return null;
        }
        const payload = await res.json();
        if (payload?.ok && payload.admin) {
          this.currentUser = payload.admin;
          this.emitAuthState(this.currentUser);
          return this.currentUser;
        }
      } catch (error) {
        console.warn('[SubraLocal] kunne ikke hente session', error);
      }
      this.currentUser = null;
      this.emitAuthState(null);
      return null;
    },
    onAuthStateChanged(callback) {
      const unsubscribe = this.addListener(callback);
      void this.refreshSession();
      return unsubscribe;
    },
    async signInWithPassword(email, password) {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'unknown_error' }));
        const error = new Error(payload.error || 'login_failed');
        error.code = payload.error || 'login_failed';
        throw error;
      }
      const payload = await res.json();
      this.currentUser = payload.admin || null;
      this.emitAuthState(this.currentUser);
      return this.currentUser;
    },
    async signOut() {
      await fetch(this.buildUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      this.currentUser = null;
      this.emitAuthState(null);
    },
    async fetchState() {
      const res = await fetch(this.buildUrl('/api/state'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Kunne ikke hente state');
      }
      const payload = await res.json();
      return payload.state;
    },
    async saveState(state) {
      const res = await fetch(this.buildUrl('/api/state'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'unknown_error' }));
        const error = new Error(payload.error || 'unknown_error');
        error.code = payload.error || 'unknown_error';
        throw error;
      }
      const payload = await res.json();
      return payload.state;
    },
    async uploadSlide(file, onProgress) {
      const dataUrl = await this.fileToDataUrl(file);
      if (typeof onProgress === 'function') {
        onProgress({ bytesTransferred: file.size, totalBytes: file.size });
      }
      const res = await fetch(this.buildUrl('/api/slides/upload'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) {
        throw new Error('upload_failed');
      }
      const payload = await res.json();
      return { downloadURL: payload.imageUrl, storagePath: payload.storagePath };
    },
    async deleteSlide(storagePath) {
      if (!storagePath) return;
      await fetch(this.buildUrl('/api/slides/remove'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });
    },
    async fileToDataUrl(file) {
      if (typeof window === 'undefined' || !window.FileReader) {
        throw new Error('Filupload understøttes ikke i dette miljø');
      }
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('file_read_error'));
        reader.readAsDataURL(file);
      });
    },
    async ensureKioskAuth() {
      // Ikke nødvendig for lokal backend men behold signaturen
      return this.currentUser;
    },
    subscribeToState(callback) {
      let cancelled = false;
      const poll = async () => {
        if (cancelled) return;
        try {
          const state = await this.fetchState();
          callback(state);
        } catch (error) {
          console.error('[SubraLocal] polling fejlede', error);
          callback(null, null, error);
        }
        if (!cancelled && this.config.enableRealtime !== false) {
          setTimeout(poll, 5000);
        }
      };
      poll();
      return () => {
        cancelled = true;
      };
    },
  };

  global.SubraLocalBackend = adapter;
})(window);
