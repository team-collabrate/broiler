import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { getServices } from './firebase';
import { DEFAULT_CATEGORIES, normalizeCategories, type Category } from './categories';
import { DEFAULT_MAX_ADJUST_MINOR, normalizeMaxAdjust } from './sale';

/**
 * Live price-adjustment limit (`settings/pricing.maxAdjustMinor`), in paise. Until the owner sets
 * one, or if it can't be read, the default applies, so selling is never blocked on a missing setting.
 */
export function subscribeMaxAdjust(onData: (maxAdjustMinor: number) => void): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    doc(db, 'settings', 'pricing'),
    (snap) => onData(normalizeMaxAdjust(snap.data()?.maxAdjustMinor)),
    () => onData(DEFAULT_MAX_ADJUST_MINOR),
  );
}

/** Owner only (the rules refuse anyone else). */
export async function setMaxAdjust(maxAdjustMinor: number): Promise<void> {
  const { db } = getServices();
  await setDoc(doc(db, 'settings', 'pricing'), { maxAdjustMinor: normalizeMaxAdjust(maxAdjustMinor) });
}

/** Live list of counter tabs (`settings/categories`). Falls back to the starting tabs until the owner sets their own. */
export function subscribeCategories(onData: (categories: Category[]) => void): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    doc(db, 'settings', 'categories'),
    (snap) => onData(normalizeCategories(snap.data()?.list)),
    () => onData(DEFAULT_CATEGORIES),
  );
}

/** Owner only. */
export async function setCategories(list: Category[]): Promise<void> {
  const { db } = getServices();
  await setDoc(doc(db, 'settings', 'categories'), { list: normalizeCategories(list) });
}
