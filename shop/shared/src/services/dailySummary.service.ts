import {
  Timestamp,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import { businessDayKey, businessDayStart } from "../utils/businessDay";

const COLLECTION = "dailySummaries";

export interface DailySummary {
  /** Business-day key (YYYY-MM-DD), matching the document id. */
  date: string;
  /** Sum of order totals for the day, voided orders excluded — same rule computeDashboardStats uses. */
  totalSales: number;
  /** Sum of expense amounts for the day. */
  totalSpent: number;
  /** Non-voided order count for the day. */
  orderCount: number;
}

/** One-shot counterpart to subscribeToDailySummariesInRange — added
 *  2026-09-07 when the owner app moved off live listeners onto
 *  fetch-once-plus-manual-refresh (see useOrdersInRange's own comment). */
export async function getDailySummariesInRange(start: Date, end: Date): Promise<DailySummary[]> {
  const db = getFirestoreDb();
  const startKey = businessDayKey(start);
  const endKey = businessDayKey(new Date(end.getTime() - 1));
  const q = query(collection(db, COLLECTION), where("date", ">=", startKey), where("date", "<=", endKey));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DailySummary);
}

/** Live totals for every business day whose summary falls in [start, end).
 *  Days still inside the detail-retention window (see
 *  archiveAndPruneOldData below) have no document here yet — their totals
 *  come from the live `orders`/`expenses` queries instead, never from
 *  this collection, so the two sources never double-count the same day. */
export function subscribeToDailySummariesInRange(
  start: Date,
  end: Date,
  onChange: (summaries: DailySummary[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const startKey = businessDayKey(start);
  // `end` is exclusive (matches every other range helper in this app) —
  // back it off one millisecond before keying so the day *containing* it
  // isn't pulled in past the boundary.
  const endKey = businessDayKey(new Date(end.getTime() - 1));
  const q = query(collection(db, COLLECTION), where("date", ">=", startKey), where("date", "<=", endKey));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as DailySummary)),
    onError,
  );
}

/**
 * Archives everything older than `keepDays` business days into permanent
 * per-day totals, then deletes the detailed order/expense records —
 * replaces the old pruneOldOrders (orders-only, no archive step: history
 * older than 3 days simply vanished, silently making Reports' week/month
 * totals wrong the moment any day fell out of that window). Requested
 * 2026-09-01: "keep billing details... just three days... but total
 * sales and total spend on that day... should be saved."
 *
 * Order of operations matters: the increment-merge into `dailySummaries`
 * happens before any delete. Re-running this before a previous run's
 * deletes finished would double-count that day (a real but small window —
 * both steps are plain awaited calls, no transaction ties them together;
 * same best-effort standard pruneOldOrders itself already accepted rather
 * than a hard guarantee, which would need a still-absent Cloud Function).
 * Once a doc is deleted it can never be summed again, which is what keeps
 * a normal (non-crashing) run exactly-once even without one.
 */
export async function archiveAndPruneOldData(
  keepDays: number,
): Promise<{ orderCount: number; expenseCount: number; daysArchived: number }> {
  const db = getFirestoreDb();
  const cutoff = businessDayStart(new Date());
  cutoff.setDate(cutoff.getDate() - (keepDays - 1));
  const cutoffTs = Timestamp.fromDate(cutoff);

  const [oldOrders, oldExpenses] = await Promise.all([
    getDocs(query(collection(db, "orders"), where("createdAt", "<", cutoffTs))),
    getDocs(query(collection(db, "expenses"), where("createdAt", "<", cutoffTs))),
  ]);

  type Totals = { totalSales: number; totalSpent: number; orderCount: number };
  const perDay = new Map<string, Totals>();
  const bucket = (key: string): Totals => {
    let v = perDay.get(key);
    if (!v) {
      v = { totalSales: 0, totalSpent: 0, orderCount: 0 };
      perDay.set(key, v);
    }
    return v;
  };

  for (const d of oldOrders.docs) {
    const order = d.data();
    if (!order.createdAt) continue; // still-queued offline write with no server timestamp yet — skip, catches next run
    const b = bucket(businessDayKey((order.createdAt as Timestamp).toDate()));
    // Voided orders don't count as sales (see computeDashboardStats), but
    // still get deleted below — there's nothing left worth keeping detail
    // on once the archive window passes.
    if (order.status !== "voided") {
      b.totalSales += order.total ?? 0;
      b.orderCount += 1;
    }
  }
  for (const d of oldExpenses.docs) {
    const expense = d.data();
    if (!expense.createdAt) continue;
    bucket(businessDayKey((expense.createdAt as Timestamp).toDate())).totalSpent += expense.amount ?? 0;
  }

  for (const [date, totals] of perDay) {
    await setDoc(
      doc(db, COLLECTION, date),
      {
        date,
        totalSales: increment(totals.totalSales),
        totalSpent: increment(totals.totalSpent),
        orderCount: increment(totals.orderCount),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  const toDelete = [...oldOrders.docs, ...oldExpenses.docs];
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of toDelete.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }

  return { orderCount: oldOrders.docs.length, expenseCount: oldExpenses.docs.length, daysArchived: perDay.size };
}
