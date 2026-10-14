import { useCallback, useState } from "react";
import { formatCurrency, recordCustomerPayment, useLanguage, type Customer } from "@kumbakonam/shared";
import "./KhataModal.css";

const STRINGS = {
  title: { en: "Credit book", ta: "கடன் புத்தகம்" },
  subtitle: {
    en: "Who owes what. A name disappears once the balance is cleared.",
    ta: "யார் எவ்வளவு கடன். கடன் முடிந்ததும் பெயர் தானாக மறையும்.",
  },
  totalOwed: { en: "Total owed", ta: "மொத்த கடன்" },
  nobody: { en: "Nobody owes anything.", ta: "யாருக்கும் கடன் இல்லை." },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  collect: { en: "Take payment", ta: "பணம் பெறு" },
  payFull: { en: "Pay all", ta: "முழுவதும்" },
  amount: { en: "Amount received (₹)", ta: "பெற்ற தொகை (₹)" },
  confirm: { en: "Record", ta: "பதிவு" },
  back: { en: "Back", ta: "பின்" },
  close: { en: "Close", ta: "மூடு" },
  tooMuch: { en: "More than they owe.", ta: "கடனை விட அதிகம்." },
  needAmount: { en: "Enter an amount above zero.", ta: "பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்." },
  failed: { en: "Could not record. Try again.", ta: "பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
};

export interface KhataModalProps {
  customers: Customer[];
  loading: boolean;
  workerId: string;
  onClose: () => void;
  /** Called once the payment write is confirmed — see the comment on
   *  `submit` below for why this replaced the old live-subscription
   *  self-correction. */
  onChanged?: () => void;
}

/** Outstanding balances, and the place a customer settles them. */
export function KhataModal({ customers, loading, workerId, onClose, onChanged }: KhataModalProps) {
  const { language } = useLanguage();
  const [collecting, setCollecting] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totalOwed = customers.reduce((sum, c) => sum + c.balance, 0);

  const submit = useCallback(() => {
    if (!collecting) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(STRINGS.needAmount[language]);
      return;
    }
    // Overpaying would drive the balance below zero, and a list built on
    // "balance > 0" would then drop the customer entirely — taking the
    // remaining debt off the books with them.
    if (value > collecting.balance) {
      setError(STRINGS.tooMuch[language]);
      return;
    }

    const { committed } = recordCustomerPayment({
      customerId: collecting.customerId,
      customerName: collecting.name,
      amount: value,
      workerId,
    });
    committed
      .then(() => onChanged?.())
      .catch((err) => {
        console.error("Payment write refused", err);
        setError(STRINGS.failed[language]);
      });

    // The list used to be a live subscription and corrected itself; now
    // fetch-once-plus-refresh (see useOutstandingCustomers), so onChanged
    // above is what pulls the settled/reduced balance back in.
    setCollecting(null);
    setAmount("");
    setError(null);
  }, [collecting, amount, workerId, language, onChanged]);

  return (
    <div className="khata__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="khata">
        <div>
          <h2 className="khata__title">{STRINGS.title[language]}</h2>
          <p className="khata__subtitle">{STRINGS.subtitle[language]}</p>
        </div>

        {collecting ? (
          <>
            <div className="khata__total">
              <span>{collecting.name}</span>
              <strong>{formatCurrency(collecting.balance)}</strong>
            </div>

            <label className="khata__field">
              <span>{STRINGS.amount[language]}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={collecting.balance}
                step="any"
                value={amount}
                placeholder="0"
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="khata__payfull"
              onClick={() => setAmount(String(collecting.balance))}
            >
              {STRINGS.payFull[language]} · {formatCurrency(collecting.balance)}
            </button>

            <div className="khata__status">{error ?? " "}</div>

            <div className="khata__actions">
              <button
                type="button"
                className="khata__secondary"
                onClick={() => {
                  setCollecting(null);
                  setError(null);
                }}
              >
                {STRINGS.back[language]}
              </button>
              <button type="button" className="khata__primary" onClick={submit}>
                {STRINGS.confirm[language]}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="khata__total">
              <span>{STRINGS.totalOwed[language]}</span>
              <strong>{formatCurrency(totalOwed)}</strong>
            </div>

            {loading ? (
              <p className="khata__status">{STRINGS.loading[language]}</p>
            ) : customers.length === 0 ? (
              <p className="khata__status">{STRINGS.nobody[language]}</p>
            ) : (
              <ul className="khata__list">
                {customers.map((customer) => (
                  <li key={customer.customerId}>
                    <span className="khata__name">{customer.name}</span>
                    <span className="khata__balance">{formatCurrency(customer.balance)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCollecting(customer);
                        setAmount("");
                      }}
                    >
                      {STRINGS.collect[language]}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="khata__actions">
              <button type="button" className="khata__secondary" onClick={onClose}>
                {STRINGS.close[language]}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
