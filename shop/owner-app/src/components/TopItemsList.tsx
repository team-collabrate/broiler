import { translateItemName, useLanguage } from "@kumbakonam/shared";
import type { TopItem } from "../utils/dashboardStats";
import "./TopItemsList.css";

const STRINGS = {
  empty: { en: "No sales yet in this period.", ta: "இந்தக் காலத்தில் இதுவரை விற்பனை இல்லை." },
  sold: { en: "sold", ta: "விற்றது" },
};

export interface TopItemsListProps {
  items: TopItem[];
}

export function TopItemsList({ items }: TopItemsListProps) {
  const { language } = useLanguage();
  if (items.length === 0) {
    return <p className="top-items__empty">{STRINGS.empty[language]}</p>;
  }

  return (
    <ol className="top-items">
      {items.map((item, index) => (
        <li key={item.name} className="top-items__row">
          <span className="top-items__rank">{index + 1}</span>
          <span className="top-items__name">{translateItemName(item, language)}</span>
          <span className="top-items__qty">
            {item.qty} {STRINGS.sold[language]}
          </span>
        </li>
      ))}
    </ol>
  );
}
