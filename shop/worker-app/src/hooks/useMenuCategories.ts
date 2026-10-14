import { useCallback, useMemo, useState } from "react";
import { MENU_CATEGORIES, type MenuItem } from "@kumbakonam/shared";

export interface UseMenuCategoriesResult {
  categories: string[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  /** Moves to the previous/next tab, wrapping around — used by the ←/→ keyboard shortcuts. */
  cycleCategory: (direction: 1 | -1) => void;
  visibleItems: MenuItem[];
}

/**
 * Category-tab state, lifted out of MenuGrid so keyboard shortcuts
 * (WorkerHome) can read/drive it too.
 *
 * There is no "All" tab. A worker always knows what time of day it is —
 * that is what the tabs are named for — so a catch-all that mixes
 * breakfast items into the dinner rush isn't a shortcut, it's a wider list
 * to scan for one they'd reach for by category anyway. Removing it also
 * frees a full-width slot in a header that is already tight for six tabs.
 */
export function useMenuCategories(items: MenuItem[]): UseMenuCategoriesResult {
  // MENU_CATEGORIES is a module-level constant, so its first entry is a
  // stable initial value — no effect needed to "correct" it once items load.
  const [activeCategory, setActiveCategory] = useState<string>(MENU_CATEGORIES[0]);

  const categories = useMemo(() => {
    const found = new Set<string>();
    items.forEach((item) => {
      if (item.category) found.add(item.category);
    });

    // The categories the shop sells by always show, in day order, whether
    // or not anything is filed under them yet — an empty Dinner tab is
    // information, and a tab that appears only once someone adds an item
    // reads as a bug.
    const canonical: string[] = [...MENU_CATEGORIES];
    canonical.forEach((c) => found.delete(c));

    // Anything left is from an older category set. It keeps a tab so those
    // items stay reachable at the counter until they're refiled.
    return [...canonical, ...Array.from(found).sort()];
  }, [items]);

  const cycleCategory = useCallback(
    (direction: 1 | -1) => {
      setActiveCategory((current) => {
        const index = categories.indexOf(current);
        const safeIndex = index === -1 ? 0 : index;
        const next = (safeIndex + direction + categories.length) % categories.length;
        return categories[next];
      });
    },
    [categories],
  );

  const visibleItems = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory],
  );

  return { categories, activeCategory, setActiveCategory, cycleCategory, visibleItems };
}
