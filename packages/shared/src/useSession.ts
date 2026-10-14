import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasBeenIdleTooLong,
  IDLE_LIMIT_MS,
  recordActivity,
  signInForDevelopment,
  signInWithPin,
  signOutNow,
  subscribeRole,
} from './auth';
import type { Role } from './roles';

export type SessionState = { status: 'loading' } | { status: 'out' } | { status: 'in'; role: Role };

/** Record activity to storage at most this often; taps arrive far faster than that. */
const RECORD_EVERY_MS = 10_000;

interface Options {
  /** Dev only (`__DEV__`): sign in anonymously at start, so screens can be checked before accounts exist. */
  developmentSignIn?: boolean;
}

/**
 * The signed-in role and the actions that change it. Locks itself (signs out) after 30 minutes
 * without a touch, including across a reload or relaunch. Call `touch()` on every touch.
 */
export function useSession({ developmentSignIn = false }: Options = {}) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
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
    const stop = subscribeRole(async (role, signedIn) => {
      if (!alive) return;
      if (signedIn && role === null) {
        // An account that is not the owner or the counter (for example anyone who signed up with the
        // public API key) gets nothing: sign it out.
        if (developmentSignIn) {
          roleRef.current = 'counter';
          setSession({ status: 'in', role: 'counter' });
          return;
        }
        await signOutNow();
        return;
      }
      if (role !== null && (await hasBeenIdleTooLong())) {
        await signOutNow();
        return;
      }
      if (!alive) return;
      roleRef.current = role;
      if (role === null) {
        if (developmentSignIn && !triedDev) {
          triedDev = true;
          await signInForDevelopment().catch(() => undefined);
          return;
        }
        clearTimeout(idleTimer.current);
        setSession({ status: 'out' });
        return;
      }
      void recordActivity();
      armIdleTimer();
      setSession({ status: 'in', role });
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
      void recordActivity(now);
    }
  }, [armIdleTimer]);

  const signIn = useCallback(async (role: Role, pin: string) => {
    await signInWithPin(role, pin);
    lastRecorded.current = 0;
  }, []);

  return { session, signIn, signOut: signOutNow, touch };
}
