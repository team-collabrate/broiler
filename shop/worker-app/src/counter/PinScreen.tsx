import { useEffect, useState } from "react";
import { applyPinKey, describeError, isValidPin, MAX_PIN_LENGTH, PIN_LENGTH } from "@kumbakonam/shared/core";
import { Keypad } from "./Keypad";
import { t } from "./strings";

interface Props {
  title: string;
  subtitle: string;
  /** Called with the PIN. Throw to show the failure under the dots; resolve to finish (the screen is then replaced). */
  onSubmit: (pin: string) => Promise<void>;
  /** An optional way back, for a PIN view that sits inside the app (for example the owner PIN before today's rates). */
  onCancel?: () => void;
  logoUrl?: string;
}

/**
 * A full-page PIN entry: dots, a keypad and a sign-in button. A 4 to 6 digit PIN. The PIN lives only in this
 * component's state and is cleared after a wrong attempt.
 */
export function PinScreen({ title, subtitle, onSubmit, onCancel, logoUrl }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = (key: string) => {
    if (busy) return;
    setError(null);
    setPin((prev) => applyPinKey(prev, key));
  };

  const submit = async () => {
    if (busy || !isValidPin(pin)) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (e) {
      setError(describeError(e));
      setPin("");
      setBusy(false);
    }
  };

  // No sign-in button: the PIN goes in as soon as the last digit is typed.
  useEffect(() => {
    if (pin.length === PIN_LENGTH) void submit();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const dots = Math.max(PIN_LENGTH, pin.length);

  return (
    <div className="ct-pin">
      <div className="ct-pin__card">
        {logoUrl ? <img className="ct-pin__logo" src={logoUrl} alt="" /> : null}
        <h1 className="ct-pin__title">{title}</h1>
        <p className="ct-pin__subtitle">{subtitle}</p>
        <div className="ct-pin__dots" aria-label={`${pin.length} / ${MAX_PIN_LENGTH}`} aria-live="polite">
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={`ct-pin__dot${i < pin.length ? " is-on" : ""}`} />
          ))}
        </div>
        <p className="ct-pin__error" role="alert">
          {busy ? t.connecting : (error ?? " ")}
        </p>
        <Keypad leftKey="" onKey={press} tall />
        <div className="ct-pin__actions">
          {onCancel ? (
            <button type="button" className="ct-btn ct-btn--plain" disabled={busy} onClick={onCancel}>
              {t.back}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
