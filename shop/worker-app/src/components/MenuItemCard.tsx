import type { KeyboardEvent, MouseEvent } from "react";
import { formatCurrency, translateItemName, useLanguage, type MenuItem } from "@kumbakonam/shared";
import "./MenuItemCard.css";

/**
 * Item name -> photo, served from worker-app/public/items — produced by
 * scripts/prepare-item-images.mjs from food-images/, same pipeline
 * CATEGORY_IMAGE used in CategoryTabs.tsx. Keyed by the exact `name`
 * string in seed-menu.mjs; several variants of one dish (e.g. "Poori
 * (Single)" and "Poori Set") intentionally share one photo rather than
 * needing a separate shot per portion size.
 *
 * Items with no photo yet (no matching shot in food-images/ at all, and no
 * reasonable dish to borrow one from — e.g. "Other Snacks", "Uthappam")
 * fall back to the existing hand-drawn icon or letter avatar — not a
 * broken image.
 */
const MENU_ITEM_IMAGE: Record<string, string> = {
  Idli: "/items/idly.png",
  Pongal: "/items/pongal.png",
  "Poori (Single)": "/items/poori.png",
  "Poori Set": "/items/poori.png",
  "Chapathi (Single)": "/items/chappathi.png",
  "Chapathi Set": "/items/chappathi.png",
  "Idiyappam 1 Set": "/items/idiyappam.png",
  "Idiyappam 1": "/items/idiyappam.png",
  // Every dosa gets a photo, including the two with no shot of their own:
  // "Dosa / Nice Dosa" is the plain order, closest to the plain, topping-
  // free kal dosa photo; "Ghee Roast" is a large crispy folded roast, so it
  // borrows the masala dosa shot for its shape rather than the onion/podi
  // photos, which show visible toppings a ghee roast doesn't have.
  "Dosa / Nice Dosa": "/items/kal-dosa.png",
  "Kal Dosa": "/items/kal-dosa.png",
  "Masala Dosa": "/items/masala-dosa.png",
  "Ghee Roast": "/items/masala-dosa.png",
  "Onion Dosa": "/items/onion-dosa.png",
  // Live menu item is "Onion Uthappam" — seed-menu.mjs's original
  // "Uthappam / Onion Uthappam" was renamed in the owner app at some
  // point, and this map is keyed by the live name, not the seed script's.
  "Onion Uthappam": "/items/onion-dosa.png",
  "Podi Dosa": "/items/podi-dosa.png",
  "Onion Podi Dosa": "/items/onion-podi-dosa.png",

  Meals: "/items/meals.png",
  "Parcel Meals": "/items/meals.png",
  "Veg Biryani": "/items/veg-briyani.png",
  "Tomato Rice": "/items/tomato-rice.png",
  "Lemon Rice": "/items/lemon-rice.png",
  "Curd Rice": "/items/curd-rice.png",
  "Sambar Rice": "/items/sambar-rice.png",

  // Every rice variety and both noodle dishes get a photo. The ones with
  // no dedicated shot (Tamarind Rice, Mushroom Rice, Paneer Rice) reuse the
  // plain rice.png rather than showing a letter avatar next to dishes that
  // clearly are rice.
  "Veg Rice": "/items/rice.png",
  "Tamarind Rice": "/items/rice.png",
  "Mushroom Rice": "/items/rice.png",
  "Paneer Rice": "/items/rice.png",
  "Mushroom Noodles": "/items/noodles.png",
  "Paneer Noodles": "/items/noodles.png",
  Parotta: "/items/poratta.png",
  "Kothu Parotta": "/items/kothu-porotta.png",
  "Chilli Parotta": "/items/chilli-porotta.png",

  Tea: "/items/tea.png",
  "Black Tea": "/items/tea.png",
  "Black Tea 1 Parcel": "/items/tea.png",
  "Black Tea 1/2 Parcel": "/items/tea.png",
  "1/2 Parcel Tea": "/items/tea.png",
  "1 Parcel Tea": "/items/tea.png",
  "1-1/2 Parcel Tea": "/items/tea.png",
  // No dedicated shot for the country-sugar variant — same cup either way,
  // just a different sugar, so the plain tea photo is the honest stand-in
  // rather than leaving these two blank.
  "Naatu Sakarai 1 Parcel": "/items/tea.png",
  "Naatu Sakarai 1/2 Parcel": "/items/tea.png",
  Coffee: "/items/coffee.png",
  "Parcel Coffee": "/items/coffee.png",
  "1/2 Parcel Coffee": "/items/coffee.png",
  "1 Parcel Coffee": "/items/coffee.png",
  "1-1/2 Parcel Coffee": "/items/coffee.png",
  "Sukku Coffee": "/items/sukku-coffee.png",
  "Lemon Tea": "/items/lemon-tea.png",
  Milk: "/items/milk.png",
  "1 Milk": "/items/milk.png",
  "Milk 1/2 Parcel": "/items/milk.png",
  "Badam Milk": "/items/badam-milk.png",
  "Badam Milk Parcel": "/items/badam-milk.png",
  Boost: "/items/boost.png",
  Horlicks: "/items/milk.png",
  // Live menu item is "Water Bottle" — seed-menu.mjs's separate "Water" and
  // "Water Can" entries don't exist there; they were consolidated into one
  // item in the owner app.
  "Water Bottle": "/items/water-bottle.png",

  Vadai: "/items/vada.png",
  Samosa: "/items/samosa.png",
  Bonda: "/items/bonda.png",
  Kesari: "/items/kesari.png",
  "Neyi Poli": "/items/boli.png",
  Paniyaram: "/items/paniyaram.png",
  Kali: "/items/kali.png",
  Mochai: "/items/mochai.png",
  "Paasi Payiru": "/items/paasi-payiru.png",
};

/**
 * Auto-assigns a photo by name for anything not in MENU_ITEM_IMAGE above —
 * every item added since the shift picker / parcel-combo / bulk-order
 * requests (SPL Dosa, the Naatu Sakarai parcels, Horlicks/Boost/Tea combos,
 * Meals Oru Padi, ...) went in through add-menu-items.mjs with no photo at
 * all, and needed a manual MENU_ITEM_IMAGE entry to ever get one. This
 * closes that gap going forward: a name containing "dosa", "tea", "coffee"
 * etc. gets a reasonable existing photo automatically, no code change
 * needed when the owner adds a new size/variant of something already shot.
 *
 * Deliberately ordered, checked top-to-bottom, first match wins — most
 * specific phrase before the generic word it contains (e.g. "sukku coffee"
 * before "coffee", "kothu parotta" before "parotta"), the same reasoning
 * MENU_ITEM_IMAGE's own exact matches already rely on, just one level
 * fuzzier. Never overrides an exact match above; only fills the gap when
 * there isn't one, so a name this guesses wrong for is one MENU_ITEM_IMAGE
 * entry away from being fixed for good, same as it always was.
 */
const IMAGE_KEYWORDS: [pattern: string, image: string][] = [
  ["onion podi dosa", "/items/onion-podi-dosa.png"],
  ["podi dosa", "/items/podi-dosa.png"],
  ["onion dosa", "/items/onion-dosa.png"],
  ["uthappam", "/items/onion-dosa.png"],
  ["masala dosa", "/items/masala-dosa.png"],
  ["ghee roast", "/items/masala-dosa.png"],
  ["kal dosa", "/items/kal-dosa.png"],
  ["dosa", "/items/kal-dosa.png"], // generic — plain/SPL/new dosa variants
  ["idiyappam", "/items/idiyappam.png"],
  ["idli", "/items/idly.png"],
  ["poori", "/items/poori.png"],
  ["chapathi", "/items/chappathi.png"],
  ["chapati", "/items/chappathi.png"],
  ["kothu parotta", "/items/kothu-porotta.png"],
  ["kothu porotta", "/items/kothu-porotta.png"],
  ["chilli parotta", "/items/chilli-porotta.png"],
  ["chilli porotta", "/items/chilli-porotta.png"],
  ["parotta", "/items/poratta.png"],
  ["porotta", "/items/poratta.png"],
  ["rotti", "/items/poratta.png"], // closest shot to a plain roti/flatbread
  ["roti", "/items/poratta.png"],
  ["pongal", "/items/pongal.png"],
  ["briyani", "/items/veg-briyani.png"],
  ["biryani", "/items/veg-briyani.png"],
  ["tomato rice", "/items/tomato-rice.png"],
  ["lemon rice", "/items/lemon-rice.png"],
  ["curd rice", "/items/curd-rice.png"],
  ["sambar rice", "/items/sambar-rice.png"],
  ["meals", "/items/meals.png"],
  ["rice", "/items/rice.png"], // generic — any variety with no shot of its own
  ["noodles", "/items/noodles.png"],
  ["vadai", "/items/vada.png"],
  ["vada", "/items/vada.png"],
  ["samosa", "/items/samosa.png"],
  ["bonda", "/items/bonda.png"],
  ["kesari", "/items/kesari.png"],
  ["poli", "/items/boli.png"],
  ["paniyaram", "/items/paniyaram.png"],
  ["kali", "/items/kali.png"],
  ["mochai", "/items/mochai.png"],
  ["paasi payiru", "/items/paasi-payiru.png"],
  ["sukku coffee", "/items/sukku-coffee.png"],
  ["coffee", "/items/coffee.png"],
  ["lemon tea", "/items/lemon-tea.png"],
  ["badam milk", "/items/badam-milk.png"],
  ["horlicks", "/items/milk.png"],
  ["milk", "/items/milk.png"],
  ["tea", "/items/tea.png"], // generic — plain/black/Naatu Sakarai/parcel, any size
  ["boost", "/items/boost.png"],
  ["water", "/items/water-bottle.png"],
];

function guessImage(name: string): string | undefined {
  const lower = name.toLowerCase();
  return IMAGE_KEYWORDS.find(([pattern]) => lower.includes(pattern))?.[1];
}

export interface MenuItemCardProps {
  item: MenuItem;
  /** Keyboard digit that adds this item — shown as a small badge, undefined past the 10th visible item. */
  shortcutKey?: string;
  /** How many of this item are already in the cart — drives the + / −-1-+ swap. */
  qty: number;
  onAdd: (item: MenuItem) => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
}

const STRINGS = {
  add: { en: "Add", ta: "சேர்" },
  decrease: { en: "Decrease quantity", ta: "அளவை குறை" },
  increase: { en: "Increase quantity", ta: "அளவை கூட்டு" },
};

export function MenuItemCard({ item, shortcutKey, qty, onAdd, onIncrement, onDecrement }: MenuItemCardProps) {
  const { language } = useLanguage();
  const displayName = translateItemName(item, language);
  const image = MENU_ITEM_IMAGE[item.name] ?? guessImage(item.name);

  // The whole card still adds on tap, exactly as before — the qty stepper is
  // an additional fine control, not a replacement for that. Its own buttons
  // stop the click reaching this handler, or a tap on "+" would both
  // increment itself *and* re-trigger the card's own add underneath it.
  const handleCardActivate = () => onAdd(item);
  const stop = (e: MouseEvent) => e.stopPropagation();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardActivate();
    }
  };

  return (
    // A native <button> can't contain the stepper's own <button> children
    // (nested interactive controls are invalid HTML, and a browser will
    // silently unwrap the inner ones) — role="button" on a div is what
    // makes room for them while keeping the same tap/keyboard behaviour.
    <div
      className={`menu-item-card ${image ? "" : "menu-item-card--no-photo"}`}
      role="button"
      tabIndex={0}
      onClick={handleCardActivate}
      onKeyDown={handleKeyDown}
      aria-label={`${displayName}, ${formatCurrency(item.price)}`}
    >
      {/* No more hand-drawn/emoji/letter-avatar fallback here — an item with
          no photo yet is a plain text card (see .menu-item-card--no-photo),
          not a stand-in illustration. The old fallback made every unphotographed
          item look intentionally styled instead of simply "not photographed
          yet", which stopped being honest once most of the menu had real
          photos around it. */}
      {image && (
        <>
          <div className="menu-item-card__media">
            <img className="menu-item-card__photo" src={image} alt="" loading="lazy" />
          </div>

          {/* Pure gradient, no content — kept separate from __media so the
              photo and the darkening never have to renegotiate stacking with
              anything drawn on top of them. Only makes sense over a photo —
              a photo-less card has nothing under it that needs darkening. */}
          <div className="menu-item-card__scrim" aria-hidden="true" />
        </>
      )}

      {shortcutKey && (
        <span className="menu-item-card__shortcut" aria-hidden="true">
          {shortcutKey}
        </span>
      )}

      <div className="menu-item-card__info">
        <span className="menu-item-card__name">{displayName}</span>

        {/* Its own line below the name — the stepper (qty>0) is ~94px wide
            on its own, more than half of the real ~140px tablet card, so
            sharing a row with anything else left one of them squeezed
            unreadable (see git history). Its own full-width line is the
            one arrangement where nothing has to compete with it. */}
        <div className="menu-item-card__qty" onClick={stop}>
          {qty === 0 ? (
            <button
              type="button"
              className="menu-item-card__add"
              onClick={(e) => {
                stop(e);
                onAdd(item);
              }}
              aria-label={`${STRINGS.add[language]} ${displayName}`}
            >
              +
            </button>
          ) : (
            <div className="menu-item-card__stepper">
              <button
                type="button"
                className="menu-item-card__step"
                onClick={(e) => {
                  stop(e);
                  onDecrement(item.itemId);
                }}
                aria-label={STRINGS.decrease[language]}
              >
                −
              </button>
              <span className="menu-item-card__qty-value">{qty}</span>
              <button
                type="button"
                className="menu-item-card__step"
                onClick={(e) => {
                  stop(e);
                  onIncrement(item.itemId);
                }}
                aria-label={STRINGS.increase[language]}
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Below the qty row, right-aligned — a real flow row, not pinned
            to the card's own bottom-right corner: that was tried first
            (matching the request literally), but the corner is exactly
            where the stepper (qty>0) also reaches, and pinning both there
            hid the price under it every time something was already in the
            cart — verified at the real ~140px tablet card width. Stacking
            it after the qty row instead lands in the same visual corner
            whenever there's room, without ever fighting the stepper for
            it. */}
        <span className="menu-item-card__price">{formatCurrency(item.price)}</span>
      </div>
    </div>
  );
}
