import { useEffect, useRef, useState } from "react";
import { describeError, dayKey, isVoided, paymentProblem, type Customer, type CustomerPayment, type Order, type SettleMethod } from "@kumbakonam/shared/core";
import { getCustomerOrders, getCustomerPayments, newPaymentId, recordCustomerPayment } from "@kumbakonam/shared/shop";
import type { OwnerData } from "./data";
import { billNo, dayText, formatMoney, paiseToRupees, rupeesToPaise, timeText } from "./fmt";
import { Notice, Sheet } from "./ui";

/** The credit book: who owes how much. Tap a name for their history and to take a payment. */
export function Credit({ data }: { data: OwnerData }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const total = data.customers.reduce((sum, c) => sum + c.balanceMinor, 0);
  const open = data.customers.find((c) => c.id === openId) ?? null;

  return (
    <div className="ow-stack">
      <section className="ow-card ow-summary" aria-label="Total owed">
        <div>
          <p className="ow-label">Total owed</p>
          <p className={`ow-summary__total${total > 0 ? " is-credit" : ""}`}>{formatMoney(total)}</p>
        </div>
        <p className="ow-summary__count">
          {data.customers.length} {data.customers.length === 1 ? "customer" : "customers"}
        </p>
      </section>

      {data.customers.length === 0 ? (
        <p className="ow-empty">Nobody owes anything right now.</p>
      ) : (
        <ul className="ow-bills">
          {data.customers.map((c) => (
            <li key={c.id}>
              <button type="button" className="ow-bill" onClick={() => setOpenId(c.id)}>
                <span className="ow-bill__main">
                  <strong className="ow-bill__no">{c.name}</strong>
                  {c.updatedAt && <span className="ow-bill__meta">Last change {dayText(dayKey(c.updatedAt))}</span>}
                </span>
                <strong className="ow-bill__total is-credit">{formatMoney(c.balanceMinor)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <CustomerSheet customer={open} onClose={() => setOpenId(null)} onChanged={data.refresh} />}
    </div>
  );
}

/** One customer: what they owe, a payment form, and their recent credit bills and payments. */
function CustomerSheet({ customer, onClose, onChanged }: { customer: Customer; onClose: () => void; onChanged: () => Promise<void> }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [payments, setPayments] = useState<CustomerPayment[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [method, setMethod] = useState<SettleMethod>("cash");
  const [text, setText] = useState("");
  const [exact, setExact] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // One id per payment, kept until it is recorded, so a retry after a lost answer cannot take the money off twice.
  const paymentId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHistoryError(null);
    Promise.all([getCustomerOrders(customer.id), getCustomerPayments(customer.id)]).then(
      ([o, p]) => alive && (setOrders(o), setPayments(p)),
      (e) => alive && setHistoryError(describeError(e)),
    );
    return () => {
      alive = false;
    };
  }, [customer.id, reload]);

  const amountMinor = exact ?? rupeesToPaise(text);
  const problem = amountMinor === null ? "zero" : paymentProblem(amountMinor, customer.balanceMinor);

  const record = async () => {
    if (busy || amountMinor === null || problem !== null) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    paymentId.current ??= newPaymentId();
    try {
      const result = await recordCustomerPayment({ paymentId: paymentId.current, customerId: customer.id, amountMinor, method });
      paymentId.current = null;
      setText("");
      setExact(null);
      setSaved(result.balanceMinor === 0 ? "Paid in full ✓" : `Saved ✓ ${formatMoney(result.balanceMinor)} left`);
      setReload((n) => n + 1);
      await onChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={customer.name} subtitle={`Owes ${formatMoney(customer.balanceMinor)}`} onClose={onClose} busy={busy}>
      <div className="ow-stack">
        <section className="ow-pay" aria-label="Take a payment">
          <h3 className="ow-card__title">Take a payment</h3>
          <div className="ow-chips" role="radiogroup" aria-label="Paid by">
            {(["cash", "upi"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} className={`ow-chip${method === m ? " is-active" : ""}`} onClick={() => setMethod(m)}>
                {m === "cash" ? "Cash" : "GPay / UPI"}
              </button>
            ))}
          </div>
          <div className="ow-pay__row">
            <label className="ow-field ow-field--grow">
              <span className="ow-label">Amount (₹)</span>
              <input
                className="ow-input"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setExact(null);
                  setSaved(null);
                }}
              />
            </label>
            <button
              type="button"
              className="ow-btn ow-btn--small"
              onClick={() => {
                setText(paiseToRupees(customer.balanceMinor));
                setExact(customer.balanceMinor);
                setSaved(null);
              }}
            >
              Pay all
            </button>
          </div>
          {text !== "" && problem === "tooMuch" && <p className="ow-text ow-text--error">That is more than {formatMoney(customer.balanceMinor)}, what they owe.</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="info">{saved}</Notice>}
          <button type="button" className="ow-btn ow-btn--primary ow-btn--wide" disabled={busy || amountMinor === null || problem !== null} onClick={() => void record()}>
            {busy ? "Saving…" : amountMinor !== null && problem === null ? `Record ${formatMoney(amountMinor)}` : "Record payment"}
          </button>
        </section>

        <section aria-label="Credit bills">
          <h3 className="ow-card__title">Recent credit bills</h3>
          {historyError && <Notice tone="error">{historyError}</Notice>}
          {orders === null && !historyError ? (
            <p className="ow-text ow-text--muted">Loading…</p>
          ) : orders && orders.length === 0 ? (
            <p className="ow-text ow-text--muted">No credit bills on record.</p>
          ) : (
            <ul className="ow-list">
              {orders?.map((o) => (
                <li key={o.id} className={`ow-list__row${isVoided(o) ? " is-deleted" : ""}`}>
                  <span className="ow-list__main">
                    <strong className="ow-list__name">{billNo(o)}</strong>
                    <span className="ow-list__sub">
                      {dayText(o.dayKey)} · {timeText(o.soldAt ?? o.createdAt)}
                      {isVoided(o) ? " · Deleted" : ""}
                    </span>
                  </span>
                  <span className="ow-list__amount">{formatMoney(o.totalMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Payments received">
          <h3 className="ow-card__title">Payments received</h3>
          {payments === null && !historyError ? (
            <p className="ow-text ow-text--muted">Loading…</p>
          ) : payments && payments.length === 0 ? (
            <p className="ow-text ow-text--muted">No payments yet.</p>
          ) : (
            <ul className="ow-list">
              {payments?.map((p) => (
                <li key={p.id} className="ow-list__row">
                  <span className="ow-list__main">
                    <strong className="ow-list__name">{p.method === "upi" ? "GPay / UPI" : "Cash"}</strong>
                    <span className="ow-list__sub">
                      {dayText(dayKey(p.createdAt))} · {timeText(p.createdAt)}
                    </span>
                  </span>
                  <span className="ow-list__amount">{formatMoney(p.amountMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
