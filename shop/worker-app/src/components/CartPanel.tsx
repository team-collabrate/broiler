import { ConfirmDialog, formatCurrency, useLanguage, type PaymentMethod } from "@kumbakonam/shared";
import type { UseCartResult } from "../hooks/useCart";
import type { UseOrderSubmitResult } from "../hooks/useOrderSubmit";
import { CartLineItem } from "./CartLineItem";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import "./CartPanel.css";

const STRINGS = {
  clearTitle: { en: "Clear cart?", ta: "கார்ட்டை காலி செய்யவா?" },
  clearMessage: {
    en: "This removes every item from the current order. This can't be undone.",
    ta: "இது தற்போதைய ஆர்டரில் உள்ள அனைத்துப் பொருட்களையும் நீக்கும். இதை மீட்க முடியாது.",
  },
  clearConfirm: { en: "Clear Cart", ta: "கார்ட்டை காலி செய்" },
  emptyTitle: { en: "No items yet", ta: "இன்னும் பொருட்கள் இல்லை" },
  empty: { en: "Tap a menu item to add it.", ta: "சேர்க்க ஒரு மெனு பொருளைத் தட்டவும்." },
  total: { en: "Total", ta: "மொத்தம்" },
  gpay: { en: "GPay", ta: "GPay" },
  onAccount: { en: "On account", ta: "கடன்" },
  cash: { en: "Cash", ta: "ரொக்கம்" },
  saving: { en: "Saving…", ta: "சேமிக்கிறது…" },
  save: { en: "Save", ta: "சேமி" },
  printBill: { en: "Print Bill", ta: "பில் அச்சிடு" },
  needItems: { en: "Add items to start", ta: "பொருட்களைச் சேர்க்கவும்" },
  needPayment: { en: "Choose how to pay", ta: "பணம் செலுத்தும் முறையைத் தேர்வுசெய்" },
};

export interface CartPanelProps {
  cart: UseCartResult;
  orderSubmit: UseOrderSubmitResult;
  /** Set by the Backspace/Delete keyboard shortcut — there's no on-screen
   *  Clear button any more, but the confirm dialog it opens still shows here. */
  confirmingClear: boolean;
  onCancelClear: () => void;
  /** Lifted to WorkerHome so the S shortcut and the button both open the split dialog. */
  onSelectPayment: (method: PaymentMethod) => void;
}

export function CartPanel({
  cart,
  orderSubmit,
  confirmingClear,
  onCancelClear,
  onSelectPayment,
}: CartPanelProps) {
  const { language } = useLanguage();

  /**
   * What's stopping the order going through. Used as the button's own label
   * rather than left for the worker to deduce — a dimmed button that doesn't
   * say why it's dimmed is the thing people tap twice and then give up on.
   */
  const blocker = cart.isEmpty ? "needItems" : !cart.paymentMethod ? "needPayment" : null;
  const submitLabel = orderSubmit.submitting
    ? STRINGS.saving[language]
    : blocker
      ? STRINGS[blocker][language]
      : STRINGS.printBill[language];

  return (
    <div className="cart-panel">
      {confirmingClear && (
        <ConfirmDialog
          title={STRINGS.clearTitle[language]}
          message={STRINGS.clearMessage[language]}
          confirmLabel={STRINGS.clearConfirm[language]}
          destructive
          onConfirm={() => {
            cart.clearCart();
            onCancelClear();
          }}
          onCancel={onCancelClear}
        />
      )}

      <div className={`cart-panel__lines ${cart.isEmpty ? "is-empty" : ""}`}>
        {cart.isEmpty ? (
          /* Centred, with a mark — an empty panel that says nothing reads as
             a screen that failed to load rather than an order not started. */
          <div className="cart-panel__empty">
            <svg className="cart-panel__empty-mark" viewBox="0 0 48 48" aria-hidden="true">
              <path
                d="M12 8h24a2 2 0 0 1 2 2v30l-5-3-4 3-4-3-4 3-4-3-5 3V10a2 2 0 0 1 2-2Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M18 18h12M18 25h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="cart-panel__empty-title">{STRINGS.emptyTitle[language]}</p>
            <p className="cart-panel__empty-hint">{STRINGS.empty[language]}</p>
          </div>
        ) : (
          <ul className="cart-panel__list">
            {cart.lines.map((line) => (
              <CartLineItem key={line.itemId} line={line} onRemove={cart.removeLine} />
            ))}
          </ul>
        )}
      </div>

      <div className="cart-panel__footer">
        {/* Nothing to pay for yet — offering a method (and opening the split or
            credit dialog on a ₹0 bill) would be a control that leads nowhere. */}
        <PaymentMethodSelect
          value={cart.paymentMethod}
          onChange={onSelectPayment}
          disabled={cart.isEmpty}
        />

        {/* Subtotal was dropped: with no discounts it always equalled the
            total, so it repeated the one figure that matters. */}
        <dl className="cart-panel__totals">
          {cart.paymentMethod === "credit" && cart.creditCustomer && (
            <div className="cart-panel__note-row">
              <dt>{STRINGS.onAccount[language]}</dt>
              <dd>{cart.creditCustomer.name}</dd>
            </div>
          )}
          {cart.paymentMethod === "split" && (
            <>
              <div className="cart-panel__note-row">
                <dt>{STRINGS.gpay[language]}</dt>
                <dd>{formatCurrency(cart.splitUpiAmount)}</dd>
              </div>
              <div className="cart-panel__note-row">
                <dt>{STRINGS.cash[language]}</dt>
                <dd>{formatCurrency(cart.splitCashAmount)}</dd>
              </div>
            </>
          )}
          <div className="cart-panel__total-row">
            <dt>{STRINGS.total[language]}</dt>
            <dd>{formatCurrency(cart.total)}</dd>
          </div>
        </dl>

        {/* Errors interrupt; a success line does not. role=alert on both would
            make every saved order shout at a screen reader. Only mounted
            when there's something to say — an empty placeholder here used
            to reserve a fixed 18px plus a gap on each side permanently,
            which read as the dead space under the total. */}
        {(orderSubmit.error || orderSubmit.successMessage) && (
          <div
            className={`cart-panel__status ${orderSubmit.error ? "is-error" : "is-success"}`}
            role={orderSubmit.error ? "alert" : "status"}
          >
            {orderSubmit.error ?? orderSubmit.successMessage}
          </div>
        )}

        <div className="cart-panel__actions">
          <button
            type="button"
            className="cart-panel__save"
            onClick={() => orderSubmit.submit(false)}
            disabled={orderSubmit.submitting || Boolean(blocker)}
            aria-label={STRINGS.save[language]}
            title={STRINGS.save[language]}
          >
            {/* Rounded download-into-tray mark — records the order without
                sending anything to the printer. */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v10M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            className={`cart-panel__print ${blocker ? "is-waiting" : ""}`}
            onClick={() => orderSubmit.submit(true)}
            disabled={orderSubmit.submitting || Boolean(blocker)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9V3h12v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="4" y="9" width="16" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 17v4h12v-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
