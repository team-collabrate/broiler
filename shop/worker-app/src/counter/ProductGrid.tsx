import { useState } from "react";
import { CURRENCY_SYMBOL, formatMoney, itemName, unitSuffix, type Category, type MenuItem } from "@kumbakonam/shared/core";
import { categoryImageUrl, productImageUrl } from "./images";
import { t } from "./strings";

/** `₹260` for a whole-rupee rate, `₹260.50` when it has paise: short enough for a card. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

/** A picture that quietly disappears if its file is missing, leaving the card as a plain text card. */
function Picture({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className={className} src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />;
}

interface TabsProps {
  /** Only the categories that have products. */
  categories: Category[];
  selected: string | null;
  onSelect: (key: string) => void;
  labelFor: (category: Category) => string;
}

/** The category tabs above the catalog: light, with a red underline on the selected one. */
export function CounterTabs({ categories, selected, onSelect, labelFor }: TabsProps) {
  return (
    <div className="ct-tabs" role="tablist" aria-label={t.categoriesLabel}>
      {categories.map((category) => (
        <button
          key={category.key}
          type="button"
          role="tab"
          aria-selected={category.key === selected}
          className={`ct-tab${category.key === selected ? " is-on" : ""}`}
          onClick={() => onSelect(category.key)}
        >
          <Picture src={category.image ?? categoryImageUrl(category.key)} className="ct-tab__thumb" />
          {labelFor(category)}
        </button>
      ))}
    </div>
  );
}

interface GridProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
}

function ProductCard({ item, onSelect }: { item: MenuItem; onSelect: (item: MenuItem) => void }) {
  // The dark band and white text are only for a photo that really loaded; until then (or if the file is missing)
  // the card is a plain card with the faint rooster.
  const [photo, setPhoto] = useState<"loading" | "ok" | "missing">("loading");
  const rate = item.rateMinor > 0 ? `${shortRate(item.rateMinor)}${unitSuffix(item.unit)}` : t.setRate;
  return (
    <button
      type="button"
      className={`ct-card${photo === "ok" ? " has-photo" : ""}`}
      aria-label={`${itemName(item)}, ${rate}`}
      onClick={() => onSelect(item)}
    >
      <img className="ct-card__rooster" src="/logo.png" alt="" draggable={false} />
      {photo !== "missing" && (
        <img
          className="ct-card__photo"
          src={productImageUrl(item)}
          alt=""
          draggable={false}
          onLoad={() => setPhoto("ok")}
          onError={() => setPhoto("missing")}
        />
      )}
      <span className="ct-card__scrim" />
      <span className="ct-card__info">
        <span className="ct-card__name">{itemName(item)}</span>
        <span className="ct-card__row">
          <span className="ct-card__plus" aria-hidden="true">
            +
          </span>
          <span className="ct-card__price">{rate}</span>
        </span>
      </span>
    </button>
  );
}

/**
 * The product catalog: image cards in a 4:3 grid, four to a row. Each card is the photo filling the card, a dark band
 * along the bottom carrying the name and the price, and a "+" that says the card can be tapped. A product with no
 * photo yet shows the shop's rooster, faint, so the card still looks finished. Tapping opens the product's sheet.
 */
export function ProductGrid({ items, onSelect }: GridProps) {
  return (
    <div className="ct-grid">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
