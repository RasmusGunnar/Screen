(function initSubraFirebase(global) {
  const defaultConfig = {
    stateCollection: 'kiosks',
    stateDocId: 'default',
    storageFolder: 'screensaver/default',
    enableRealtime: true,
  };

  const adapter = {
    app: null,
    auth: null,
    db: null,
    storage: null,
    initialized: false,
    config: { ...defaultConfig },

    configure(options = {}) {
      this.config = {
        ...this.config,
        ...options,
      };
      if (!this.config.storageFolder) {
        this.config.storageFolder = `screensaver/${this.config.stateDocId}`;
      }
      return this.config;
    },

    init(options = {}) {
      this.configure(options);
      if (this.initialized) {
        return this;
      }

      if (!global.firebase) {
        console.warn('[SubraFirebase] Firebase SDK er ikke indlæst.');
        return null;
      }

      if (!global.SUBRA_FIREBASE_CONFIG) {
        console.warn('[SubraFirebase] window.SUBRA_FIREBASE_CONFIG er ikke sat.');
        return null;
      }

      if (firebase.apps && firebase.apps.length) {
        this.app = firebase.app();
      } else {
        this.app = firebase.initializeApp(global.SUBRA_FIREBASE_CONFIG);
      }

      this.auth = firebase.auth();
      this.db = firebase.firestore();
      if (this.db?.settings) {
        this.db.settings({ ignoreUndefinedProperties: true });
      }
      this.storage = firebase.storage ? firebase.storage() : null;
      this.initialized = true;
      return this;
    },

    isReady() {
      return this.initialized && !!this.db;
    },

    getStateDocRef() {
      if (!this.isReady()) {
        throw new Error('Firebase er ikke initialiseret');
      }
      return this.db.collection(this.config.stateCollection).doc(this.config.stateDocId);
    },

    async fetchState() {
      const snapshot = await this.getStateDocRef().get();
      if (snapshot.exists) {
        return snapshot.data();
      }
      return null;
    },

    subscribeToState(callback) {
      const docRef = this.getStateDocRef();
      return docRef.onSnapshot(
        (snapshot) => {
          callback(snapshot.exists ? snapshot.data() : null, snapshot);
        },
        (error) => {
          console.error('[SubraFirebase] Realtidslytning fejlede', error);
          callback(null, null, error);
        }
      );
    },

    async saveState(data = {}) {
      if (!data || typeof data !== 'object') {
        throw new Error('State skal være et objekt');
      }
      const now = new Date().toISOString();
      const payload = {
        ...data,
        updatedAt: now,
        settings: {
          ...data.settings,
          kiosk: {
            ...(data.settings?.kiosk || {}),
            lastSynced: now,
          },
        },
      };
      await this.getStateDocRef().set(payload, { merge: false });
      return payload;
    },

    async ensureKioskAuth(mode = 'anonymous') {
      if (!this.auth) {
        return null;
      }
      if (this.auth.currentUser) {
        return this.auth.currentUser;
      }
      if (mode === 'anonymous') {
        try {
          const cred = await this.auth.signInAnonymously();
          return cred.user;
        } catch (error) {
          console.error('[SubraFirebase] Kunne ikke logge anonymt ind', error);
          throw error;
        }
      }
      return null;
    },

    async signInWithPassword(email, password) {
      if (!this.auth) {
        throw new Error('Firebase Auth er ikke tilgængelig');
      }
      await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credentials = await this.auth.signInWithEmailAndPassword(email, password);
      return credentials.user;
    },

    async signOut() {
      if (!this.auth) {
        return;
      }
      await this.auth.signOut();
    },

    onAuthStateChanged(callback) {
      if (!this.auth) {
        return () => {};
      }
      return this.auth.onAuthStateChanged(callback);
    },

    async uploadSlide(file, onProgress) {
      if (!this.storage) {
        throw new Error('Firebase Storage er ikke tilgængelig');
      }
      const safeName = `${Date.now()}-${(file.name || 'slide').replace(/[^a-zA-Z0-9_.-]+/g, '-')}`;
      const path = `${this.config.storageFolder}/${safeName}`;
      const ref = this.storage.ref().child(path);
      const task = ref.put(file);

      return await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            if (typeof onProgress === 'function') {
              onProgress(snapshot);
            }
          },
          (error) => reject(error),
          async () => {
            const downloadURL = await task.snapshot.ref.getDownloadURL();
            resolve({ downloadURL, storagePath: path });
          }
        );
      });
    },

    async deleteSlide(storagePath) {
      if (!storagePath || !this.storage) {
        return;
      }
      try {
        await this.storage.ref().child(storagePath).delete();
      } catch (error) {
        if (error?.code === 'storage/object-not-found') {
          console.warn('[SubraFirebase] Filen fandtes ikke i Storage', storagePath);
          return;
        }
        throw error;
      }
    },
  };

  global.SubraFirebase = adapter;
})(window);
