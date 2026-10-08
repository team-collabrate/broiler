import { useEffect, useState } from 'react';
import { subscribeMenu, type MenuItem } from '@broiler/shared';

/** `items` is null until the first snapshot arrives. */
export function useMenu() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeMenu(
        (next) => {
          setItems(next);
          setError(null);
        },
        (e) => setError(e.message),
      ),
    [],
  );

  return { items, error };
}
