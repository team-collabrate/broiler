import { initFirebase } from '@broiler/shared';
import { t } from './strings';

/**
 * Connects to Firebase. Signing in is separate: the PIN screen (see useSession) does it. Called from the app's boot step rather than at
 * import time: Firebase Auth throws on an empty API key, which would crash the app
 * before it could explain that `.env` is missing.
 */
export function startFirebase(): void {
  // Expo only inlines literal `process.env.EXPO_PUBLIC_*` reads, so each is spelled out.
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error(t.firebaseNotConfigured);
  }

  initFirebase(config);
}
