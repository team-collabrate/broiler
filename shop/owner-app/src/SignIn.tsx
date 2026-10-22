import { useEffect, useState, type FormEvent } from "react";
import { afterWrongPin, blockedForMs, isValidPin, MAX_PIN_LENGTH, MIN_PIN_LENGTH, NO_ATTEMPTS, parseAttempts, type AttemptState } from "@kumbakonam/shared/core";
import { browserStore, signInWithPin } from "@kumbakonam/shared/shop";
import { errorText } from "./fmt";

const ATTEMPTS_KEY = "broiler.owner.pinAttempts";
const store = browserStore();
const WRONG_PIN_CODES = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"];

/** The owner's sign-in: the managing PIN, and nothing else gets in. Five wrong tries in a row block it for 30 seconds. */
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

  const submit = async (event?: FormEvent, typed: string = pin) => {
    event?.preventDefault();
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

  return (
    <main className="ow-signin">
      <form className="ow-signin__card" onSubmit={(e) => void submit(e)}>
        <img className="ow-signin__logo" src="/logo.png" alt="" />
        <h1 className="ow-signin__title">HONEY BROILERS</h1>
        <p className="ow-signin__sub">நிர்வாகம். PIN போடவும்.</p>
        <input
          className="ow-signin__pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          maxLength={MAX_PIN_LENGTH}
          aria-label="PIN"
          value={pin}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "");
            setPin(next);
            if (next.length === MIN_PIN_LENGTH) void submit(undefined, next);
          }}
        />
        <p className="ow-signin__error" role="alert">
          {busy ? "உள்நுழைகிறது…" : waitMs > 0 ? `அதிக முறை தவறு. ${Math.ceil(waitMs / 1000)} வினாடி காத்திருக்கவும்.` : (error ?? " ")}
        </p>
      </form>
    </main>
  );
}
