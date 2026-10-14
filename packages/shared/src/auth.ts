import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getServices } from './firebase';
import { isValidPin, pinPassword, roleOfEmail, ROLE_EMAILS, type Role } from './roles';

export async function signInWithPin(role: Role, pin: string): Promise<void> {
  if (!isValidPin(pin)) throw Object.assign(new Error('pin format'), { code: 'app/invalid-pin' });
  const { auth } = getServices();
  await signInWithEmailAndPassword(auth, ROLE_EMAILS[role], pinPassword(pin));
}

export async function signOutNow(): Promise<void> {
  const { auth } = getServices();
  await firebaseSignOut(auth);
}

/** Dev only: signs in anonymously so screens can be checked before accounts exist. Never runs in a production build. */
export async function signInForDevelopment(): Promise<void> {
  const { auth } = getServices();
  await signInAnonymously(auth);
}

/** Calls back with the signed-in role (null when signed out, or signed in as an unknown account). */
export function subscribeRole(onChange: (role: Role | null, signedIn: boolean) => void): () => void {
  const { auth } = getServices();
  return onAuthStateChanged(auth, (user) => onChange(user ? roleOfEmail(user.email) : null, user !== null));
}

// --- Inactivity lock -------------------------------------------------------------------

/** Signed in but idle for this long: the next launch asks for the PIN again. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

const ACTIVE_KEY = 'broiler.lastActiveAt';

export async function recordActivity(now: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, String(now));
  } catch {
    // Storage unavailable: the in-memory idle timer still works for this launch.
  }
}

/** True when the last recorded activity is older than the idle limit. A missing record counts as fresh. */
export async function hasBeenIdleTooLong(now: number = Date.now()): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    const last = raw === null ? NaN : Number(raw);
    return Number.isFinite(last) && now - last > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}
