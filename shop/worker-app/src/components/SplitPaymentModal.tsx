import { useEffect, useRef } from "react";
import { formatCurrency, useLanguage } from "@kumbakonam/shared";
import "./SplitPaymentModal.css";

const STRINGS = {
  title: { en: "Split payment", ta: "பணம் பிரித்து செலுத்து" },
  total: { en: "Bill total", ta: "மொத்தம்" },
  gpay: { en: "GPay", ta: "GPay" },
  cash: { en: "Cash", ta: "ரொக்கம்" },
  hint: {
    en: "Type one amount — the other fills in automatically.",
    ta: "ஒரு தொகையை உள்ளிடவும் — மற்றொன்று தானாக நிரம்பும்.",
  },
  done: { en: "Done", ta: "சரி" },
  cancel: { en: "Cancel", ta: "ரத்து" },
};

export interface SplitPaymentModalProps {
  total: number;
  upiAmount: number;
  cashAmount: number;
  onUpiAmountChange: (value: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Divides one bill between GPay and cash.
 *
 * Only the GPay figure is ever stored (see useCart) — cash is the remainder.
 * So typing in the cash box just sets GPay to `total - cash`, which is what
 * makes the two fields track each other without either being able to drift
 * out of step with the bill.
 */
export function SplitPaymentModal({
  total,
  upiAmount,
  cashAmount,
  onUpiAmountChange,
  onConfirm,
  onCancel,
}: SplitPaymentModalProps) {
  const { language } = useLanguage();
  const gpayRef = useRef<HTMLInputElement>(null);

  // The worker opened this to type a number, so put them in the GPay box.
  useEffect(() => {
    gpayRef.current?.focus();
    gpayRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div className="split-pay__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="split-pay">
        <h2 className="split-pay__title">{STRINGS.title[language]}</h2>

        <div className="split-pay__total">
          <span>{STRINGS.total[language]}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div className="split-pay__fields">
          <label className="split-pay__field">
            <span className="split-pay__label">{STRINGS.gpay[language]}</span>
            <input
              ref={gpayRef}
              type="number"
              inputMode="decimal"
              min={0}
              max={total}
              value={upiAmount || ""}
              placeholder="0"
              onChange={(e) => onUpiAmountChange(e.target.valueAsNumber || 0)}
            />
          </label>

          <span className="split-pay__plus" aria-hidden="true">+</span>

          <label className="split-pay__field">
            <span className="split-pay__label">{STRINGS.cash[language]}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={total}
              value={cashAmount || ""}
              placeholder="0"
              // Cash isn't stored; entering it sets the GPay side to the rest.
              onChange={(e) => onUpiAmountChange(total - (e.target.valueAsNumber || 0))}
            />
          </label>
        </div>

        <p className="split-pay__hint">{STRINGS.hint[language]}</p>

        <div className="split-pay__actions">
          <button type="button" className="split-pay__cancel" onClick={onCancel}>
            {STRINGS.cancel[language]}
          </button>
          <button type="button" className="split-pay__done" onClick={onConfirm}>
            {STRINGS.done[language]}
          </button>
        </div>
      </div>
    </div>
  );
}
