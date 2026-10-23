import { adjustmentMinor, formatMoney, orderLineTotalMinor, type CartLine, type PaymentMethod } from "@kumbakonam/shared/core";
import { describeLine, formatRate, formatTotals } from "./fmt";
import { t } from "./strings";

/** The words on the payment buttons: Tamil for cash, credit and split, UPI as it is. */
const PAY_LABEL: Record<PaymentMethod, string> = { cash: "பணம்", upi: "UPI", card: "கார்டு", split: "பணம் + UPI", credit: "கடன்" };

/** The four payment buttons, in the order of the counter sketch: cash and UPI, then kadan (credit) and split. */
const PAYMENT_GRID: PaymentMethod[] = ["cash", "upi", "credit", "split"];

interface Props {
  lines: CartLine[];
  /** What the customer pays: the lines' sum, rounded to ten rupees when round-off is on. */
  totalMinor: number;
  /** The flat discount on the bill, in paise (0 for none), and a way to open the sheet that sets it. */
  discountMinor: number;
  onDiscount: () => void;
  /** Round-off is switched on, and by how much it changed the total (negative when rounded down). */
  roundOn: boolean;
  roundOffMinor: number;
  onRoundChange: (on: boolean) => void;
  totalGrams: number;
  totalPieces: number;
  paymentMethod: PaymentMethod;
  /** Equal packs stay packs (2 × 250 g) when ticked; unticked they add up (500 g). */
  keepPacks: boolean;
  onKeepPacksChange: (on: boolean) => void;
  onPaymentChange: (method: PaymentMethod) => void;
  /** The workers who bill here, and which one is billing now. */
  /** What a split or credit choice came to, shown on its button (null until chosen). */
  paymentDetail: { split: string | null; credit: string | null };
  submitting: boolean;
  /** A short message above the list: the order is full, the last save failed, or the last bill printed. */
  notice: { text: string; tone: "info" | "error" } | null;
  onDismissNotice: () => void;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  /** Saves the sale, then prints the bill. */
  onPrintBill: () => void;
  /** Saves the sale without printing it. */
  onSaveBill: () => void;
  logoUrl: string;
}

/**
 * The cart column: the bill so far on top, then the total, Print bill, and the payment buttons. Each line shows
 * what was sold, its rate and total, with Edit (reopens the product sheet with the line's values) and Remove.
 */
export function BillCart({
  lines,
  totalMinor,
  discountMinor,
  onDiscount,
  roundOn,
  roundOffMinor,
  onRoundChange,
  totalGrams,
  totalPieces,
  paymentMethod,
  keepPacks,
  onKeepPacksChange,
  onPaymentChange,
  paymentDetail,
  submitting,
  notice,
  onDismissNotice,
  onEdit,
  onRemove,
  onPrintBill,
  onSaveBill,
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

      <label className="ct-packs">
        <input type="checkbox" checked={keepPacks} disabled={submitting} onChange={(e) => onKeepPacksChange(e.target.checked)} />
        <span className="ct-packs__text">
          <strong>{t.keepPacks}</strong>
        </span>
      </label>

      <div className="ct-round">
        <span className="ct-round__label">{t.roundTo}</span>
        <button type="button" role="switch" aria-checked={roundOn} aria-label={t.roundTo} className={`ct-toggle${roundOn ? " is-on" : ""}`} disabled={submitting} onClick={() => onRoundChange(!roundOn)}>
          <span className="ct-toggle__knob" aria-hidden="true" />
          <span className="ct-toggle__text">{roundOn ? t.on : t.off}</span>
        </button>
      </div>
      {discountMinor > 0 && (
        <div className="ct-cart__roundoff">
          <span>{t.discount}</span>
          <span>-{formatMoney(discountMinor)}</span>
        </div>
      )}
      {roundOn && roundOffMinor !== 0 && (
        <div className="ct-cart__roundoff">
          <span>{t.roundOff}</span>
          <span>
            {roundOffMinor > 0 ? "+" : "-"}
            {formatMoney(Math.abs(roundOffMinor))}
          </span>
        </div>
      )}

      <div className="ct-cart__total">
        <span>{t.total(formatTotals(totalGrams, totalPieces))}</span>
        <span className="ct-cart__amount">
          <button type="button" className={`ct-penbtn${discountMinor > 0 ? " is-set" : ""}`} aria-label={t.discountTitle} disabled={submitting || lines.length === 0} onClick={onDiscount}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
            </svg>
          </button>
          <strong>{formatMoney(totalMinor)}</strong>
        </span>
      </div>

      <div className="ct-printrow">
        <button type="button" className="ct-btn ct-btn--primary ct-btn--big" disabled={!canPrint} onClick={onPrintBill}>
          {submitting ? t.saving : t.printBill(formatMoney(totalMinor))}
        </button>
        <button type="button" className="ct-savebtn" disabled={!canPrint} onClick={onSaveBill}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {t.save}
        </button>
      </div>

      <div className="ct-pay" role="radiogroup" aria-label={t.payWith}>
        {PAYMENT_GRID.map((method) => {
          const detail = method === "split" ? paymentDetail.split : method === "credit" ? paymentDetail.credit : null;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={method === paymentMethod}
              disabled={submitting}
              className={`ct-pay__chip is-${method}${method === paymentMethod ? " is-on" : ""}`}
              onClick={() => onPaymentChange(method)}
            >
              <span className="ct-pay__label">{PAY_LABEL[method]}</span>
              {detail && method === paymentMethod && <small>{detail}</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
