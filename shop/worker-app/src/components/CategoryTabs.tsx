import { translateCategory, useLanguage } from "@kumbakonam/shared";
import "./CategoryTabs.css";

const STRINGS = {
  categoriesLabel: { en: "Menu categories", ta: "மெனு பிரிவுகள்" },
};

/** Category -> photo, served from worker-app/public/categories (see
 *  scripts/prepare-category-images.mjs). A category with no entry here
 *  falls back to the plain text chip below, so an older or owner-added
 *  category never renders as a broken image. */
const CATEGORY_IMAGE: Record<string, string> = {
  Breakfast: "/categories/breakfast.png",
  Lunch: "/categories/lunch.png",
  Dinner: "/categories/dinner.png",
  Tea: "/categories/tea.png",
  Vadai: "/categories/vadai.png",
};

export interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

/**
 * The category tab strip. Lives in the counter header beside the logo rather
 * than above the grid, so the menu itself starts at the top of its own
 * scroll area and nothing floats over the cards.
 */
export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  const { language } = useLanguage();

  return (
    <div
      className="category-tabs"
      role="tablist"
      aria-label={STRINGS.categoriesLabel[language]}
      // Equal-width columns spanning the whole row, sized to the actual
      // category count — the previous version packed tabs to the left and
      // left dead space after the last one; this divides the full width
      // evenly instead, so the gap between every tab (including the last
      // and the row's own edge) comes out the same.
      // minmax(0, 1fr) rather than plain 1fr: a bare 1fr track won't shrink
      // below its content's intrinsic width, which on a narrow tablet could
      // push the grid wider than its container instead of dividing evenly.
      style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
    >
      {categories.map((category) => {
        const image = CATEGORY_IMAGE[category];
        const label = translateCategory(category, language);
        const active = activeCategory === category;

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={active}
            className={`category-tabs__tab ${image ? "category-tabs__tab--photo" : "category-tabs__tab--plain"} ${active ? "is-active" : ""}`}
            onClick={() => onCategoryChange(category)}
          >
            {image && (
              // Natural cutout shape, not cropped into a circle — the photo
              // itself is the point, not a logo treatment of it.
              <img className="category-tabs__photo" src={image} alt="" loading="eager" />
            )}
            <span className="category-tabs__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
