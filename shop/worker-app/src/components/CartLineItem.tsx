import { formatCurrency, translateItemName, useLanguage } from "@kumbakonam/shared";
import type { CartLine } from "../hooks/useCart";
import "./CartLineItem.css";

const STRINGS = {
  each: { en: "each", ta: "ஒன்றுக்கு" },
  remove: { en: "Remove", ta: "நீக்கு" },
  fromCart: { en: "from cart", ta: "கார்ட்டிலிருந்து" },
};

export interface CartLineItemProps {
  line: CartLine;
  onRemove: (itemId: string) => void;
}

/**
 * Quantity is set from the menu card's own +/− stepper (MenuItemCard) —
 * this used to duplicate that control here too, which was redundant (two
 * places to change the same number) and, on the narrower cart panel,
 * expensive: a full stepper's worth of width per line, on every line, for
 * a control the menu grid already has. This just displays the count now;
 * to change it, go back to the card.
 */
export function CartLineItem({ line, onRemove }: CartLineItemProps) {
  const { language } = useLanguage();
  const displayName = translateItemName(line, language);
  return (
    <li className="cart-line">
      <div className="cart-line__row">
        <span className="cart-line__qty">×{line.qty}</span>

        <div className="cart-line__info">
          <span className="cart-line__name">{displayName}</span>
          <span className="cart-line__unit-price">
            {formatCurrency(line.price)} {STRINGS.each[language]}
          </span>
        </div>

        <span className="cart-line__total">{formatCurrency(line.price * line.qty)}</span>

        <button
          type="button"
          className="cart-line__remove"
          onClick={() => onRemove(line.itemId)}
          aria-label={`${STRINGS.remove[language]} ${displayName} ${STRINGS.fromCart[language]}`}
        >
          ×
        </button>
      </div>
    </li>
  );
}
