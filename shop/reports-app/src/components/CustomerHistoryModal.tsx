import { useEffect, useState } from "react";
import {
  formatCurrency,
  getCustomerOrders,
  getCustomerPayments,
  translateItemName,
  useLanguage,
  type CustomerPayment,
  type Order,
} from "@kumbakonam/shared";
import "./CustomerHistoryModal.css";

const STRINGS = {
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  error: { en: "Could not load history. Try again.", ta: "வரலாற்றை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
  empty: { en: "No credit purchases or payments yet.", ta: "இதுவரை கடன் வாங்கல்கள் அல்லது பணம் செலுத்தல்கள் இல்லை." },
  bought: { en: "Bought on credit", ta: "கடனில் வாங்கியது" },
  paid: { en: "Paid", ta: "செலுத்தியது" },
  voided: { en: "Voided", ta: "ரத்துசெய்யப்பட்டது" },
  close: { en: "Close", ta: "மூடு" },
  olderNote: {
    en: "Purchases older than the detail window show as a total only elsewhere — item detail isn't kept forever.",
    ta: "விவர காலத்தை விட பழையவை மற்ற இடங்களில் மொத்தமாக மட்டுமே காட்டப்படும் — பொருள் விவரம் எப்போதும் வைக்கப்படாது.",
  },
};

export interface CustomerHistoryModalProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

type HistoryEvent =
  | { kind: "purchase"; key: string; createdAtMillis: number; order: Order }
  | { kind: "payment"; key: string; createdAtMillis: number; payment: CustomerPayment };

/**
 * Full Khata history for one customer — what they bought on credit (with
 * items, not just a total) interleaved with what they paid back, newest
 * first (requested 2026-09-05: "we don't have the history of how much we
 * are adding each time and what product is that"). One-shot fetch on open,
 * not a live subscription — this is a drill-down someone opens
 * occasionally, not something that needs to update while sitting on
 * screen, and every avoidable live listener matters given how fragile the
 * Firestore read quota has been.
 *
 * Purchases only go back as far as archiveAndPruneOldData's keepDays
 * (OwnerHome.tsx) keeps real item detail — older credit sales still count
 * in the customer's balance, they just won't appear here with their items
 * once that window passes.
 */
export function CustomerHistoryModal({ customerId, customerName, onClose }: CustomerHistoryModalProps) {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [payments, setPayments] = useState<CustomerPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([getCustomerOrders(customerId), getCustomerPayments(customerId)])
      .then(([o, p]) => {
        if (cancelled) return;
        setOrders(o);
        setPayments(p);
      })
      .catch((err) => {
        console.error("Loading customer history failed", err);
        if (!cancelled) setError(STRINGS.error[language]);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, language]);

  const loading = orders === null || payments === null;

  const events: HistoryEvent[] = loading
    ? []
    : [
        ...orders
          .filter((o) => o.paymentMethod === "credit")
          .map((order): HistoryEvent => ({
            kind: "purchase",
            key: order.orderId,
            createdAtMillis: order.createdAt.toMillis(),
            order,
          })),
        ...payments.map((payment): HistoryEvent => ({
          kind: "payment",
          key: payment.paymentId,
          createdAtMillis: payment.createdAt.toMillis(),
          payment,
        })),
      ].sort((a, b) => b.createdAtMillis - a.createdAtMillis);

  return (
    <div className="customer-history__backdrop" role="dialog" aria-modal="true" aria-label={customerName} onClick={onClose}>
      <div className="customer-history" onClick={(e) => e.stopPropagation()}>
        <div className="customer-history__header">
          <h2 className="customer-history__title">{customerName}</h2>
        </div>

        {error ? (
          <p className="customer-history__status">{error}</p>
        ) : loading ? (
          <p className="customer-history__status">{STRINGS.loading[language]}</p>
        ) : events.length === 0 ? (
          <p className="customer-history__status">{STRINGS.empty[language]}</p>
        ) : (
          <>
            <ul className="customer-history__list">
              {events.map((event) => (
                <li key={event.key} className={`customer-history__event is-${event.kind}`}>
                  {event.kind === "purchase" ? (
                    <>
                      <div className="customer-history__event-head">
                        <span className="customer-history__event-label">{STRINGS.bought[language]}</span>
                        <span className="customer-history__event-time">
                          {event.order.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          {" · "}
                          {event.order.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="customer-history__event-amount is-debit">
                          {event.order.status === "voided" ? (
                            <em className="customer-history__voided">{STRINGS.voided[language]}</em>
                          ) : (
                            `+${formatCurrency(event.order.total)}`
                          )}
                        </span>
                      </div>
                      <ul className="customer-history__items">
                        {event.order.items.map((item, i) => (
                          <li key={i}>
                            {item.qty}× {translateItemName(item, language)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="customer-history__event-head">
                      <span className="customer-history__event-label">{STRINGS.paid[language]}</span>
                      <span className="customer-history__event-time">
                        {event.payment.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {" · "}
                        {event.payment.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="customer-history__event-amount is-credit">
                        −{formatCurrency(event.payment.amount)}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="customer-history__note">{STRINGS.olderNote[language]}</p>
          </>
        )}

        <button type="button" className="customer-history__close" onClick={onClose}>
          {STRINGS.close[language]}
        </button>
      </div>
    </div>
  );
}
