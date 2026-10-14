import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatCurrency, useLanguage, type Customer } from "@kumbakonam/shared";
import "./CreditCustomerModal.css";

const STRINGS = {
  title: { en: "On account", ta: "கடன்" },
  subtitle: {
    en: "Pick who this bill is for, or type a new name.",
    ta: "இந்த பில் யாருக்கு என்பதைத் தேர்ந்தெடுக்கவும், அல்லது புதிய பெயரை எழுதவும்.",
  },
  owing: { en: "Currently owing", ta: "தற்போது கடன் உள்ளவர்கள்" },
  newName: { en: "New customer", ta: "புதிய வாடிக்கையாளர்" },
  namePlaceholder: { en: "Name", ta: "பெயர்" },
  billTotal: { en: "This bill", ta: "இந்த பில்" },
  use: { en: "Use this name", ta: "இந்தப் பெயரைப் பயன்படுத்து" },
  cancel: { en: "Cancel", ta: "ரத்து" },
  needName: { en: "Type a name first.", ta: "முதலில் ஒரு பெயரை எழுதவும்." },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  nobody: { en: "Nobody owes anything right now.", ta: "தற்போது யாருக்கும் கடன் இல்லை." },
};

export interface CreditCustomerModalProps {
  total: number;
  customers: Customer[];
  loading: boolean;
  /** Called with an existing customer, or with a typed name for a new one. */
  onChoose: (choice: { customer?: Customer; name?: string }) => void;
  onCancel: () => void;
}

/**
 * Chooses who a credit bill is on account for.
 *
 * The list is only people who currently owe — that is the counter's entire
 * customer list. Someone who has settled drops out of it by themselves, and
 * comes back the moment they take credit again, which is how the paper khata
 * behaves and what keeps the list short enough to scan mid-rush.
 */
export function CreditCustomerModal({
  total,
  customers,
  loading,
  onChoose,
  onCancel,
}: CreditCustomerModalProps) {
  const { language } = useLanguage();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const submitNew = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError(STRINGS.needName[language]);
        nameRef.current?.focus();
        return;
      }
      onChoose({ name: trimmed });
    },
    [name, language, onChoose],
  );

  return (
    <div className="credit__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="credit">
        <div>
          <h2 className="credit__title">{STRINGS.title[language]}</h2>
          <p className="credit__subtitle">{STRINGS.subtitle[language]}</p>
        </div>

        <div className="credit__total">
          <span>{STRINGS.billTotal[language]}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div className="credit__section">
          <p className="credit__section-title">{STRINGS.owing[language]}</p>
          {loading ? (
            <p className="credit__status">{STRINGS.loading[language]}</p>
          ) : customers.length === 0 ? (
            <p className="credit__status">{STRINGS.nobody[language]}</p>
          ) : (
            <ul className="credit__list">
              {customers.map((customer) => (
                <li key={customer.customerId}>
                  <button type="button" onClick={() => onChoose({ customer })}>
                    <span className="credit__name">{customer.name}</span>
                    <span className="credit__balance">{formatCurrency(customer.balance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="credit__section" onSubmit={submitNew}>
          <p className="credit__section-title">{STRINGS.newName[language]}</p>
          <input
            ref={nameRef}
            type="text"
            value={name}
            placeholder={STRINGS.namePlaceholder[language]}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
          <div className="credit__status is-error">{error ?? " "}</div>
          <div className="credit__actions">
            <button type="button" className="credit__cancel" onClick={onCancel}>
              {STRINGS.cancel[language]}
            </button>
            <button type="submit" className="credit__use">
              {STRINGS.use[language]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
