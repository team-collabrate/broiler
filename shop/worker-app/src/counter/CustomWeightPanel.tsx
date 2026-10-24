import { useState } from "react";
import { applyRateKey, BACKSPACE_KEY, CLEAR_KEY, formatMoney, lineTotalMinor, parseRateInput, type OrderLineInput } from "@kumbakonam/shared/core";
import { Keypad } from "./Keypad";
import { t } from "./strings";

/** The id this line goes on the bill under. It is not a menu item: the staff type the weight and the rate. */
const CUSTOM_ID = "live-weight";

const WEIGHT_INPUT = /^\d{0,2}(\.\d{0,3})?$/;

/** One keypad press on a weight in kilograms (up to 2 digits and 3 decimals). */
function applyWeightKey(prev: string, key: string): string {
  if (key === BACKSPACE_KEY) return prev.slice(0, -1);
  if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : `${prev}.`;
  if (!/^\d$/.test(key)) return prev;
  if (prev === "0") return key === "0" ? prev : key;
  const next = prev + key;
  return WEIGHT_INPUT.test(next) ? next : prev;
}

/** `1.25` kg -> 1250 g; null when empty or zero. */
function parseKg(text: string): number | null {
  if (text === "" || text === ".") return null;
  const grams = Math.round(parseFloat(text) * 1000);
  return grams > 0 ? grams : null;
}

/**
 * For anything sold by weight at a price set on the spot (a home-grown live bird, "uyir edai"): type the weight in
 * kilograms and the rate per kilogram on the keypad, see the amount, and add it to the bill. It sits under the Others cards.
 */
export function CustomWeightPanel({ onAdd }: { onAdd: (line: OrderLineInput) => void }) {
  const [field, setField] = useState<"weight" | "rate">("weight");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");

  const grams = parseKg(weight);
  const rateMinor = parseRateInput(rate);
  const ready = grams !== null && rateMinor !== null;
  const press = (key: string) => {
    if (key === CLEAR_KEY) return field === "weight" ? setWeight("") : setRate("");
    return field === "weight" ? setWeight((p) => applyWeightKey(p, key)) : setRate((p) => applyRateKey(p, key));
  };
  const add = () => {
    if (grams === null || rateMinor === null) return;
    onAdd({ itemId: CUSTOM_ID, name: t.customWeightName, category: "other", unit: "kg", rateMinor, listRateMinor: rateMinor, grams, qty: 0 });
    setWeight("");
    setRate("");
    setField("weight");
  };

  return (
    <section className="ct-wbox" aria-label={t.customWeightName}>
      <div className="ct-wbox__form">
        <h3 className="ct-wbox__title">{t.customWeightName}</h3>
        <button type="button" className={`ct-wbox__field${field === "weight" ? " is-active" : ""}`} aria-pressed={field === "weight"} onClick={() => setField("weight")}>
          <span>{t.customWeight}</span>
          <strong>
            {weight === "" ? "0" : weight}
            <small> kg</small>
          </strong>
        </button>
        <button type="button" className={`ct-wbox__field${field === "rate" ? " is-active" : ""}`} aria-pressed={field === "rate"} onClick={() => setField("rate")}>
          <span>{t.customRate}</span>
          <strong>₹{rate === "" ? "0" : rate}</strong>
        </button>
        <div className="ct-wbox__amount">
          <span>{t.customAmount}</span>
          <strong>{ready ? formatMoney(lineTotalMinor(rateMinor, grams)) : "₹0"}</strong>
        </div>
        <button type="button" className="ct-btn ct-btn--primary ct-wbox__add" disabled={!ready} onClick={add}>
          {t.customAdd}
        </button>
      </div>
      <div className="ct-wbox__pad">
        <Keypad leftKey="." onKey={press} />
      </div>
    </section>
  );
}
