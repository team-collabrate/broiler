import { useState } from "react";
import type { Category } from "@kumbakonam/shared/core";
import { categoryImageUrl } from "./images";
import { t } from "./strings";

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
