import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { DEFAULT_CATEGORIES, DEFAULT_MAX_ADJUST_MINOR, normalizeCategories, normalizeMaxAdjust, type Category } from "../core";
import { getFirestoreDb } from "../firebase";

/**
 * Live price-adjustment limit (`settings/pricing.maxAdjustMinor`), in paise. Until the owner sets one, or if it
 * can't be read, the default applies, so selling is never blocked on a missing setting.
 */
export function subscribeMaxAdjust(onData: (maxAdjustMinor: number) => void): Unsubscribe {
  return onSnapshot(
    doc(getFirestoreDb(), "settings", "pricing"),
    (snap) => onData(normalizeMaxAdjust(snap.data()?.maxAdjustMinor)),
    () => onData(DEFAULT_MAX_ADJUST_MINOR),
  );
}

/** Live list of counter tabs (`settings/categories`). Falls back to the starting tabs until the owner sets their own. */
export function subscribeCategories(onData: (categories: Category[]) => void): Unsubscribe {
  return onSnapshot(
    doc(getFirestoreDb(), "settings", "categories"),
    (snap) => onData(normalizeCategories(snap.data()?.list)),
    () => onData(DEFAULT_CATEGORIES),
  );
}
