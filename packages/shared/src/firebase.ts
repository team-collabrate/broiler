import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// firebase/auth lists a generic "types" entry ahead of its "react-native" condition, so
// TypeScript only ever sees the web typings, which omit this React Native export. Metro
// still bundles the React Native build, so declare the missing function here.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

/** Safe to call more than once (Fast Refresh re-runs module code). */
export function initFirebase(config: FirebaseOptions): FirebaseServices {
  if (services) return services;

  const app = getApps().length ? getApp() : initializeApp(config);

  services = { app, auth: initAuth(app), db: getFirestore(app) };
  return services;
}

function initAuth(app: FirebaseApp): Auth {
  // The browser build of firebase/auth has no React Native persistence and keeps the
  // session in the browser's own storage, so a plain getAuth is right for `expo start --web`.
  if (Platform.OS === 'web') return getAuth(app);

  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/already-initialized') throw e;
    return getAuth(app);
  }
}

export function getServices(): FirebaseServices {
  if (!services) throw new Error('initFirebase() must be called before using Firebase services');
  return services;
}

