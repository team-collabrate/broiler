import {
  adjustmentMinor,
  describeLine,
  formatMoney,
  formatRate,
  formatTotals,
  orderLineTotalMinor,
  PAYMENT_LABELS,
  type CartLine,
  type PaymentMethod,
} from "@kumbakonam/shared/core";
import { t } from "./strings";

/** Cash and UPI work now; kadan (credit) and split arrive with the payments phase, so they are drawn but off. */
const PAYMENT_GRID: { method: PaymentMethod; available: boolean }[] = [
  { method: "cash", available: true },
  { method: "upi", available: true },
  { method: "credit", available: false },
  { method: "split", available: false },
];

interface Props {
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  totalPieces: number;
  paymentMethod: PaymentMethod;
  onPaymentChange: (method: PaymentMethod) => void;
  submitting: boolean;
  /** A short message above the list: the order is full, the last save failed, or the last bill printed. */
  notice: { text: string; tone: "info" | "error" } | null;
  onDismissNotice: () => void;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  /** Saves the sale, then prints the bill. */
  onPrintBill: () => void;
  logoUrl: string;
}

/**
 * The cart column: the bill so far on top, then the total, Print bill, and the payment buttons. Each line shows
 * what was sold, its rate and total, with Edit (reopens the product sheet with the line's values) and Remove.
 */
export function BillCart({
  lines,
  totalMinor,
  totalGrams,
  totalPieces,
  paymentMethod,
  onPaymentChange,
  submitting,
  notice,
  onDismissNotice,
  onEdit,
  onRemove,
  onPrintBill,
  logoUrl,
}: Props) {
  const canPrint = lines.length > 0 && !submitting;

  return (
    <section className="ct-cart" aria-label={t.currentSale}>
      <h2 className="ct-cart__heading">{t.currentSale}</h2>

      {notice && (
        <div className={`ct-notice ct-notice--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button type="button" aria-label={t.dismiss} onClick={onDismissNotice}>
            ✕
          </button>
        </div>
      )}

      <div className="ct-cart__list">
        {lines.length === 0 ? (
          <div className="ct-cart__empty">
            <img src={logoUrl} alt="" draggable={false} />
            <strong>{t.cartEmpty}</strong>
            <span>{t.cartEmptyHint}</span>
          </div>
        ) : (
          lines.map((line) => {
            const adjusted = adjustmentMinor(line);
            return (
              <div key={line.key} className="ct-line">
                <div className="ct-line__info">
                  <span className="ct-line__name">{line.name}</span>
                  <span className="ct-line__detail">{describeLine(line)}</span>
                  {adjusted !== 0 && (
                    <span className="ct-line__adjusted">
                      {t.listRate(formatRate(line.listRateMinor, line.unit))} · {adjusted > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(adjusted))}
                    </span>
                  )}
                </div>
                <span className="ct-line__total">{formatMoney(orderLineTotalMinor(line))}</span>
                <div className="ct-line__actions">
                  <button type="button" className="ct-icon-btn" aria-label={t.edit(line.name)} disabled={submitting} onClick={() => onEdit(line.key)}>
                    ✎
                  </button>
                  <button type="button" className="ct-icon-btn is-muted" aria-label={t.remove(line.name)} disabled={submitting} onClick={() => onRemove(line.key)}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="ct-cart__total">
        <span>{t.total(formatTotals(totalGrams, totalPieces))}</span>
        <strong>{formatMoney(totalMinor)}</strong>
      </div>

      <button type="button" className="ct-btn ct-btn--primary ct-btn--big" disabled={!canPrint} onClick={onPrintBill}>
        {submitting ? t.saving : t.printBill(formatMoney(totalMinor))}
      </button>

      <div className="ct-pay" role="radiogroup" aria-label={t.payWith}>
        {PAYMENT_GRID.map(({ method, available }) => (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={method === paymentMethod}
            disabled={!available || submitting}
            className={`ct-pay__chip${method === paymentMethod ? " is-on" : ""}${available ? "" : " is-off"}`}
            onClick={() => onPaymentChange(method)}
          >
            <span>{PAYMENT_LABELS[method]}</span>
            {!available && <small>{t.comingSoon}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
