import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type { MenuItem } from "../types";

const COLLECTION = "menu";

export interface ListMenuOptions {
  /** Defaults to true — most callers (Worker menu grid) only want sellable items. */
  activeOnly?: boolean;
}

export async function listMenuItems(options: ListMenuOptions = {}): Promise<MenuItem[]> {
  const { activeOnly = true } = options;
  const db = getFirestoreDb();
  const constraints = activeOnly ? [where("active", "==", true)] : [];
  // Owner-controlled placement (see MenuItem.sortOrder), not alphabetical —
  // every doc must carry the field for this to include it (Firestore drops
  // documents missing an orderBy field), which the sortOrder backfill and
  // createMenuItem below both guarantee.
  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints, orderBy("sortOrder")));
  return snap.docs.map((d) => ({ itemId: d.id, ...(d.data() as Omit<MenuItem, "itemId">) }));
}

/** Realtime subscription so Worker menu screen reflects Owner edits instantly (TDD §7). */
export function subscribeToMenu(
  onChange: (items: MenuItem[]) => void,
  options: ListMenuOptions = {},
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const { activeOnly = true } = options;
  const db = getFirestoreDb();
  const constraints = activeOnly ? [where("active", "==", true)] : [];
  const q = query(collection(db, COLLECTION), ...constraints, orderBy("sortOrder"));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ itemId: d.id, ...(d.data() as Omit<MenuItem, "itemId">) })));
    },
    onError,
  );
}

export async function getMenuItem(itemId: string): Promise<MenuItem | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, COLLECTION, itemId));
  if (!snap.exists()) return null;
  return { itemId: snap.id, ...(snap.data() as Omit<MenuItem, "itemId">) };
}

export interface CreateMenuItemInput {
  name: string;
  nameTa?: string;
  price: number;
  category?: string;
  icon?: string;
}

export async function createMenuItem(input: CreateMenuItemInput): Promise<string> {
  const db = getFirestoreDb();
  // New items land at the end — one past the current global maximum. That
  // also puts it last within its own category (a category's items are
  // always a subset of every item, so nothing in that subset can have a
  // higher sortOrder than the overall max) without needing a per-category
  // query here.
  const highest = await getDocs(query(collection(db, COLLECTION), orderBy("sortOrder", "desc"), limit(1)));
  const sortOrder = highest.empty ? 10 : ((highest.docs[0].data().sortOrder as number) ?? 0) + 10;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    sortOrder,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export type UpdateMenuItemInput = Partial<
  Pick<MenuItem, "name" | "nameTa" | "price" | "category" | "icon" | "active" | "sortOrder">
>;

export async function updateMenuItem(itemId: string, input: UpdateMenuItemInput): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, itemId), { ...input, updatedAt: serverTimestamp() });
}

export async function setMenuItemActive(itemId: string, active: boolean): Promise<void> {
  await updateMenuItem(itemId, { active });
}

/**
 * Reordering primitive for the Owner app's move-up/move-down controls: two
 * items trade sortOrder values in one atomic write, so a worker mid-scroll
 * on the grid never sees a half-applied swap (one item moved, the other
 * not yet). Only meaningful between two items already in the same
 * category — the caller (MenuScreen) only ever passes adjacent items from
 * the same category's own list.
 */
export async function swapMenuItemSortOrder(
  a: { itemId: string; sortOrder: number },
  b: { itemId: string; sortOrder: number },
): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, a.itemId), { sortOrder: b.sortOrder, updatedAt: serverTimestamp() });
  batch.update(doc(db, COLLECTION, b.itemId), { sortOrder: a.sortOrder, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, itemId));
}
