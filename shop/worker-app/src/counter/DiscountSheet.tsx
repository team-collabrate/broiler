import { useEffect, useState } from "react";
import { applyRupeesKey, CLEAR_KEY, formatMoney, parseRupeesInput } from "@kumbakonam/shared/core";
import { Keypad } from "./Keypad";
import { t } from "./strings";

interface Props {
  /** The lines' sum, in paise. */
  subtotalMinor: number;
  /** The discount now on the bill (0 for none). */
  discountMinor: number;
  onDone: (discountMinor: number) => void;
  onCancel: () => void;
}

/**
 * A flat discount, in whole rupees, taken off the bill. Type the amount on the keypad; the new total shows as you type.
 * It must be above zero and less than the bill. Remove clears it. Counter staff and the owner can both use it.
 */
export function DiscountSheet({ subtotalMinor, discountMinor, onDone, onCancel }: Props) {
  const [text, setText] = useState(discountMinor > 0 ? String(discountMinor / 100) : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const typedMinor = text === "" ? 0 : (parseRupeesInput(text) ?? 0);
  const valid = typedMinor > 0 && typedMinor < subtotalMinor;
  const tooMuch = typedMinor >= subtotalMinor && typedMinor > 0;

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.discountTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.discountTitle}</h2>
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
            <span className="ct-summary__total">{formatMoney(subtotalMinor)}</span>
          </div>

          <div className="ct-discount-entry">
            <span>{t.discountAmount}</span>
            <strong className={tooMuch ? "is-bad" : undefined}>{typedMinor > 0 ? `-${formatMoney(typedMinor)}` : "₹0"}</strong>
          </div>
          <div className="ct-discount-entry ct-discount-entry--new">
            <span>{t.newTotal}</span>
            <strong>{formatMoney(valid ? subtotalMinor - typedMinor : subtotalMinor)}</strong>
          </div>
          {tooMuch && <p className="ct-hint ct-hint--bad">{t.discountTooMuch}</p>}

          <Keypad leftKey="C" onKey={(key) => setText((prev) => (key === CLEAR_KEY ? "" : applyRupeesKey(prev, key)))} />
        </div>

        <footer className="ct-sheet__actions">
          {discountMinor > 0 && (
            <button type="button" className="ct-btn ct-btn--plain" onClick={() => onDone(0)}>
              {t.removeDiscount}
            </button>
          )}
          <button type="button" className="ct-btn ct-btn--plain" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="ct-btn ct-btn--primary" disabled={!valid} onClick={() => onDone(typedMinor)}>
            {t.done}
          </button>
        </footer>
      </div>
    </div>
  );
}
