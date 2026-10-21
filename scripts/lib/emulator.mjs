// Lets the client-SDK scripts (seed, checks) talk to the local emulators instead of the live project:
// run them with USE_EMULATOR=1. The project id is forced to the emulator's, so nothing can reach a real project.
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

export const usingEmulator = process.env.USE_EMULATOR === '1';
export const EMULATOR_PROJECT = 'demo-broiler';

/** The Firebase config to use: the real one, or a throwaway one for the emulator. */
export function withEmulatorConfig(config) {
  return usingEmulator ? { ...config, projectId: EMULATOR_PROJECT, apiKey: config.apiKey ?? 'demo-key' } : config;
}

/** Points an already-created Auth and Firestore at the emulators when USE_EMULATOR=1; does nothing otherwise. */
export function connectEmulators(auth, db) {
  if (!usingEmulator) return;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  if (db) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log(`(using the local emulators, project ${EMULATOR_PROJECT}: nothing here touches the live project)`);
}
