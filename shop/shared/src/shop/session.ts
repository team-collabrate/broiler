import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { isValidPin, pinPassword, roleOfEmail, ROLE_EMAILS, type Role } from "../core";
import { getFirebaseAuth } from "../firebase";

export type SessionState = { status: "loading" } | { status: "out" } | { status: "in"; role: Role };

/** Signed in but idle for this long: the next launch asks for the PIN again. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVE_KEY = "broiler.lastActiveAt";
/** Record activity to storage at most this often; taps arrive far faster than that. */
const RECORD_EVERY_MS = 10_000;

function recordActivity(now = Date.now()): void {
  try {
    localStorage.setItem(ACTIVE_KEY, String(now));
  } catch {
    /* storage unavailable: the in-memory idle timer still works for this launch */
  }
}

function hasBeenIdleTooLong(now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    const last = raw === null ? NaN : Number(raw);
    return Number.isFinite(last) && now - last > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

/** Signs in with a role's account; the PIN is its password. Rejects on a wrong PIN. */
export async function signInWithPin(role: Role, pin: string): Promise<void> {
  if (!isValidPin(pin)) throw Object.assign(new Error("pin format"), { code: "app/invalid-pin" });
  await signInWithEmailAndPassword(getFirebaseAuth(), ROLE_EMAILS[role], pinPassword(pin));
}

/**
 * The counter's sign-in: a PIN that fits the counter account signs in as the counter, one that fits the owner
 * account signs in as the owner (the owner may work the till). Resolves with the role that accepted it.
 */
export async function signInCounterOrOwner(pin: string): Promise<Role> {
  try {
    await signInWithPin("counter", pin);
    return "counter";
  } catch (counterError) {
    const code = (counterError as { code?: string }).code;
    if (code !== "auth/invalid-credential" && code !== "auth/wrong-password" && code !== "auth/user-not-found") throw counterError;
    await signInWithPin("owner", pin);
    return "owner";
  }
}

export function signOutNow(): Promise<void> {
  return firebaseSignOut(getFirebaseAuth());
}

interface Options {
  /** Dev only: sign in anonymously at start so screens can be checked before accounts exist. Never set in a production build. */
  developmentSignIn?: boolean;
}

/**
 * The signed-in role and the actions that change it. Locks itself (signs out) after 30 minutes without a touch,
 * including across a reload. Call `touch()` on every touch.
 */
export function useShopSession({ developmentSignIn = false }: Options = {}) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const lastRecorded = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const roleRef = useRef<Role | null>(null);

  const armIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => void signOutNow(), IDLE_LIMIT_MS);
  }, []);

  useEffect(() => {
    let alive = true;
    let triedDev = false;
    const stop = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!alive) return;
      const role = user ? roleOfEmail(user.email) : null;
      if (user && role === null) {
        // Not the owner or the counter (an anonymous dev session, or someone who signed up with the public key).
        if (developmentSignIn) {
          roleRef.current = "counter";
          setSession({ status: "in", role: "counter" });
          return;
        }
        await signOutNow();
        return;
      }
      if (role !== null && hasBeenIdleTooLong()) {
        await signOutNow();
        return;
      }
      roleRef.current = role;
      if (role === null) {
        if (developmentSignIn && !triedDev) {
          triedDev = true;
          await signInAnonymously(getFirebaseAuth()).catch(() => undefined);
          return;
        }
        clearTimeout(idleTimer.current);
        setSession({ status: "out" });
        return;
      }
      recordActivity();
      armIdleTimer();
      setSession({ status: "in", role });
    });
    return () => {
      alive = false;
      clearTimeout(idleTimer.current);
      stop();
    };
  }, [armIdleTimer, developmentSignIn]);

  const touch = useCallback(() => {
    if (roleRef.current === null) return;
    armIdleTimer();
    const now = Date.now();
    if (now - lastRecorded.current > RECORD_EVERY_MS) {
      lastRecorded.current = now;
      recordActivity(now);
    }
  }, [armIdleTimer]);

  return { session, touch, signOut: signOutNow };
}
