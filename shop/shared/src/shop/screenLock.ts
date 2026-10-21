import { useCallback, useEffect, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  afterWrongPin,
  blockedForMs,
  checkPinVerifier,
  isPinVerifier,
  isValidPin,
  makePinVerifier,
  NO_ATTEMPTS,
  parseAttempts,
  pinPassword,
  type PinVerifier,
  type Role,
} from "../core";
import { getFirebaseAuth } from "../firebase";
import { browserStore } from "./storage";

// The screen lock hides the sales screen after idle time and asks for the PIN again. The tablet stays signed in
// (see core/pinLock.ts for why), so the PIN is checked against the server when it can be reached and against a
// salted hash kept on the tablet when it cannot.

/** No touch for this long and the screen locks. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
/** Record activity to storage at most this often; taps arrive far faster than that. */
const RECORD_EVERY_MS = 10_000;
/** Give up on the server and use the tablet's own check after this long. */
const SERVER_CHECK_TIMEOUT_MS = 6000;

const LOCKED_KEY = "broiler.locked";
const ACTIVE_KEY = "broiler.lastActiveAt";
const PINS_KEY = "broiler.pinChecks";
const ATTEMPTS_KEY = "broiler.pinAttempts";
const store = browserStore();

const coded = (code: string) => Object.assign(new Error(code), { code });

function readVerifiers(): Partial<Record<Role, PinVerifier>> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(PINS_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Partial<Record<Role, PinVerifier>> = {};
    for (const role of ["owner", "counter"] as const) {
      const candidate = (parsed as Record<string, unknown>)[role];
      if (isPinVerifier(candidate)) out[role] = candidate;
    }
    return out;
  } catch {
    return {};
  }
}

/** Remembers that this PIN was accepted for the role, so the screen can be unlocked later with no connection. */
export async function rememberPin(role: Role, pin: string): Promise<void> {
  const verifiers = readVerifiers();
  verifiers[role] = await makePinVerifier(pin);
  store.setItem(PINS_KEY, JSON.stringify(verifiers));
}

function recordActivity(now = Date.now()): void {
  store.setItem(ACTIVE_KEY, String(now));
}

function idleTooLong(now = Date.now()): boolean {
  const raw = store.getItem(ACTIVE_KEY);
  const last = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(last) && now - last > IDLE_LIMIT_MS;
}

const isNetworkProblem = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === "auth/network-request-failed" || code === "app/timeout";
};

/** Checks the PIN for the signed-in account. Resolves when it is right; rejects with a coded error when it is not. */
async function checkPin(role: Role, pin: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (user?.email) {
    try {
      // Re-checks the PIN with the server without changing who is signed in.
      await Promise.race([
        reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pinPassword(pin))),
        new Promise<never>((_, reject) => setTimeout(() => reject(coded("app/timeout")), SERVER_CHECK_TIMEOUT_MS)),
      ]);
      await rememberPin(role, pin);
      return;
    } catch (error) {
      if (!isNetworkProblem(error)) throw error;
    }
  }
  // The server cannot be reached: the PIN remembered on this tablet decides.
  const verifier = readVerifiers()[role];
  if (!verifier) throw coded("auth/network-request-failed");
  if (!(await checkPinVerifier(pin, verifier))) throw coded("auth/invalid-credential");
}

const WRONG_PIN_CODES = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"];

interface Options {
  /** False while signed out, or in the dev anonymous session, which has no PIN to ask for. */
  enabled: boolean;
  role: Role | null;
}

/**
 * Locks the sales screen after 30 idle minutes, or when asked, and unlocks it with the PIN. Call `touch()` on every
 * touch. The lock survives a reload: it is remembered in storage, and so is the time of the last touch.
 */
export function useScreenLock({ enabled, role }: Options) {
  const [locked, setLocked] = useState(() => store.getItem(LOCKED_KEY) === "1");
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRecorded = useRef(0);

  const lock = useCallback(() => {
    clearTimeout(idleTimer.current);
    store.setItem(LOCKED_KEY, "1");
    setLocked(true);
  }, []);

  const armIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(lock, IDLE_LIMIT_MS);
  }, [lock]);

  // A launch (or a sign-in) that finds the till idle for too long starts locked.
  useEffect(() => {
    if (!enabled) {
      clearTimeout(idleTimer.current);
      return;
    }
    if (idleTooLong()) lock();
    else if (!locked) armIdleTimer();
    return () => clearTimeout(idleTimer.current);
  }, [enabled, locked, lock, armIdleTimer]);

  const touch = useCallback(() => {
    if (!enabled || locked) return;
    armIdleTimer();
    const now = Date.now();
    if (now - lastRecorded.current > RECORD_EVERY_MS) {
      lastRecorded.current = now;
      recordActivity(now);
    }
  }, [enabled, locked, armIdleTimer]);

  /** A fresh sign-in: not locked, and the idle clock starts now. Call this before signing in. */
  const reset = useCallback(() => {
    store.setItem(LOCKED_KEY, "0");
    recordActivity();
    setLocked(false);
  }, []);

  /** Rejects (with an error `describeError` can word) on a wrong PIN, a missing connection, or too many tries. */
  const unlock = useCallback(
    async (pin: string) => {
      if (role === null) throw coded("auth/invalid-credential");
      const attempts = parseAttempts(store.getItem(ATTEMPTS_KEY));
      if (blockedForMs(attempts, Date.now()) > 0) throw coded("app/too-many-attempts");
      if (!isValidPin(pin)) throw coded("app/invalid-pin");
      try {
        await checkPin(role, pin);
      } catch (error) {
        const code = (error as { code?: string } | null)?.code ?? "";
        if (WRONG_PIN_CODES.includes(code)) store.setItem(ATTEMPTS_KEY, JSON.stringify(afterWrongPin(attempts, Date.now())));
        throw error;
      }
      store.setItem(ATTEMPTS_KEY, JSON.stringify(NO_ATTEMPTS));
      reset();
    },
    [role, reset],
  );

  return { locked: enabled && locked, lock, unlock, touch, reset };
}
