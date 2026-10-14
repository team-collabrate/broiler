import type { Language } from "./LanguageContext";

/**
 * The categories the shop sells by. Stored on `MenuItem.category` as the
 * English string; the labels below only change how they're shown.
 *
 * Order matters — it's the order of the tabs at the counter, and it runs
 * through the day rather than alphabetically, so a worker reaches for the
 * one they're serving now.
 */
export const MENU_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Tea", "Vadai"] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/**
 * Display names by language. Unknown categories fall back to the raw stored
 * string, which is what keeps items from an older category set readable
 * instead of vanishing.
 */
const CATEGORY_LABELS: Record<string, Record<Language, string>> = {
  // "உணவு" (meal/food) dropped from all three — a tab is a short label,
  // not a sentence, and "காலை" on its own already reads as "morning" the
  // way the English tab reads "Breakfast" rather than "Morning Meal".
  Breakfast: { en: "Breakfast", ta: "காலை" },
  // "மதியம்" (noon), not a truncation of "மதிய உணவு" down to "மதிய" — that
  // would leave the adjective form ("of noon") standing alone with nothing
  // left for it to describe.
  Lunch: { en: "Lunch", ta: "மதியம்" },
  Dinner: { en: "Dinner", ta: "இரவு" },
  Tea: { en: "Tea", ta: "தேநீர்" },
  Vadai: { en: "Vadai", ta: "வடை" },

  // Superseded by the four above. Kept translated because menu items and
  // past orders created under them still exist, and a stored category is
  // just a string — nothing rewrites the old ones automatically.
  "Hot Drinks": { en: "Hot Drinks", ta: "சூடான பானங்கள்" },
  Juice: { en: "Juice", ta: "ஜூஸ்" },
  Snacks: { en: "Snacks", ta: "ஸ்நாக்ஸ்" },
};

export function translateCategory(category: string, language: Language): string {
  return CATEGORY_LABELS[category]?.[language] ?? category;
}

/** Display name for a menu item — Tamil script when available and selected, else the canonical name. */
export function translateItemName(item: { name: string; nameTa?: string }, language: Language): string {
  return language === "ta" && item.nameTa ? item.nameTa : item.name;
}
