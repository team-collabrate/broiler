import { formatCurrency, ProductIcon, translateCategory, translateItemName, useLanguage, type MenuItem } from "@kumbakonam/shared";
import "./MenuItemRow.css";

const STRINGS = {
  active: { en: "active", ta: "செயலில்" },
  delete: { en: "Delete", ta: "நீக்கு" },
  moveUp: { en: "Move up", ta: "மேலே நகர்த்து" },
  moveDown: { en: "Move down", ta: "கீழே நகர்த்து" },
};

export interface MenuItemRowProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggleActive: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  /** Undefined at the top/bottom of its category — the button disables rather than disappearing, so the column stays aligned. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function MenuItemRow({ item, onEdit, onToggleActive, onDelete, onMoveUp, onMoveDown }: MenuItemRowProps) {
  const { language } = useLanguage();
  const displayName = translateItemName(item, language);
  return (
    <div className={`menu-row ${item.active ? "" : "is-inactive"}`}>
      {/* Buttons, not drag handles — this list is worked one-handed on a
          phone mid-shift, where a drag gesture competes with the page's
          own scroll and is easy to fumble. Tapping ▲/▼ can't be
          ambiguous with anything else on the screen. */}
      <div className="menu-row__reorder">
        <button
          type="button"
          className="menu-row__move"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          aria-label={`${STRINGS.moveUp[language]} ${displayName}`}
        >
          ▲
        </button>
        <button
          type="button"
          className="menu-row__move"
          onClick={onMoveDown}
          disabled={!onMoveDown}
          aria-label={`${STRINGS.moveDown[language]} ${displayName}`}
        >
          ▼
        </button>
      </div>

      <button type="button" className="menu-row__info" onClick={() => onEdit(item)}>
        <ProductIcon name={item.name} icon={item.icon} fallbackLabel={displayName} variant="row" />
        <span className="menu-row__text">
          <span className="menu-row__name">{displayName}</span>
          <span className="menu-row__meta">
            {formatCurrency(item.price)}
            {item.category ? ` · ${translateCategory(item.category, language)}` : ""}
          </span>
        </span>
      </button>

      <label className="menu-row__switch" aria-label={`${displayName} ${STRINGS.active[language]}`}>
        <input type="checkbox" checked={item.active} onChange={() => onToggleActive(item)} />
        <span className="menu-row__switch-track" />
      </label>

      <button
        type="button"
        className="menu-row__delete"
        onClick={() => onDelete(item)}
        aria-label={`${STRINGS.delete[language]} ${displayName}`}
      >
        🗑
      </button>
    </div>
  );
}
