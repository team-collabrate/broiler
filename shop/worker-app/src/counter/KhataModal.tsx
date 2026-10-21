import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyRupeesKey,
  CLEAR_KEY,
  CURRENCY_SYMBOL,
  describeError,
  formatMoney,
  formatRateInput,
  parseRupeesInput,
  paymentProblem,
  PAYMENT_LABELS,
  type Customer,
  type SettleMethod,
} from "@kumbakonam/shared/core";
import { getOutstandingCustomers, newPaymentId, recordCustomerPayment } from "@kumbakonam/shared/shop";
import { Keypad } from "./Keypad";
import { t } from "./strings";

const METHODS: SettleMethod[] = ["cash", "upi"];

interface Props {
  /** The server can be reached right now. Money can only be taken off a balance while it can. */
  connected: boolean;
  onClose: () => void;
}

/**
 * The credit book (கடன் புத்தகம்): who owes what, and where a customer settles. Pick a name, type what they paid (or
 * tap "முழுவதும்" for all of it), choose cash or GPay, and record it. A name disappears from the list once their
 * balance is cleared. A payment larger than what is owed is refused.
 */
export function KhataModal({ connected, onClose }: Props) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<Customer | null>(null);
  const [text, setText] = useState("");
  /** "முழுவதும்" was pressed: the amount is the exact balance, which may have paise the keypad cannot type. */
  const [exact, setExact] = useState(false);
  const [method, setMethod] = useState<SettleMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // One receipt id per payment, kept across a failed attempt so a retry cannot take the money off twice.
  const paymentId = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    getOutstandingCustomers().then(setCustomers, (e) => setLoadError(describeError(e)));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (collecting ? setCollecting(null) : onClose());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collecting, onClose]);

  const totalOwed = (customers ?? []).reduce((sum, c) => sum + c.balanceMinor, 0);
  const amountMinor = exact && collecting ? collecting.balanceMinor : parseRupeesInput(text);
  const amountText = exact && collecting ? formatRateInput(collecting.balanceMinor) : text;

  const pick = (customer: Customer) => {
    paymentId.current = null;
    setCollecting(customer);
    setText("");
    setExact(false);
    setMethod("cash");
    setError(null);
    setNote(null);
  };

  /** A change to the amount or method is a different payment, so it gets a new receipt id. */
  const changed = () => {
    paymentId.current = null;
    setError(null);
  };

  const submit = async () => {
    if (!collecting || saving) return;
    const problem = paymentProblem(amountMinor ?? 0, collecting.balanceMinor);
    if (problem === "zero") return setError(t.needAmount);
    if (problem === "tooMuch") return setError(t.tooMuch);
    setSaving(true);
    setError(null);
    try {
      paymentId.current ??= newPaymentId();
      const result = await recordCustomerPayment({ paymentId: paymentId.current, customerId: collecting.id, amountMinor: amountMinor as number, method });
      setNote(t.recorded(collecting.name, result.balanceMinor > 0 ? formatMoney(result.balanceMinor) : ""));
      paymentId.current = null;
      setCollecting(null);
      setText("");
      setExact(false);
      load();
    } catch (e) {
      setError(t.recordFailed(describeError(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !collecting && onClose()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.khataTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.khataTitle}</h2>
            <span className="ct-sheet__sub ct-sheet__sub--note">{t.khataSubtitle}</span>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.dismiss} onClick={onClose}>
            ✕
          </button>
        </header>

        {collecting ? (
          <>
            <div className="ct-sheet__body">
              <div className="ct-summary">
                <div className="ct-summary__text">
                  <span className="ct-summary__method">{collecting.name}</span>
                </div>
                <span className="ct-summary__total">{formatMoney(collecting.balanceMinor)}</span>
              </div>

              <div className="ct-amount__display">
                <span className="ct-amount__hint">{t.amountReceived}</span>
                <span className="ct-amount__value" aria-live="polite">
                  {CURRENCY_SYMBOL}
                  {amountText || "0"}
                </span>
              </div>
              <button
                type="button"
                className="ct-btn ct-btn--plain ct-khata__all"
                onClick={() => {
                  changed();
                  setExact(true);
                }}
              >
                {t.payAll} · {formatMoney(collecting.balanceMinor)}
              </button>

              <Keypad
                leftKey="C"
                onKey={(k) => {
                  changed();
                  // Typing after "முழுவதும்" starts a fresh amount.
                  setText(k === CLEAR_KEY ? "" : applyRupeesKey(exact ? "" : text, k));
                  setExact(false);
                }}
              />

              <div className="ct-methods" role="radiogroup" aria-label={t.receivedBy}>
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={m === method}
                    className={`ct-method${m === method ? " is-on" : ""}`}
                    onClick={() => {
                      changed();
                      setMethod(m);
                    }}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>

              {!connected && <p className="ct-field__error">{t.khataOffline}</p>}
              <p className="ct-field__error" role="alert">
                {error ?? " "}
              </p>
            </div>
            <footer className="ct-sheet__actions">
              <button
                type="button"
                className="ct-btn ct-btn--plain"
                onClick={() => {
                  setCollecting(null);
                  setError(null);
                }}
              >
                {t.back}
              </button>
              <button type="button" className="ct-btn ct-btn--primary" disabled={saving || !connected} onClick={submit}>
                {saving ? t.saving : t.record}
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="ct-sheet__body">
              <div className="ct-summary">
                <div className="ct-summary__text">
                  <span className="ct-summary__method">{t.totalOwed}</span>
                </div>
                <span className="ct-summary__total">{formatMoney(totalOwed)}</span>
              </div>
              {note && <p className="ct-khata__note">{note}</p>}
              {!connected && <p className="ct-field__error">{t.khataOffline}</p>}

              <div className="ct-list" role="list">
                {loadError ? (
                  <p className="ct-list__status">{t.loadFailed(loadError)}</p>
                ) : customers === null ? (
                  <p className="ct-list__status">{t.loading}</p>
                ) : customers.length === 0 ? (
                  <p className="ct-list__status">{t.nobodyOwes}</p>
                ) : (
                  customers.map((customer) => (
                    <button key={customer.id} type="button" role="listitem" className="ct-list__row" onClick={() => pick(customer)}>
                      <span className="ct-list__name">{customer.name}</span>
                      <strong className="ct-list__amount">{formatMoney(customer.balanceMinor)}</strong>
                    </button>
                  ))
                )}
              </div>
            </div>
            <footer className="ct-sheet__actions">
              <button type="button" className="ct-btn ct-btn--plain" onClick={onClose}>
                {t.dismiss}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
