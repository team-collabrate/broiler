import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Filled from each app's .env (VITE_FIREBASE_*). See worker-app/.env.example
// and owner-app/.env.example — copy to .env and fill in real project keys.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export interface InitFirebaseOptions {
  /**
   * Enable IndexedDB offline persistence (multi-tab aware). Per TDD §4,
   * the Worker app needs this; the Owner app is read-mostly so it can skip it.
   */
  offlinePersistence: boolean;
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

/** Idempotent — safe to call once at app startup (main.tsx). */
export function initFirebase(options: InitFirebaseOptions): {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
} {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  if (!db) {
    db = initializeFirestore(app, {
      localCache: options.offlinePersistence
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return { app, db, auth };
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) throw new Error("initFirebase() must be called before getFirebaseApp()");
  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) throw new Error("initFirebase() must be called before getFirestoreDb()");
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("initFirebase() must be called before getFirebaseAuth()");
  return auth;
}
