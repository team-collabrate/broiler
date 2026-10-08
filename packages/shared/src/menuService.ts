import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getServices } from './firebase';
import type { MenuItem } from './types';

/**
 * Live list of active menu items, in display order. The menu is small, so it is
 * filtered and sorted here rather than in the query; that avoids a composite index.
 */
export function subscribeMenu(onData: (items: MenuItem[]) => void, onError: (error: Error) => void): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    collection(db, 'menu'),
    (snapshot) => {
      const items = snapshot.docs
        .map((d): MenuItem => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ''),
            pricePerKgMinor: Number(data.pricePerKgMinor ?? 0),
            active: data.active !== false,
            sortOrder: Number(data.sortOrder ?? 0),
          };
        })
        .filter((item) => item.active && item.name !== '')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      onData(items);
    },
    onError,
  );
}
