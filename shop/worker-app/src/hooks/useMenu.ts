import { useEffect, useState } from "react";
import { describeFirestoreError, subscribeToMenu, useLanguage, type MenuItem } from "@kumbakonam/shared";

export interface UseMenuResult {
  items: MenuItem[];
  loading: boolean;
  error: string | null;
}

/** Realtime menu — reflects Owner edits instantly with no restart (User Flow §3). */
export function useMenu(): UseMenuResult {
  const { language } = useLanguage();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMenu(
      (menuItems) => {
        setError(null);
        setItems(menuItems);
        setLoading(false);
      },
      {},
      (err) => {
        console.error("Menu subscription failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return { items, loading, error };
}
