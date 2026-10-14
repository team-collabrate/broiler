import { collection, doc, onSnapshot, runTransaction, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { canonicalCategory, categoryOrder, type Category } from './categories';
import { getServices } from './firebase';
import { normalizeDefaultGrams, normalizeDefaultQty, normalizeMethods } from './sale';
import type { MenuItem, Variant } from './types';

const VARIANTS: Variant[] = ['live', 'skin', 'skinless', 'bone', 'boneless'];

export interface SubscribeMenuOptions {
  /** The tab order to sort by (the owner's categories). Defaults to the starting tabs. */
  categories?: Category[];
  /** Also deliver inactive items, for drafting a catalog before it goes live. Off at the counter. */
  includeInactive?: boolean;
}

/**
 * Live list of menu items in display order: by category tab, then the owner's sort order. The menu
 * is small, so it is filtered and sorted here rather than in the query; that avoids a composite
 * index. Items are active only unless `includeInactive` is set.
 */
export function subscribeMenu(
  onData: (items: MenuItem[]) => void,
  onError: (error: Error) => void,
  options: SubscribeMenuOptions = {},
): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    collection(db, 'menu'),
    (snapshot) => {
      const items = snapshot.docs
        .map((d): MenuItem => {
          const data = d.data();
          const unit = data.unit === 'piece' ? 'piece' : 'kg';
          return {
            id: d.id,
            name: String(data.name ?? ''),
            nameTa: typeof data.nameTa === 'string' && data.nameTa.trim() !== '' ? data.nameTa.trim() : null,
            category: canonicalCategory(typeof data.category === 'string' && data.category !== '' ? data.category : 'other'),
            group: typeof data.group === 'string' && data.group !== '' ? data.group : d.id,
            variant: VARIANTS.includes(data.variant) ? data.variant : null,
            unit,
            methods: normalizeMethods(unit, data.methods),
            image: typeof data.image === 'string' && data.image.trim() !== '' ? data.image.trim() : null,
            // Older documents called the per-kg rate `pricePerKgMinor`.
            rateMinor: Number(data.rateMinor ?? data.pricePerKgMinor ?? 0),
            defaultGrams: normalizeDefaultGrams(data.defaultGrams),
            defaultQty: normalizeDefaultQty(data.defaultQty),
            rateUpdatedAt: data.rateUpdatedAt instanceof Timestamp ? data.rateUpdatedAt.toDate() : null,
            active: data.active !== false,
            sortOrder: Number(data.sortOrder ?? 0),
          };
        })
        .filter((item) => (options.includeInactive || item.active) && item.name !== '')
        .sort(
          (a, b) =>
            categoryOrder(a.category, options.categories) - categoryOrder(b.category, options.categories) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      onData(items);
    },
    onError,
  );
}

export interface RateUpdate {
  id: string;
  rateMinor: number;
}

/**
 * Sets today's rate (per kg or per piece, whichever the item is sold by) for the given items and
 * stamps each with the time, all or nothing. Pass every item whose rate was confirmed, changed or
 * not: confirming an unchanged rate still marks it as set today. Needs a connection: Firestore
 * transactions fail while offline, so a dropped connection shows an error rather than leaving the
 * save hanging.
 */
export async function setMenuRates(rates: RateUpdate[]): Promise<void> {
  for (const r of rates) {
    if (!Number.isInteger(r.rateMinor) || r.rateMinor <= 0) throw new Error('ஒவ்வொரு விலையும் பூஜ்யத்துக்கு மேல் இருக்க வேண்டும்');
  }
  const { db } = getServices();
  const stamp = Timestamp.fromDate(new Date());
  await runTransaction(db, async (tx) => {
    for (const r of rates) {
      tx.update(doc(db, 'menu', r.id), { rateMinor: r.rateMinor, rateUpdatedAt: stamp });
    }
  });
}
