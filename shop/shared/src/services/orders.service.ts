import {
  Timestamp,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type { Order, OrderItem, PaymentMethod } from "../types";

const COLLECTION = "orders";

export interface CreateOrderInput {
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Both set together, and only when paymentMethod is "split". */
  cashAmount?: number;
  upiAmount?: number;
  /** Both set together, and only when paymentMethod is "credit". */
  customerId?: string;
  customerName?: string;
  workerId: string;
  /** See Order.billedByName. */
  billedByName?: string;
  /** From getNextBillNo() — see billCounter.ts. */
  billNo: number;
}

export interface CreateOrderResult {
  orderId: string;
  ref: DocumentReference;
  /**
   * Resolves once Firestore confirms the write reached the server —
   * useful for logging/telemetry, but do NOT await this to decide whether
   * to proceed with the UI (print the bill, clear the cart). Per the
   * Firestore Web SDK's own documented behaviour, this promise does not
   * resolve at all while the device is offline, so awaiting it here would
   * silently undo the "works offline" design this function's doc comment
   * promises: `orderId`/`ref` are already final and usable the moment this
   * function returns, because the local write lands in Firestore's cache
   * (and the UI reflects it) synchronously with the `setDoc()` call below,
   * not when the network round-trip finishes.
   */
  synced: Promise<void>;
}

/**
 * Writes the order via Firestore's local cache first (optimistic — works
 * offline per TDD §4/§8). `syncedAt` starts null; call `markOrderSynced`
 * once the write is confirmed (e.g. from a `hasPendingWrites` listener).
 *
 * Deliberately NOT an `async function` returning a single write-completion
 * promise — see `synced` above for why. `orderId`/`ref` come back the
 * instant the local doc ref and optimistic cache write exist, not once the
 * server has acknowledged them.
 */
export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const db = getFirestoreDb();
  const ref = doc(collection(db, COLLECTION));
  const synced = setDoc(ref, {
    ...input,
    status: "completed",
    syncedAt: null,
    createdAt: serverTimestamp(),
  }).then(() => undefined);
  return { orderId: ref.id, ref, synced };
}

/** Marks the order confirmed-written; called once Firestore reports the write left the local queue. */
export async function markOrderSynced(orderId: string): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, orderId), { syncedAt: serverTimestamp() });
}

export interface OrderSyncState {
  isPending: boolean;
  /**
   * True when the local write has cleared the queue but the document
   * doesn't exist server-side — i.e. it was rejected once it actually
   * reached the server (most likely by the `orders create` security rule,
   * e.g. a worker deactivated while an order sat queued offline). A
   * genuinely-synced order can never hit this, since it exists precisely
   * because the write it came from succeeded. Callers must not treat
   * `!isPending` alone as "synced" — a rejected write also stops being
   * pending, just not by succeeding.
   */
  rejected: boolean;
}

/** Watches a single just-created order and calls back once it's no longer pending a local write. */
export function watchOrderSyncStatus(
  orderId: string,
  onSyncStateChange: (state: OrderSyncState) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  return onSnapshot(
    doc(db, COLLECTION, orderId),
    { includeMetadataChanges: true },
    (snap) => {
      onSyncStateChange({
        isPending: snap.metadata.hasPendingWrites,
        rejected: !snap.metadata.hasPendingWrites && !snap.exists(),
      });
    },
    onError,
  );
}

export async function getOrdersInRange(start: Date, end: Date): Promise<Order[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<Order, "orderId">) }));
}

/** Realtime subscription for the Owner dashboard/reports (TDD §7). */
export function subscribeToOrdersInRange(
  start: Date,
  end: Date,
  onChange: (orders: Order[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<Order, "orderId">) })));
    },
    onError,
  );
}

/**
 * One-shot counterpart to subscribeToRecentOrders below — same query, same
 * voided-order padding/filtering. Used by the Worker app's "delete recent
 * bill" panel as of 2026-09-09: that panel is only open when a staff member
 * is actually looking at it, so a live listener re-delivering on every
 * order billed anywhere, for as long as the worker screen stayed open (the
 * whole shift), was read volume with no one there to see most of it.
 */
export async function getRecentOrders(count: number): Promise<Order[]> {
  const db = getFirestoreDb();
  const fetchLimit = count * 4;
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(fetchLimit));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ orderId: d.id, ...(d.data() as Omit<Order, "orderId">) }))
    .filter((o) => o.status !== "voided")
    .slice(0, count);
}

/**
 * Live view of the most recently billed orders, across any worker on this
 * device — backs the Worker app's "delete recent bill" panel (firestore.rules
 * lets a worker void their own just-billed order within 24 hours, so a
 * mis-billed sale can be undone without waiting for the owner). Fetches more
 * than `count` and filters voided orders out client-side rather than adding
 * a `where("status", "!=", "voided")` — that would need a composite index
 * (an inequality filter combined with the createdAt orderBy) for what's a
 * small, rarely-reordered collection at this cafe's order volume; filtering
 * a few extra already-fetched docs is cheaper than maintaining one.
 */
export function subscribeToRecentOrders(
  count: number,
  onChange: (orders: Order[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  // Padding for the voided orders filtered out below — generous enough that
  // a burst of voids in a row still leaves `count` live orders on screen.
  const fetchLimit = count * 4;
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(fetchLimit));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map((d) => ({ orderId: d.id, ...(d.data() as Omit<Order, "orderId">) }))
        .filter((o) => o.status !== "voided")
        .slice(0, count);
      onChange(orders);
    },
    onError,
  );
}

/**
 * Owner-only correction path (e.g. fixing a mis-entered discount) — see
 * Data Model §7. Not currently called from either app's UI (no screen
 * offers it yet). Left in place for that future feature, but note it will
 * be rejected by the `orders update` rule as it stands today — that rule
 * now only recognises the specific shape `voidOrder` writes (see below and
 * firestore.rules); this path needs the same actor-verification treatment
 * before it can ship.
 */
/**
 * Every order this customer was ever billed for — the "what did they buy on
 * credit" half of CustomerHistoryModal (requested 2026-09-05), the other
 * half being customers.service.ts's getCustomerPayments. One-shot, not a
 * live subscription: this only runs when someone actually opens a
 * customer's history, not continuously in the background the way
 * Sales/Expenses/Loan's always-on listeners do — deliberately, given how
 * fragile the Firestore read quota has been.
 *
 * No `orderBy` in the query on purpose: `where("customerId", "==", ...)`
 * combined with `orderBy("createdAt")` needs a composite index Firestore
 * doesn't have yet; sorting the (small, per-customer) result client-side
 * avoids needing to create and deploy one. `limit()` bounds a customer
 * with an unusually long history rather than fetching everything they've
 * ever bought.
 */
export async function getCustomerOrders(customerId: string, maxCount = 200): Promise<Order[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, COLLECTION), where("customerId", "==", customerId), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ orderId: d.id, ...(d.data() as Omit<Order, "orderId">) }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export type UpdateOrderInput = Partial<
  Pick<Order, "items" | "subtotal" | "discount" | "total" | "paymentMethod" | "status">
>;

export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, orderId), input);
}

/**
 * Cancels a mistakenly-billed order — owner-only (see firestore.rules:
 * `orders update` requires `voidedBy` to name a real, active owner).
 *
 * A soft delete, not `deleteDoc`: the document stays, so the bill number
 * and the fact that an order once existed here are still on record — only
 * `status` changes, and every sales/report calculation is expected to
 * filter voided orders out (see computeDashboardStats, chartBuckets, and
 * ReportsScreen — none of them are Firestore-query-side filters, since
 * "still visible in history, just excluded from totals" needs the full
 * document, not a narrower query).
 *
 * Reading-then-writing needs a transaction — not a problem here, unlike
 * order *creation*: this only ever runs from the owner app, which has no
 * offline write path to begin with (initFirebase({ offlinePersistence:
 * false })), so there's no "must work with zero connectivity" constraint
 * to preserve. The transaction buys real correctness instead: it can't
 * double-void the same order, and if the order was a credit sale, the
 * customer's balance is reversed in the same atomic write rather than as
 * a separate, ever-so-slightly-racy follow-up call.
 */
export async function voidOrder(orderId: string, voidedBy: string): Promise<void> {
  const db = getFirestoreDb();
  const orderRef = doc(db, COLLECTION, orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error("Order not found.");
    const order = snap.data() as Omit<Order, "orderId">;
    if (order.status === "voided") return; // already voided — idempotent, not an error

    tx.update(orderRef, { status: "voided", voidedAt: serverTimestamp(), voidedBy });

    // A credit sale put money on the customer's tab when it was billed —
    // voiding it has to take that back, or the customer keeps owing for an
    // order that officially never happened.
    if (order.paymentMethod === "credit" && order.customerId) {
      // "customers" isn't imported as a constant here — customers.service.ts
      // owns that collection and this is the one place outside it that
      // needs to touch a customer document, specifically to keep this
      // reversal atomic with the void itself.
      tx.update(doc(db, "customers", order.customerId), {
        balance: increment(-order.total),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

// pruneOldOrders (permanently deleted anything past the 3-day window, orders
// only, no trace kept) lived here until 2026-09-01 — superseded by
// archiveAndPruneOldData in dailySummary.service.ts, which saves each
// affected day's totalSales/totalSpent/orderCount to `dailySummaries`
// before deleting, and covers `expenses` too (this old function never
// pruned those at all, so they accumulated forever). Same 3-day product
// decision and the same firestore.rules floor still apply — only how the
// history is kept changed, not the retention window itself.
