import { collection, doc, getDocs, onSnapshot, runTransaction, Timestamp, type DocumentData, type Unsubscribe } from "firebase/firestore";
import {
  canonicalCategory,
  categoryOrder,
  normalizeDefaultGrams,
  normalizeDefaultQty,
  normalizeMethods,
  UserError,
  type Category,
  type MenuItem,
  type Variant,
} from "../core";
import { getFirestoreDb } from "../firebase";

const VARIANTS: Variant[] = ["live", "skin", "skinless", "bone", "boneless"];

export interface SubscribeMenuOptions {
  /** The tab order to sort by (the owner's categories). Defaults to the starting tabs. */
  categories?: Category[];
  /** Also deliver inactive items, for checking a catalog before it goes live. Off at the counter. */
  includeInactive?: boolean;
}

/** A product as stored. Tolerates older documents (an older name for the per-kg rate, a missing category or unit). */
export function toMenuItem(id: string, data: DocumentData): MenuItem {
  const unit = data.unit === "piece" ? "piece" : "kg";
  return {
    id,
    name: String(data.name ?? ""),
    nameTa: typeof data.nameTa === "string" && data.nameTa.trim() !== "" ? data.nameTa.trim() : null,
    category: canonicalCategory(typeof data.category === "string" && data.category !== "" ? data.category : "other"),
    group: typeof data.group === "string" && data.group !== "" ? data.group : id,
    variant: VARIANTS.includes(data.variant) ? data.variant : null,
    unit,
    methods: normalizeMethods(unit, data.methods),
    image: typeof data.image === "string" && data.image.trim() !== "" ? data.image.trim() : null,
    // Older documents called the per-kg rate `pricePerKgMinor`.
    rateMinor: Number(data.rateMinor ?? data.pricePerKgMinor ?? 0),
    defaultGrams: normalizeDefaultGrams(data.defaultGrams),
    defaultQty: normalizeDefaultQty(data.defaultQty),
    rateUpdatedAt: data.rateUpdatedAt instanceof Timestamp ? data.rateUpdatedAt.toDate() : null,
    active: data.active !== false,
    sortOrder: Number(data.sortOrder ?? 0),
  };
}

/** Drops inactive and nameless items (unless asked not to) and sorts by category tab, sort order, then name. */
function arrange(items: MenuItem[], options: SubscribeMenuOptions): MenuItem[] {
  return items
    .filter((item) => (options.includeInactive || item.active) && item.name !== "")
    .sort(
      (a, b) =>
        categoryOrder(a.category, options.categories) - categoryOrder(b.category, options.categories) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );
}

/** The products once, in display order: for a screen that reads on demand instead of listening (the owner app). */
export async function getMenuItems(options: SubscribeMenuOptions = {}): Promise<MenuItem[]> {
  const snapshot = await getDocs(collection(getFirestoreDb(), "menu"));
  return arrange(
    snapshot.docs.map((d) => toMenuItem(d.id, d.data())),
    options,
  );
}

/**
 * Live list of products in display order: by category tab, then the owner's sort order. The menu is small,
 * so it is filtered and sorted here rather than in the query, which avoids a composite index.
 */
export function subscribeMenu(
  onData: (items: MenuItem[]) => void,
  onError: (error: Error) => void,
  options: SubscribeMenuOptions = {},
): Unsubscribe {
  const db = getFirestoreDb();
  return onSnapshot(
    collection(db, "menu"),
    (snapshot) => {
      onData(
        arrange(
          snapshot.docs.map((d) => toMenuItem(d.id, d.data())),
          options,
        ),
      );
    },
    onError,
  );
}

export interface RateUpdate {
  id: string;
  rateMinor: number;
}

/**
 * Sets today's rate (per kg or per piece, whichever the item is sold by) for the given items and stamps each
 * with the time, all or nothing. Pass every item whose rate was confirmed, changed or not: confirming an
 * unchanged rate still marks it as set today. Needs a connection (a transaction), so a dropped connection
 * shows an error instead of leaving the save hanging. The rules let only the owner do this.
 */
export async function setMenuRates(rates: RateUpdate[]): Promise<void> {
  for (const r of rates) {
    if (!Number.isInteger(r.rateMinor) || r.rateMinor <= 0) throw new UserError("Every rate must be above zero");
  }
  const db = getFirestoreDb();
  const stamp = Timestamp.fromDate(new Date());
  await runTransaction(db, async (tx) => {
    for (const r of rates) {
      tx.update(doc(db, "menu", r.id), { rateMinor: r.rateMinor, rateUpdatedAt: stamp });
    }
  });
}
