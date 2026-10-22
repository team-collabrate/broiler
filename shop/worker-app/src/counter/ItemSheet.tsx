import { useEffect, useMemo, useState } from "react";
import {
  ADJUST_STEP_MINOR,
  adjustmentMinor,
  applyRupeesKey,
  CLEAR_KEY,
  clampRate,
  CURRENCY_SYMBOL,
  formatMoney,
  gramsForAmount,
  itemName,
  lineTotalMinor,
  MAX_QTY,
  MIN_GRAMS,
  parseRupeesInput,
  pieceTotalMinor,
  splitGrams,
  WEIGHT_STEP_GRAMS,
  type CartLine,
  type MenuItem,
  type Method,
  type OrderLineInput,
} from "@kumbakonam/shared/core";
import { formatQty, formatRate, formatWeight } from "./fmt";
import { Keypad } from "./Keypad";
import { t } from "./strings";
import { WheelPicker } from "./WheelPicker";

const MAX_KG = 30;
const KG_VALUES = Array.from({ length: MAX_KG + 1 }, (_, i) => String(i));
const GRAM_VALUES = Array.from({ length: 1000 / WEIGHT_STEP_GRAMS }, (_, i) => String(i * WEIGHT_STEP_GRAMS).padStart(3, "0"));
const QTY_VALUES = Array.from({ length: MAX_QTY }, (_, i) => String(i + 1));
const QUICK_AMOUNTS = [100, 200, 500];

const METHOD_LABEL: Record<Method, string> = { weight: t.methodWeight, amount: t.methodAmount, qty: t.methodQty };

interface Props {
  item: MenuItem;
  /** When editing a cart line: its current values fill the sheet. */
  editing?: CartLine;
  /** How far the counter may move the rate from the list rate, in paise. */
  maxAdjustMinor: number;
  onCancel: () => void;
  /** The finished line. For an edit, the caller replaces the old line with it. */
  onConfirm: (line: OrderLineInput) => void;
}

/** Which method an existing line was billed by. */
function methodOf(line: CartLine): Method {
  if (line.amountMinor !== undefined) return "amount";
  return line.unit === "piece" ? "qty" : "weight";
}

/** A − / + pair around a value, for the rate and for the optional count. */
function Stepper({ onMinus, onPlus, minusDisabled, plusDisabled, minusLabel, plusLabel, children }: {
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
  minusLabel: string;
  plusLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ct-stepper">
      <button type="button" className="ct-step" aria-label={minusLabel} disabled={minusDisabled} onClick={onMinus}>
        −
      </button>
      <div className="ct-stepper__value">{children}</div>
      <button type="button" className="ct-step" aria-label={plusLabel} disabled={plusDisabled} onClick={onPlus}>
        +
      </button>
    </div>
  );
}

/**
 * The popup for one product. Pick how to bill it (weight-wise, rate-wise, or by count, whichever the owner
 * switched on for this product), enter the values, check the summary, then Add to Bill. Only the methods
 * configured for the product show; a product with one method shows no choice.
 */
export function ItemSheet({ item, editing, maxAdjustMinor, onCancel, onConfirm }: Props) {
  const isPiece = item.unit === "piece";
  const [method, setMethod] = useState<Method>(() =>
    editing && item.methods.includes(methodOf(editing)) ? methodOf(editing) : item.methods[0],
  );
  const [grams, setGrams] = useState(() => {
    const start = editing && editing.unit === "kg" && editing.amountMinor === undefined ? editing.grams : item.defaultGrams;
    return splitGrams(start, MAX_KG) ? Math.round(start / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS : MAX_KG * 1000;
  });
  const [qty, setQty] = useState(() => (editing && editing.unit === "piece" && editing.amountMinor === undefined ? editing.qty : item.defaultQty));
  const [amountText, setAmountText] = useState(() => (editing?.amountMinor !== undefined ? String(editing.amountMinor / 100) : ""));
  // Pieces billed by amount carry an optional count (1 when not set).
  const [amountQty, setAmountQty] = useState(() => (editing?.amountMinor !== undefined && editing.unit === "piece" ? editing.qty : 1));
  const [rate, setRate] = useState(() => (editing ? clampRate(editing.rateMinor, item.rateMinor, maxAdjustMinor) : item.rateMinor));

  const list = item.rateMinor;
  const parts = splitGrams(grams, MAX_KG) ?? { kg: MAX_KG, gramsPart: 0 };
  const amountMinor = parseRupeesInput(amountText);

  // What this entry will add, or null while it is not yet valid.
  const line = useMemo((): OrderLineInput | null => {
    const base = { itemId: item.id, name: itemName(item), category: item.category, unit: item.unit, listRateMinor: list };
    if (method === "weight") return grams >= MIN_GRAMS ? { ...base, rateMinor: rate, grams, qty: 0 } : null;
    if (method === "qty") return qty >= 1 ? { ...base, rateMinor: rate, grams: 0, qty } : null;
    if (amountMinor === null) return null;
    if (isPiece) return { ...base, rateMinor: list, grams: 0, qty: amountQty, amountMinor };
    const weighed = gramsForAmount(amountMinor, list);
    return weighed >= 1 ? { ...base, rateMinor: list, grams: weighed, qty: 0, amountMinor } : null;
  }, [method, item, list, rate, grams, qty, amountMinor, amountQty, isPiece]);

  const total = line === null ? 0 : method === "weight" ? lineTotalMinor(rate, grams) : method === "qty" ? pieceTotalMinor(rate, qty) : (amountMinor ?? 0);

  const detail =
    method === "weight"
      ? `${formatWeight(grams)} × ${formatRate(rate, "kg")}`
      : method === "qty"
        ? `${formatQty(qty)} × ${formatRate(rate, "piece")}`
        : isPiece
          ? formatQty(amountQty)
          : line
            ? `≈ ${formatWeight(line.grams)}`
            : "—";

  const adjusted = adjustmentMinor({ rateMinor: rate, listRateMinor: list });
  const canAdjust = maxAdjustMinor > 0;
  const setGramsParts = (kg: number, g: number) => setGrams(kg * 1000 + g);

  // Escape closes the popup; the page behind does not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ct-sheet" role="dialog" aria-modal="true" aria-label={itemName(item)}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{itemName(item)}</h2>
            <span className="ct-sheet__sub">{formatRate(list, item.unit)}</span>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.cancel} onClick={onCancel}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          {item.methods.length > 1 && (
            <div className="ct-methods" role="radiogroup">
              {item.methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={m === method}
                  className={`ct-method${m === method ? " is-on" : ""}`}
                  onClick={() => setMethod(m)}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          )}

          {method === "weight" && (
            <div className="ct-wheels">
              <WheelPicker values={KG_VALUES} index={parts.kg} onChange={(kg) => setGramsParts(kg, parts.gramsPart)} caption={t.kg} ariaLabel={t.kg} />
              <span className="ct-wheels__dot">.</span>
              <WheelPicker
                values={GRAM_VALUES}
                index={parts.gramsPart / WEIGHT_STEP_GRAMS}
                onChange={(i) => setGramsParts(parts.kg, i * WEIGHT_STEP_GRAMS)}
                caption={t.gramsUnit}
                ariaLabel={t.gramsUnit}
              />
            </div>
          )}

          {method === "qty" && (
            <div className="ct-wheels">
              <WheelPicker values={QTY_VALUES} index={Math.min(Math.max(qty, 1), MAX_QTY) - 1} onChange={(i) => setQty(i + 1)} caption={t.quantity} ariaLabel={t.quantity} />
            </div>
          )}

          {method === "amount" && (
            <div className="ct-amount">
              <div className="ct-amount__display">
                <span className="ct-amount__value" aria-label={`${amountText || "0"} rupees`}>
                  {CURRENCY_SYMBOL}
                  {amountText || "0"}
                </span>
                <span className="ct-amount__hint">{isPiece ? "" : line ? `≈ ${formatWeight(line.grams)}` : "—"}</span>
              </div>
              <div className="ct-amount__entry">
                <Keypad leftKey="C" onKey={(k) => setAmountText((prev) => (k === CLEAR_KEY ? "" : applyRupeesKey(prev, k)))} />
                <div className="ct-amount__quick">
                  {QUICK_AMOUNTS.map((rupees) => (
                    <button
                      key={rupees}
                      type="button"
                      className={`ct-chip${amountText === String(rupees) ? " is-on" : ""}`}
                      onClick={() => setAmountText(String(rupees))}
                    >
                      {CURRENCY_SYMBOL}
                      {rupees}
                    </button>
                  ))}
                </div>
              </div>
              {isPiece && (
                <div className="ct-optional">
                  <span>{t.qtyOptional}</span>
                  <Stepper
                    onMinus={() => setAmountQty((q) => Math.max(q - 1, 1))}
                    onPlus={() => setAmountQty((q) => Math.min(q + 1, MAX_QTY))}
                    minusDisabled={amountQty <= 1}
                    plusDisabled={amountQty >= MAX_QTY}
                    minusLabel={t.decreaseQty}
                    plusLabel={t.increaseQty}
                  >
                    <strong>{amountQty}</strong>
                  </Stepper>
                </div>
              )}
            </div>
          )}

          {method !== "amount" && (
            <div className="ct-rate">
              <span className="ct-rate__label">{t.rate}</span>
              <Stepper
                onMinus={() => setRate((r) => clampRate(r - ADJUST_STEP_MINOR, list, maxAdjustMinor))}
                onPlus={() => setRate((r) => clampRate(r + ADJUST_STEP_MINOR, list, maxAdjustMinor))}
                minusDisabled={!canAdjust || rate - list <= -maxAdjustMinor || rate <= ADJUST_STEP_MINOR}
                plusDisabled={!canAdjust || rate - list >= maxAdjustMinor}
                minusLabel={t.adjustDown(formatMoney(ADJUST_STEP_MINOR))}
                plusLabel={t.adjustUp(formatMoney(ADJUST_STEP_MINOR))}
              >
                <strong className="ct-rate__text">{formatRate(rate, item.unit)}</strong>
                <span className={`ct-rate__note${adjusted !== 0 ? " is-changed" : ""}`}>
                  {!canAdjust
                    ? t.rateLocked
                    : adjusted !== 0
                      ? `${t.listRate(formatRate(list, item.unit))} · ${adjusted > 0 ? "+" : "−"}${formatMoney(Math.abs(adjusted))}`
                      : t.adjustLimit(formatMoney(maxAdjustMinor))}
                </span>
              </Stepper>
            </div>
          )}
        </div>

        <div className="ct-summary" aria-live="polite">
          <div className="ct-summary__text">
            <span className="ct-summary__method">{METHOD_LABEL[method]}</span>
            <span className="ct-summary__detail">{detail}</span>
          </div>
          <span className="ct-summary__total">{formatMoney(total)}</span>
        </div>

        <footer className="ct-sheet__actions">
          <button type="button" className="ct-btn ct-btn--plain" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="ct-btn ct-btn--primary" disabled={line === null} onClick={() => line && onConfirm(line)}>
            {editing ? t.updateLine : t.addToBill}
          </button>
        </footer>
      </div>
    </div>
  );
}
