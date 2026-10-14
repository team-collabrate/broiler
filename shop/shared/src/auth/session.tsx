import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { signInAnonymously } from "firebase/auth";
import { getFirebaseAuth } from "../firebase";
import { findUserByPinHash } from "../services";
import type { SessionUser, UserRole } from "../types";
import { useLanguage } from "../i18n";
import { hashPin, isValidPinFormat } from "./pinHash";

const MESSAGES = {
  connectFailed: {
    en: "Can't reach the server. Check your connection and try again.",
    ta: "சர்வரை அணுக முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
  },
  pinFormat: {
    en: "PIN must be 4 digits.",
    ta: "பின் எண் 4 இலக்கங்களாக இருக்க வேண்டும்.",
  },
  incorrectPin: {
    en: "Incorrect PIN.",
    ta: "பின் எண் தவறு.",
  },
  loginFailed: {
    en: "Something went wrong. Please try again.",
    ta: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
  },
} as const;

/** Per TDD §5 / 03_User_Flow §4 — re-prompt after this much inactivity. */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "touchstart",
];

// Persists the PIN session across a page reload — without this, sessionUser
// was pure in-memory React state, so *any* reload (a pull-to-refresh drag,
// Android reclaiming a backgrounded PWA's memory, the service worker
// updating) dropped the worker straight back to the PIN screen regardless
// of how recently they'd typed it in, even though the 30-minute inactivity
// timeout below says that should still count as "logged in". Keyed by role
// so a stored owner session (shouldn't happen — separate origins per app —
// but cheap to guard) is never read back as a worker one or vice versa.
// try/catched: private-browsing storage restrictions degrade to today's
// in-memory-only behaviour instead of crashing the provider.
const STORAGE_KEY = "kumbakonam.session";

interface StoredSession {
  user: SessionUser;
  lastActivityAt: number;
}

function readStoredSession(expectedRole: UserRole): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    if (stored.user.role !== expectedRole) return null;
    if (Date.now() - stored.lastActivityAt >= INACTIVITY_TIMEOUT_MS) return null;
    return stored.user;
  } catch {
    return null;
  }
}

function writeStoredSession(user: SessionUser): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, lastActivityAt: Date.now() } satisfies StoredSession));
  } catch {
    // Storage unavailable (private mode, quota) — session still works for
    // this load, it just won't survive a reload. Not worth surfacing.
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if it never wrote */
  }
}

export interface SessionContextValue {
  /**
   * True once anonymous auth completes. Informational only now (drives the
   * "Connecting…" vs "Enter your PIN" subtitle) — it no longer gates
   * whether the PIN pad accepts input. `login()` itself waits for the same
   * readiness internally, so typing can start immediately and the network
   * round-trip happens while the worker is still tapping digits, not
   * before they're allowed to.
   */
  ready: boolean;
  sessionUser: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  /** Restricts PIN login to a single role — Worker app only accepts `worker`, Owner app only `owner`. */
  expectedRole: UserRole;
}

export function SessionProvider({ children, expectedRole }: SessionProviderProps) {
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const [ready, setReady] = useState(false);
  // Lazy initializer — runs once, synchronously, before first paint, so a
  // reload within the inactivity window never even flashes the PIN screen.
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => readStoredSession(expectedRole));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anonymous sign-in gates Firestore reads per firestore.rules — must
  // complete before a PIN lookup query is allowed to run. Runs once on
  // mount regardless of later language changes (languageRef avoids
  // re-triggering sign-in just because the toggle was flipped).
  //
  // This used to also be what the PIN pad's own `disabled` state waited
  // on — every launch, the worker stared at a frozen keypad for however
  // long this round-trip took, even though nothing about *typing* a PIN
  // needs it done yet. readyPromiseRef exists so `login()` can await this
  // internally instead: typing is never blocked, and by the time four
  // digits are tapped in, this has usually already resolved in the
  // background, so the wait most people actually feel is close to zero.
  const readyPromiseRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      setReady(true);
      return;
    }
    readyPromiseRef.current = signInAnonymously(auth)
      .then(() => {
        setReady(true);
      })
      .catch((err: unknown) => {
        console.error("Anonymous sign-in failed", err);
        setError(MESSAGES.connectFailed[languageRef.current]);
        throw err; // so anyone awaiting readyPromiseRef also sees the failure
      });
  }, []);

  const logout = useCallback(() => {
    setSessionUser(null);
    setError(null);
    clearStoredSession();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const login = useCallback(
    async (pin: string) => {
      if (!isValidPinFormat(pin)) {
        setError(MESSAGES.pinFormat[language]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Waits here, not before the worker was allowed to start typing.
        // In the common case this is already resolved by now; kept as its
        // own try/catch so a sign-in failure keeps the specific
        // "can't reach the server" message the effect above set, rather
        // than falling through to the generic one below.
        try {
          await readyPromiseRef.current;
        } catch {
          setError(MESSAGES.connectFailed[language]);
          return;
        }
        const pinHash = await hashPin(pin);
        const user = await findUserByPinHash(pinHash, expectedRole);
        if (!user) {
          setError(MESSAGES.incorrectPin[language]);
          return;
        }
        setSessionUser(user);
        writeStoredSession(user);
      } catch (err) {
        console.error("PIN login failed", err);
        setError(MESSAGES.loginFailed[language]);
      } finally {
        setLoading(false);
      }
    },
    [expectedRole, language],
  );

  // Inactivity timeout — resets on any user interaction while logged in.
  useEffect(() => {
    if (!sessionUser) return;

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
      // Keeps the persisted timestamp rolling forward with real activity —
      // without this, a reload after 25 minutes of continuous, active use
      // would read back a stale login-time timestamp and (wrongly) still
      // count it as "recent enough", or conversely require re-storing on
      // every login only. Cheap: these are discrete tap/key events, not a
      // continuous stream like scroll or mousemove.
      writeStoredSession(sessionUser);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [sessionUser, logout]);

  return (
    <SessionContext.Provider value={{ ready, sessionUser, loading, error, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
