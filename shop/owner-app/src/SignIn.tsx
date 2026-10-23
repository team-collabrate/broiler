import { useEffect, useState } from "react";
import {
  afterWrongPin,
  applyPinKey,
  BACKSPACE_KEY,
  blockedForMs,
  isValidPin,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  NO_ATTEMPTS,
  parseAttempts,
  type AttemptState,
} from "@kumbakonam/shared/core";
import { browserStore, signInWithPin } from "@kumbakonam/shared/shop";
import { errorText } from "./fmt";

const ATTEMPTS_KEY = "broiler.owner.pinAttempts";
const store = browserStore();
const WRONG_PIN_CODES = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", BACKSPACE_KEY];

/**
 * The admin's PIN screen, laid out exactly like the counter's: logo, name, dots and a keypad, and the PIN goes in by
 * itself at the fourth digit. Five wrong tries in a row block it for 30 seconds.
 */
export function SignIn() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptState>(() => parseAttempts(store.getItem(ATTEMPTS_KEY)));
  const [now, setNow] = useState(Date.now());
  const waitMs = blockedForMs(attempts, now);

  // Count the block down.
  useEffect(() => {
    if (waitMs <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [waitMs]);

  const press = (key: string) => {
    if (busy || blockedForMs(attempts, Date.now()) > 0) return;
    setError(null);
    setPin((prev) => applyPinKey(prev, key));
  };

  // A keyboard works too (a computer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press(BACKSPACE_KEY);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async (typed: string) => {
    if (busy || !isValidPin(typed) || blockedForMs(attempts, Date.now()) > 0) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPin("owner", typed);
      store.setItem(ATTEMPTS_KEY, JSON.stringify(NO_ATTEMPTS));
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (WRONG_PIN_CODES.includes(code)) {
        const next = afterWrongPin(attempts, Date.now());
        setAttempts(next);
        store.setItem(ATTEMPTS_KEY, JSON.stringify(next));
        setNow(Date.now());
      }
      setError(errorText(e));
      setPin("");
      setBusy(false);
    }
  };

  // No sign-in button: the PIN goes in as soon as the last digit is typed.
  useEffect(() => {
    if (pin.length === MIN_PIN_LENGTH) void submit(pin);
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const dots = Math.max(MIN_PIN_LENGTH, pin.length);
  const message = busy ? "உள்நுழைகிறது…" : waitMs > 0 ? `அதிக முறை தவறு. ${Math.ceil(waitMs / 1000)} வினாடி காத்திருக்கவும்.` : (error ?? "\u00a0");

  return (
    <main className="ow-pin">
      <div className="ow-pin__card">
        <img className="ow-pin__logo" src="/logo.png" alt="" />
        <h1 className="ow-pin__title">HONEY BROILERS</h1>
        <p className="ow-pin__subtitle">நிர்வாகம். PIN போடவும்.</p>
        <div className="ow-pin__dots" aria-label={`${pin.length} / ${MAX_PIN_LENGTH}`} aria-live="polite">
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={`ow-pin__dot${i < pin.length ? " is-on" : ""}`} />
          ))}
        </div>
        <p className="ow-pin__error" role="alert">
          {message}
        </p>
        <div className="ow-keypad">
          {KEYS.map((key, i) =>
            key === "" ? (
              <span key={`gap-${i}`} />
            ) : (
              <button key={key} type="button" className="ow-key" aria-label={key === BACKSPACE_KEY ? "அழி" : key} onClick={() => press(key)}>
                {key}
              </button>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
