import { useRef, useState } from "react";
import { CURRENCY_SYMBOL, formatMoney, itemName, type MenuItem, type OrderLineInput } from "@kumbakonam/shared/core";
import { unitSuffix } from "./fmt";
import { productImageUrl } from "./images";
import { t } from "./strings";

/** `₹260` for a whole-rupee rate, `₹260.50` when it has paise. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

/** How long a finger must stay down to count as a long press. */
const LONG_PRESS_MS = 500;

/** What one tap puts on the bill: the item's usual count (or weight), at today's rate. */
function usualLine(item: MenuItem): OrderLineInput {
  const base = { itemId: item.id, name: itemName(item), category: item.category, unit: item.unit, rateMinor: item.rateMinor, listRateMinor: item.rateMinor };
  return item.unit === "piece"
    ? { ...base, grams: 0, qty: Math.max(1, item.defaultQty) }
    : { ...base, grams: item.defaultGrams, qty: 0, packGrams: item.defaultGrams, packs: 1 };
}

function ItemCard({ item, onAdd, onCustomize }: { item: MenuItem; onAdd: (line: OrderLineInput) => void; onCustomize: (item: MenuItem) => void }) {
  const [photo, setPhoto] = useState<"loading" | "ok" | "missing">("loading");
  // The product's own photo first; failing that, the kind photo (public/families/<group>.jpg).
  const ownPhoto = productImageUrl(item);
  const [src, setSrc] = useState(ownPhoto);
  const timer = useRef<number>();
  const longPressed = useRef(false);
  const [added, setAdded] = useState(false);
  const startPress = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onCustomize(item);
    }, LONG_PRESS_MS);
  };
  const endPress = () => window.clearTimeout(timer.current);
  const tap = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    // No rate yet: there is nothing to add, so the sheet opens (it asks for the rate).
    if (item.rateMinor <= 0) return onCustomize(item);
    onAdd(usualLine(item));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 350);
  };
  const rate = item.rateMinor > 0 ? `${shortRate(item.rateMinor)}${unitSuffix(item.unit)}` : t.setRate;
  return (
    <button
      type="button"
      className={`ct-icard${added ? " is-added" : ""}`}
      aria-label={`${itemName(item)}, ${rate}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={tap}
    >
      {photo !== "missing" && (
        <span className="ct-icard__pic" hidden={photo !== "ok"}>
          <img src={src} alt="" draggable={false} onLoad={() => setPhoto("ok")} onError={() => (src === ownPhoto ? setSrc(`/families/${encodeURIComponent(item.group)}.jpg`) : setPhoto("missing"))} />
        </span>
      )}
      <span className="ct-icard__name">{itemName(item)}</span>
      <span className="ct-icard__row">
        <span className="ct-icard__rate">{rate}</span>
        <span className="ct-icard__add" aria-hidden="true">
          +
        </span>
      </span>
    </button>
  );
}

/** Plain cards: a tap adds the usual count to the bill, a long press opens the sheet to change the count or weight. */
export function ItemCards({ items, onAdd, onCustomize }: { items: MenuItem[]; onAdd: (line: OrderLineInput) => void; onCustomize: (item: MenuItem) => void }) {
  return (
    <>
      <div className="ct-icards">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onAdd={onAdd} onCustomize={onCustomize} />
        ))}
      </div>
      <p className="ct-hint ct-icards__hint">{t.othersHint}</p>
    </>
  );
}
