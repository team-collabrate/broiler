import { useEffect, useState } from 'react';
import { describeError, subscribeCategories, subscribeMenu, DEFAULT_CATEGORIES, type Category, type MenuItem } from '@broiler/shared';

/** The counter's category tabs (the owner's list, or the starting tabs until one is set). */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  useEffect(() => subscribeCategories(setCategories), []);
  return categories;
}

/**
 * `items` is null until the first snapshot arrives, in tab order. `includeInactive` also loads items
 * not yet switched on, so a catalog can be checked before it goes live (see EXPO_PUBLIC_SHOW_DRAFT_MENU).
 */
export function useMenu(categories: Category[], includeInactive = false) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeMenu(
        (next) => {
          setItems(next);
          setError(null);
        },
        (e) => setError(describeError(e)),
        { includeInactive, categories },
      ),
    [includeInactive, categories],
  );

  return { items, error };
}
