import { PRODUCT_VISUALS } from "./icons";
import "./ProductIcon.css";

export interface ProductIconProps {
  /** Canonical MenuItem.name — looked up against the hand-drawn set. */
  name: string;
  /** Emoji fallback (MenuItem.icon) for items outside the curated set, e.g. a new item the owner adds. */
  icon?: string;
  /** Display name fallback, used for the first-letter avatar when neither of the above match. */
  fallbackLabel: string;
  /** "card" = full-bleed, top-rounded (menu grid); "row" = small rounded-square thumbnail (menu list). */
  variant?: "card" | "row";
}

/** Hand-drawn flat SVG illustration per menu item — no photos, no Storage (see icons.tsx). */
export function ProductIcon({ name, icon, fallbackLabel, variant = "card" }: ProductIconProps) {
  const visual = PRODUCT_VISUALS[name];

  if (visual) {
    return (
      <div className={`product-icon product-icon--${variant}`} style={{ background: visual.bg }} aria-hidden="true">
        <svg viewBox="0 0 64 64" className="product-icon__svg">
          {visual.render()}
        </svg>
      </div>
    );
  }

  return (
    <div className={`product-icon product-icon--${variant} product-icon--fallback`} aria-hidden="true">
      {icon ? (
        <span className="product-icon__emoji">{icon}</span>
      ) : (
        <span className="product-icon__letter">{fallbackLabel.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
