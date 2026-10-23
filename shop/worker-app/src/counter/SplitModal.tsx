import { useEffect, useState } from "react";
import {
  applyRupeesKey,
  CLEAR_KEY,
  formatMoney,
  isRealSplit,
  parseRupeesInput,
  splitPayment,
  upiFromTyped,
  type SplitSide,
} from "@kumbakonam/shared/core";
import { Keypad } from "./Keypad";
import { t } from "./strings";

interface Props {
  totalMinor: number;
  /** The GPay half so far, in paise (0 for a fresh split). */
  upiMinor: number;
  onDone: (upiMinor: number) => void;
  onCancel: () => void;
}

/**
 * Divides one bill between cash and GPay (cash first, and its box is the one selected when the sheet opens). Only the GPay half is kept; cash is the remainder. Tap a box, type a rupee
 * amount, and the other box fills in so the two always add up to the bill. Done is allowed only when both halves are
 * real: a "split" with nothing on one side is just cash or GPay.
 */
export function SplitModal({ totalMinor, upiMinor, onDone, onCancel }: Props) {
  const [upi, setUpi] = useState(splitPayment(totalMinor, upiMinor).upiMinor);
  const [side, setSide] = useState<SplitSide>("cash");
  const [text, setText] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const { cashMinor } = splitPayment(totalMinor, upi);
  const valid = isRealSplit(totalMinor, upi);

  const choose = (next: SplitSide) => {
    setSide(next);
    setText("");
  };
  const press = (key: string) => {
    const nextText = key === CLEAR_KEY ? "" : applyRupeesKey(text, key);
    setText(nextText);
    setUpi(upiFromTyped(totalMinor, side, nextText === "" ? 0 : (parseRupeesInput(nextText) ?? 0)));
  };

  const box = (which: SplitSide, label: string, minor: number) => (
    <button type="button" className={`ct-split__box${which === side ? " is-on" : ""}`} aria-pressed={which === side} onClick={() => choose(which)}>
      <span>{label}</span>
      <strong>{formatMoney(minor)}</strong>
    </button>
  );

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.splitTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.splitTitle}</h2>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.cancel} onClick={onCancel}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          <div className="ct-summary">
            <div className="ct-summary__text">
              <span className="ct-summary__method">{t.billTotal}</span>
            </div>
            <span className="ct-summary__total">{formatMoney(totalMinor)}</span>
          </div>

          <div className="ct-split">
            {box("cash", t.cashHalf, cashMinor)}
            <span className="ct-split__plus" aria-hidden="true">
              +
            </span>
            {box("upi", t.gpay, upi)}
          </div>
          <p className="ct-hint">{t.splitHint}</p>

          <Keypad leftKey="C" onKey={press} />
        </div>

        <footer className="ct-sheet__actions">
          <button type="button" className="ct-btn ct-btn--plain" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="ct-btn ct-btn--primary" disabled={!valid} onClick={() => onDone(upi)}>
            {t.done}
          </button>
        </footer>
      </div>
    </div>
  );
}
