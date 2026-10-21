import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { isValidPin, pinPassword, roleOfEmail, ROLE_EMAILS, type Role } from "../core";
import { getFirebaseAuth } from "../firebase";

export type SessionState = { status: "loading" } | { status: "out" } | { status: "in"; role: Role };

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
 * The signed-in role. The session stays signed in across idle time, restarts and lost connections: signing out
 * would stop queued sales from uploading, and signing back in needs the internet. Hiding the screen after idle
 * time is the screen lock's job (screenLock.ts), not this hook's.
 */
export function useShopSession({ developmentSignIn = false }: Options = {}) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    let triedDev = false;
    const stop = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!alive) return;
      const role = user ? roleOfEmail(user.email) : null;
      if (user && role === null) {
        // Not the owner or the counter (an anonymous dev session, or someone who signed up with the public key).
        if (developmentSignIn) {
          setSession({ status: "in", role: "counter" });
          return;
        }
        await signOutNow();
        return;
      }
      if (role === null) {
        if (developmentSignIn && !triedDev) {
          triedDev = true;
          await signInAnonymously(getFirebaseAuth()).catch(() => undefined);
          return;
        }
        setSession({ status: "out" });
        return;
      }
      setSession({ status: "in", role });
    });
    return () => {
      alive = false;
      stop();
    };
  }, [developmentSignIn]);

  return { session, signOut: signOutNow };
}
