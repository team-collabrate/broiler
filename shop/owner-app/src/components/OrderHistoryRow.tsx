import { useState } from "react";
import {
  ConfirmDialog,
  formatCurrency,
  translateItemName,
  useLanguage,
  useSession,
  voidOrder,
  type Language,
  type Order,
} from "@kumbakonam/shared";
import { WorkerDot } from "./WorkerDot";
import { PaymentIcon } from "./PaymentIcon";
import "./OrderHistoryRow.css";

/** Exhaustive over PaymentMethod on purpose: "card" is no longer offered at
 *  the till, but orders taken before the change still carry it and must not
 *  render a blank label here. */
const PAYMENT_LABEL: Record<Order["paymentMethod"], Record<Language, string>> = {
  cash: { en: "Cash", ta: "பணம்" },
  upi: { en: "UPI", ta: "UPI" },
  split: { en: "Split", ta: "பிரித்து" },
  credit: { en: "Credit", ta: "கடன்" },
  card: { en: "Card", ta: "கார்டு" },
};

const STRINGS = {
  item: { en: "item", ta: "பொருள்" },
  items: { en: "items", ta: "பொருட்கள்" },
  note: { en: "note", ta: "குறிப்பு" },
  discount: { en: "Discount", ta: "தள்ளுபடி" },
  gpay: { en: "GPay", ta: "GPay" },
  cash: { en: "Cash", ta: "ரொக்கம்" },
  onAccount: { en: "On account", ta: "கடன்" },
  voided: { en: "Voided", ta: "ரத்துசெய்யப்பட்டது" },
  billedBy: { en: "Billed by", ta: "பில் செய்தவர்" },
  voidAction: { en: "Void this order", ta: "இந்த ஆர்டரை ரத்துசெய்" },
  voidTitle: { en: "Void this order?", ta: "இந்த ஆர்டரை ரத்துசெய்யவா?" },
  voidMessage: {
    en: "This removes it from all totals and reports. The order stays visible here, marked voided, but the money no longer counts anywhere. This can't be undone.",
    ta: "இது அனைத்து மொத்தங்கள் மற்றும் அறிக்கைகளிலிருந்தும் இதை நீக்கும். ஆர்டர் இங்கே ரத்துசெய்யப்பட்டதாகக் காட்டப்படும், ஆனால் தொகை இனி எங்கும் கணக்கிடப்படாது. இதை மீட்க முடியாது.",
  },
  voidConfirm: { en: "Void Order", ta: "ஆர்டரை ரத்துசெய்" },
  voidFailed: {
    en: "Could not void the order. Please try again.",
    ta: "ஆர்டரை ரத்துசெய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  },
};

export interface OrderHistoryRowProps {
  order: Order;
  /** Called after a successful void — refetches the caller's order list,
   *  since it stopped being a live subscription (2026-09-07, see
   *  useOrdersInRange's own comment). Without this the row would keep
   *  showing its pre-void state (Firestore write already succeeded)
   *  until the screen is reloaded. */
  onVoided?: () => void;
}

/** Design Brief §7 — "Order history row (expandable to show items)". */
export function OrderHistoryRow({ order, onVoided }: OrderHistoryRowProps) {
  const { language } = useLanguage();
  const { sessionUser } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const isVoided = order.status === "voided";

  const handleVoidConfirm = async () => {
    if (!sessionUser) return;
    setVoiding(true);
    setVoidError(null);
    try {
      await voidOrder(order.orderId, sessionUser.userId);
      setConfirmingVoid(false);
      onVoided?.();
    } catch (err) {
      console.error("Void order failed", err);
      setVoidError(STRINGS.voidFailed[language]);
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className={`order-row ${isVoided ? "is-voided" : ""}`}>
      <button type="button" className="order-row__summary" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {/* Icon avatar, one per row — the "real transaction list" look this
            was missing (every row previously started straight at the time
            text). Distinguishes payment method by icon shape; WorkerDot
            keeps colour to itself, see PaymentIcon's own comment on why. */}
        <span className={`order-row__icon order-row__icon--${order.paymentMethod}`} aria-hidden="true">
          <PaymentIcon method={order.paymentMethod} />
        </span>
        <div className="order-row__summary-left">
          <span className="order-row__time-line">
            <WorkerDot name={order.billedByName} />
            <span className="order-row__time">
              {order.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </span>
          </span>
          <span className="order-row__meta">
            {itemCount} {itemCount === 1 ? STRINGS.item[language] : STRINGS.items[language]} ·{" "}
            {PAYMENT_LABEL[order.paymentMethod][language]}
            {/* Who a credit bill is on account for, right in the collapsed
                row — this is the one payment method where "how was it
                settled" isn't the point, "who still owes for it" is. */}
            {order.paymentMethod === "credit" && order.customerName ? ` · ${order.customerName}` : ""}
          </span>
          {isVoided && <span className="order-row__voided-badge">{STRINGS.voided[language]}</span>}
        </div>
        <span className="order-row__total">{formatCurrency(order.total)}</span>
        <span className={`order-row__chevron ${expanded ? "is-expanded" : ""}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {expanded && (
        <div className="order-row__details">
          <ul>
            {order.items.map((item, index) => (
              <li key={index}>
                <div className="order-row__item-line">
                  <span>
                    {item.qty}x {translateItemName(item, language)}
                  </span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </div>
                {item.note && (
                  <p className="order-row__item-note">
                    {STRINGS.note[language]}: {item.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {/* The dot in the collapsed row is the quick-scan version of this —
              spelled out here for anyone who doesn't have the colour
              legend memorised. Absent on orders taken before the shift
              picker existed. */}
          {order.billedByName && (
            <div className="order-row__discount-line">
              <span>{STRINGS.billedBy[language]}</span>
              <span>{order.billedByName}</span>
            </div>
          )}
          {/* Only orders taken before discounts were dropped carry one. */}
          {order.discount > 0 && (
            <div className="order-row__discount-line">
              <span>{STRINGS.discount[language]}</span>
              <span>−{formatCurrency(order.discount)}</span>
            </div>
          )}
          {order.paymentMethod === "credit" && order.customerName && (
            <div className="order-row__discount-line">
              <span>{STRINGS.onAccount[language]}</span>
              <span>{order.customerName}</span>
            </div>
          )}
          {order.paymentMethod === "split" && (
            <div className="order-row__split">
              <div className="order-row__split-line">
                <span>{STRINGS.gpay[language]}</span>
                <span>{formatCurrency(order.upiAmount ?? 0)}</span>
              </div>
              <div className="order-row__split-line">
                <span>{STRINGS.cash[language]}</span>
                <span>{formatCurrency(order.cashAmount ?? 0)}</span>
              </div>
            </div>
          )}

          {/* This screen's own void button, unrestricted by time — the
              owner's separate, any-order-any-age path (see firestore.rules).
              The Worker app has its own, narrower version of this same
              action (RecentBillsModal: last 3 bills, 24-hour window),
              which is why the rule now accepts either actor rather than
              gating void to owner alone. */}
          {!isVoided && (
            <button type="button" className="order-row__void" onClick={() => setConfirmingVoid(true)}>
              {STRINGS.voidAction[language]}
            </button>
          )}
          {voidError && <p className="order-row__void-error">{voidError}</p>}
        </div>
      )}

      {confirmingVoid && (
        <ConfirmDialog
          title={STRINGS.voidTitle[language]}
          message={STRINGS.voidMessage[language]}
          confirmLabel={voiding ? undefined : STRINGS.voidConfirm[language]}
          destructive
          onConfirm={handleVoidConfirm}
          onCancel={() => setConfirmingVoid(false)}
        />
      )}
    </div>
  );
}
