import { useState } from "react";
import { applyRupeesKey, BACKSPACE_KEY, CLEAR_KEY, parseRupeesInput, type OrderLineInput } from "@kumbakonam/shared/core";
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
 * For a bird sold at a price set on the spot (home-grown, "uyir edai"): type its weight in kilograms (1.350) and the
 * price fixed for that whole bird, in rupees. The line charges exactly that price; the per-kilo rate on it is only
 * worked out from the two. It sits under the Others cards.
 */
export function CustomWeightPanel({ onAdd, span = 3 }: { onAdd: (line: OrderLineInput) => void; span?: number }) {
  const [field, setField] = useState<"weight" | "rate">("weight");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");

  const grams = parseKg(weight);
  const amountMinor = rate === "" ? null : parseRupeesInput(rate);
  const ready = grams !== null && amountMinor !== null;
  const press = (key: string) => {
    if (key === CLEAR_KEY) return field === "weight" ? setWeight("") : setRate("");
    if (field === "rate") return setRate((p) => applyRupeesKey(p, key));
    const next = applyWeightKey(weight, key);
    setWeight(next);
    // Three decimals is as fine as the weight goes: on to the price.
    if (/\.\d{3}$/.test(next)) setField("rate");
  };
  const add = () => {
    if (grams === null || amountMinor === null) return;
    const rateMinor = Math.max(1, Math.round((amountMinor * 1000) / grams));
    onAdd({ itemId: CUSTOM_ID, name: t.customWeightName, category: "other", unit: "kg", rateMinor, listRateMinor: rateMinor, grams, qty: 0, amountMinor });
    setWeight("");
    setRate("");
    setField("weight");
  };

  return (
    <section className="ct-wbox" aria-label={t.customWeightName} style={{ gridColumn: `span ${span}` }}>
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
        <button type="button" className="ct-btn ct-btn--primary ct-wbox__add" disabled={!ready} onClick={add}>
          {t.customAdd}
          {ready && (
            <span className="ct-wbox__sum">
              {weight} kg · ₹{rate}
            </span>
          )}
        </button>
      </div>
      <div className="ct-wbox__pad">
        <Keypad leftKey={field === "weight" ? "." : "C"} onKey={press} />
      </div>
    </section>
  );
}
