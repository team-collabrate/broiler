import { useMemo } from "react";
import { useLanguage, type MenuItem } from "@kumbakonam/shared";
import { MenuItemCard } from "./MenuItemCard";
import type { CartLine } from "../hooks/useCart";
import "./MenuGrid.css";

const STRINGS = {
  loading: { en: "Loading menu…", ta: "மெனு ஏற்றுகிறது…" },
  empty: {
    en: "No menu items yet — ask the owner to add some in the dashboard.",
    ta: "இன்னும் மெனு பொருட்கள் இல்லை — உரிமையாளரிடம் சேர்க்கச் சொல்லுங்கள்.",
  },
  emptyCategory: { en: "No items in this category.", ta: "இந்தப் பிரிவில் பொருட்கள் இல்லை." },
  glass: { en: "Glass", ta: "கிளாஸ்" },
  parcel: { en: "Parcel", ta: "பார்சல்" },
};

/** Keys 1-9 then 0 map to the first 10 visible items — same order the ⌨ badges show. */
const SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** Only Tea gets the Glass/Parcel split — Lunch also has a "Parcel Meals"
 *  but a section of one item next to it isn't worth the extra scanning,
 *  and nobody asked for it there. Matched on the name, not a schema field:
 *  every parcel item so far already says so in its name (Data Model has no
 *  separate flag for it), so a future item named the same way falls into
 *  the right section without anyone having to remember to tag it. */
const SECTIONED_CATEGORY = "Tea";
const isParcel = (item: MenuItem) => /parcel/i.test(item.name);

export interface MenuGridProps {
  activeCategory: string;
  visibleItems: MenuItem[];
  totalItemCount: number;
  loading: boolean;
  error: string | null;
  /** Current cart contents — read only to look up each card's own quantity. */
  cartLines: CartLine[];
  onAddItem: (item: MenuItem) => void;
  onIncrementItem: (itemId: string) => void;
  onDecrementItem: (itemId: string) => void;
}

export function MenuGrid({
  activeCategory,
  visibleItems,
  totalItemCount,
  loading,
  error,
  cartLines,
  onAddItem,
  onIncrementItem,
  onDecrementItem,
}: MenuGridProps) {
  const { language } = useLanguage();

  const qtyByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cartLines) map.set(line.itemId, line.qty);
    return map;
  }, [cartLines]);

  // One continuous 1-9,0 run across both sections — the badges on the
  // cards read top-to-bottom, left-to-right regardless of the heading
  // between them, so the keys they map to have to follow the same order.
  let shortcutIndex = 0;
  const renderCard = (item: MenuItem) => {
    const key = SHORTCUT_KEYS[shortcutIndex];
    shortcutIndex += 1;
    return (
      <MenuItemCard
        key={item.itemId}
        item={item}
        shortcutKey={key}
        qty={qtyByItemId.get(item.itemId) ?? 0}
        onAdd={onAddItem}
        onIncrement={onIncrementItem}
        onDecrement={onDecrementItem}
      />
    );
  };

  const sectioned = activeCategory === SECTIONED_CATEGORY;
  const glassItems = sectioned ? visibleItems.filter((item) => !isParcel(item)) : visibleItems;
  const parcelItems = sectioned ? visibleItems.filter(isParcel) : [];

  return (
    <div className="menu-grid">
      {error ? (
        <p className="menu-grid__status menu-grid__status--error">{error}</p>
      ) : loading ? (
        <p className="menu-grid__status">{STRINGS.loading[language]}</p>
      ) : totalItemCount === 0 ? (
        <p className="menu-grid__status">{STRINGS.empty[language]}</p>
      ) : visibleItems.length === 0 ? (
        <p className="menu-grid__status">{STRINGS.emptyCategory[language]}</p>
      ) : sectioned && parcelItems.length > 0 ? (
        <>
          <section className="menu-grid__section">
            {glassItems.length > 0 && <h3 className="menu-grid__section-title">{STRINGS.glass[language]}</h3>}
            <div className="menu-grid__items">{glassItems.map(renderCard)}</div>
          </section>
          <section className="menu-grid__section">
            <h3 className="menu-grid__section-title">{STRINGS.parcel[language]}</h3>
            <div className="menu-grid__items">{parcelItems.map(renderCard)}</div>
          </section>
        </>
      ) : (
        <div className="menu-grid__items">{visibleItems.map(renderCard)}</div>
      )}
    </div>
  );
}
