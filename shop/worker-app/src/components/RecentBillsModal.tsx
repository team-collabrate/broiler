import { useState } from "react";
import { ConfirmDialog, formatCurrency, useLanguage, voidOrder, type Language, type Order } from "@kumbakonam/shared";
import "./RecentBillsModal.css";

const PAYMENT_LABEL: Record<Order["paymentMethod"], Record<Language, string>> = {
  cash: { en: "Cash", ta: "பணம்" },
  upi: { en: "UPI", ta: "UPI" },
  split: { en: "Split", ta: "பிரித்து" },
  credit: { en: "Credit", ta: "கடன்" },
  card: { en: "Card", ta: "கார்டு" },
};

const STRINGS = {
  title: { en: "Delete a recent bill", ta: "சமீபத்திய பில்லை நீக்கு" },
  subtitle: {
    en: "Only the last 3 bills, and only until the end of the day — after that, ask the owner to void it.",
    ta: "கடைசி 3 பில்கள் மட்டும், அன்றைய நாள் முடிவதற்குள் மட்டும் — அதன் பிறகு உரிமையாளரிடம் ரத்துசெய்யக் கேளுங்கள்.",
  },
  empty: { en: "No recent bills.", ta: "சமீபத்திய பில்கள் இல்லை." },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  delete: { en: "Delete", ta: "நீக்கு" },
  deleteTitle: { en: "Delete this bill?", ta: "இந்த பில்லை நீக்கவா?" },
  deleteMessage: {
    en: "This can't be undone from here. The bill still shows in the owner's app, marked deleted, but the money no longer counts anywhere.",
    ta: "இதை இங்கிருந்து மீட்க முடியாது. பில் உரிமையாளரின் ஆப்பில் இன்னும் தெரியும், நீக்கப்பட்டதாகக் காட்டப்படும், ஆனால் தொகை இனி எங்கும் கணக்கிடப்படாது.",
  },
  deleteConfirm: { en: "Delete Bill", ta: "பில்லை நீக்கு" },
  deleteFailed: {
    en: "Could not delete the bill. It may be from an earlier day now — ask the owner instead.",
    ta: "பில்லை நீக்க முடியவில்லை. இது முந்தைய நாளைச் சேர்ந்ததாக இருக்கலாம் — உரிமையாளரிடம் கேளுங்கள்.",
  },
  close: { en: "Close", ta: "மூடு" },
};

export interface RecentBillsModalProps {
  orders: Order[];
  loading: boolean;
  /** The signed-in account voiding the bill — see firestore.rules' 24-hour worker-void window. */
  workerId: string;
  onClose: () => void;
  /** Called after a successful void — refetches the caller's list, since
   *  it stopped being a live subscription (2026-09-09, see
   *  getRecentOrders's own comment). Without this the voided bill would
   *  stay showing here until the panel is closed and reopened. */
  onVoided?: () => void;
}

/** Sidebar panel: void one of the last 3 bills this device just took, in
 *  case of a mis-billed order — see subscribeToRecentOrders and
 *  firestore.rules for the "last 3, within 24 hours" limits this only
 *  displays, not enforces (the rule is the real boundary). */
export function RecentBillsModal({ orders, loading, workerId, onClose, onVoided }: RecentBillsModalProps) {
  const { language } = useLanguage();
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await voidOrder(deleting.orderId, workerId);
      setDeleting(null);
      onVoided?.();
    } catch (err) {
      console.error("Void order failed", err);
      setError(STRINGS.deleteFailed[language]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recent-bills__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <div className="recent-bills">
        <div>
          <h2 className="recent-bills__title">{STRINGS.title[language]}</h2>
          <p className="recent-bills__subtitle">{STRINGS.subtitle[language]}</p>
        </div>

        {loading ? (
          <p className="recent-bills__status">{STRINGS.loading[language]}</p>
        ) : orders.length === 0 ? (
          <p className="recent-bills__status">{STRINGS.empty[language]}</p>
        ) : (
          <ul className="recent-bills__list">
            {orders.map((order) => (
              <li key={order.orderId}>
                <div className="recent-bills__row-main">
                  {order.billNo != null && <span className="recent-bills__billno">#{order.billNo}</span>}
                  <span className="recent-bills__time">
                    {order.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="recent-bills__payment">{PAYMENT_LABEL[order.paymentMethod][language]}</span>
                </div>
                <span className="recent-bills__total">{formatCurrency(order.total)}</span>
                <button type="button" className="recent-bills__delete" onClick={() => setDeleting(order)}>
                  {STRINGS.delete[language]}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="recent-bills__error">{error}</p>}

        <div className="recent-bills__actions">
          <button type="button" className="recent-bills__close" onClick={onClose}>
            {STRINGS.close[language]}
          </button>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title={STRINGS.deleteTitle[language]}
          message={STRINGS.deleteMessage[language]}
          confirmLabel={busy ? undefined : STRINGS.deleteConfirm[language]}
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
