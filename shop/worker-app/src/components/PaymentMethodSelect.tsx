import { useLanguage, type PaymentMethod } from "@kumbakonam/shared";
import "./PaymentMethodSelect.css";

/**
 * Key must match PAYMENT_KEYS in hooks/useKeyboardShortcuts.ts.
 *
 * No card: the cafe doesn't take them. That slot is now Split, for a bill
 * paid part in cash and part on GPay. Credit is a regular buying on
 * account — the sale happens, no money moves, and the total goes on their
 * balance instead.
 */
const METHODS: Array<{ value: PaymentMethod; label: { en: string; ta: string }; key: string }> = [
  { value: "cash", label: { en: "Cash", ta: "பணம்" }, key: "C" },
  { value: "upi", label: { en: "UPI", ta: "UPI" }, key: "U" },
  { value: "split", label: { en: "Split", ta: "பிரித்து" }, key: "S" },
  { value: "credit", label: { en: "Credit", ta: "கடன்" }, key: "K" },
];

const ARIA_LABEL = { en: "Payment method", ta: "பணம் செலுத்தும் முறை" };

export interface PaymentMethodSelectProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  /** True while the cart is empty — there is nothing to pay for yet. */
  disabled?: boolean;
}

export function PaymentMethodSelect({ value, onChange, disabled = false }: PaymentMethodSelectProps) {
  const { language } = useLanguage();
  return (
    <div
      className={`payment-method ${disabled ? "is-disabled" : ""}`}
      role="radiogroup"
      aria-label={ARIA_LABEL[language]}
    >
      {METHODS.map((method) => (
        <button
          key={method.value}
          type="button"
          role="radio"
          aria-checked={value === method.value}
          className={`payment-method__option ${value === method.value ? "is-selected" : ""}`}
          disabled={disabled}
          onClick={() => onChange(method.value)}
        >
          {method.label[language]} <span className="payment-method__key">({method.key})</span>
        </button>
      ))}
    </div>
  );
}
