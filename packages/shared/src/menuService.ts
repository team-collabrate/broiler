import { collection, doc, onSnapshot, runTransaction, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { getServices } from './firebase';
import { normalizeDefaultGrams } from './sale';
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
            defaultGrams: normalizeDefaultGrams(data.defaultGrams),
            rateUpdatedAt: data.rateUpdatedAt instanceof Timestamp ? data.rateUpdatedAt.toDate() : null,
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

export interface RateUpdate {
  id: string;
  pricePerKgMinor: number;
}

/**
 * Sets today's per-kg rate for the given items and stamps each with the time, all or
 * nothing. Pass every item whose rate was confirmed, changed or not: confirming an
 * unchanged rate still marks it as set today. Needs a connection: Firestore
 * transactions fail while offline, so a dropped connection shows an error rather than
 * leaving the save hanging.
 */
export async function setMenuRates(rates: RateUpdate[]): Promise<void> {
  for (const r of rates) {
    if (!Number.isInteger(r.pricePerKgMinor) || r.pricePerKgMinor <= 0) throw new Error('Every rate must be above zero');
  }
  const { db } = getServices();
  const stamp = Timestamp.fromDate(new Date());
  await runTransaction(db, async (tx) => {
    for (const r of rates) {
      tx.update(doc(db, 'menu', r.id), { pricePerKgMinor: r.pricePerKgMinor, rateUpdatedAt: stamp });
    }
  });
}
