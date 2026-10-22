import { useState } from "react";
import { CURRENCY_SYMBOL, formatMoney, itemName, type MenuItem } from "@kumbakonam/shared/core";
import { unitSuffix } from "./fmt";
import { productImageUrl } from "./images";
import { t } from "./strings";

/** `₹260` for a whole-rupee rate, `₹260.50` when it has paise. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: (item: MenuItem) => void }) {
  const [photo, setPhoto] = useState<"loading" | "ok" | "missing">("loading");
  // The product's own photo first; failing that, the kind photo (public/families/<group>.jpg).
  const ownPhoto = productImageUrl(item);
  const [src, setSrc] = useState(ownPhoto);
  const rate = item.rateMinor > 0 ? `${shortRate(item.rateMinor)}${unitSuffix(item.unit)}` : t.setRate;
  return (
    <button type="button" className="ct-icard" aria-label={`${itemName(item)}, ${rate}`} onClick={() => onSelect(item)}>
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

/** Plain cards, as the Kumbakonam counter had: tap a card and the usual sheet opens for the weight or count. */
export function ItemCards({ items, onSelect }: { items: MenuItem[]; onSelect: (item: MenuItem) => void }) {
  return (
    <div className="ct-icards">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
