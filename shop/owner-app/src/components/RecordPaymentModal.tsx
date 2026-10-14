import { useCallback, useState } from "react";
import { formatCurrency, recordCustomerPayment, useLanguage, type Customer } from "@kumbakonam/shared";
import "./RecordPaymentModal.css";

const STRINGS = {
  title: { en: "Take payment", ta: "பணம் பெறு" },
  amount: { en: "Amount received (₹)", ta: "பெற்ற தொகை (₹)" },
  payFull: { en: "Pay all", ta: "முழுவதும்" },
  confirm: { en: "Record", ta: "பதிவு" },
  close: { en: "Close", ta: "மூடு" },
  tooMuch: { en: "More than they owe.", ta: "கடனை விட அதிகம்." },
  needAmount: { en: "Enter an amount above zero.", ta: "பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்." },
  failed: { en: "Could not record. Try again.", ta: "பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
};

export interface RecordPaymentModalProps {
  customer: Customer;
  /** The active owner's own user id — same actor-verified field the worker's KhataModal writes. */
  ownerId: string;
  onClose: () => void;
  /** Called once, right before onClose, only after a genuine successful
   *  save — never on Cancel. See RecordExpenseModal's identical prop for
   *  the full reasoning (2026-09-07, customer balances stopped being a
   *  live subscription). */
  onSaved?: () => void;
}

/**
 * Owner-side equivalent of the worker app's KhataModal "collecting" view.
 * The worker could always take a payment from the counter; the owner could
 * only watch the balance from their phone — this closes that gap, reusing
 * the exact same recordCustomerPayment() call (the Firestore rule already
 * allows the owner role, this was a missing screen, not a missing
 * permission).
 */
export function RecordPaymentModal({ customer, ownerId, onClose, onSaved }: RecordPaymentModalProps) {
  const { language } = useLanguage();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = useCallback(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(STRINGS.needAmount[language]);
      return;
    }
    // Same reasoning as the worker's KhataModal: overpaying would drive the
    // balance below zero, and a list built on "balance > 0" would drop the
    // customer entirely, taking the remaining debt off the books with them.
    if (value > customer.balance) {
      setError(STRINGS.tooMuch[language]);
      return;
    }

    setSaving(true);
    const { committed } = recordCustomerPayment({
      customerId: customer.customerId,
      customerName: customer.name,
      amount: value,
      workerId: ownerId,
    });
    committed
      .then(() => {
        onSaved?.();
        onClose();
      })
      .catch((err) => {
        console.error("Payment write refused", err);
        setError(STRINGS.failed[language]);
        setSaving(false);
      });
  }, [amount, customer, ownerId, language, onClose, onSaved]);

  return (
    <div className="record-payment__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="record-payment">
        <h2 className="record-payment__title">{STRINGS.title[language]}</h2>

        <div className="record-payment__balance">
          <span>{customer.name}</span>
          <strong>{formatCurrency(customer.balance)}</strong>
        </div>

        <label className="record-payment__field">
          <span>{STRINGS.amount[language]}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={customer.balance}
            step="any"
            value={amount}
            placeholder="0"
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <button type="button" className="record-payment__full" onClick={() => setAmount(String(customer.balance))}>
          {STRINGS.payFull[language]} · {formatCurrency(customer.balance)}
        </button>

        <div className="record-payment__status" role="status">
          {error ?? " "}
        </div>

        <div className="record-payment__actions">
          <button type="button" className="record-payment__cancel" onClick={onClose} disabled={saving}>
            {STRINGS.close[language]}
          </button>
          <button type="button" className="record-payment__save" onClick={submit} disabled={saving}>
            {STRINGS.confirm[language]}
          </button>
        </div>
      </div>
    </div>
  );
}
