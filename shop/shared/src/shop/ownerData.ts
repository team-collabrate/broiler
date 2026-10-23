import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where, type DocumentData } from "firebase/firestore";
import {
  dayKey,
  dayTotalsFromData,
  dayTotalsFromOrders,
  firstKeptDay,
  type CustomerPayment,
  type DayRange,
  type DayTotals,
  type Order,
  type OrderLine,
  type PaymentMethod,
  type SettleMethod,
} from "../core";
import { getFirestoreDb } from "../firebase";
import { browserStore } from "./storage";

// What the owner's app reads: bills, the saved daily totals and a customer's history. Everything here is one fetch,
// never a live listener, so a phone left open costs no reads. Only the owner may read these collections.

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

/** A bill as stored. */
export function toOrder(id: string, d: DocumentData): Order {
  const createdAt = toDate(d.createdAt) ?? new Date(0);
  return {
    id,
    orderNo: Number(d.orderNo ?? 0),
    dayKey: String(d.dayKey ?? dayKey(createdAt)),
    ...(typeof d.device === "string" && { device: d.device }),
    createdAt,
    ...(toDate(d.soldAt) && { soldAt: toDate(d.soldAt) as Date }),
    ...(typeof d.staffName === "string" && d.staffName !== "" && { staffName: d.staffName }),
    lines: Array.isArray(d.lines) ? (d.lines as OrderLine[]) : [],
    totalMinor: Number(d.totalMinor ?? 0),
    ...(typeof d.roundOffMinor === "number" && d.roundOffMinor !== 0 && { roundOffMinor: d.roundOffMinor }),
    totalGrams: Number(d.totalGrams ?? 0),
    totalPieces: Number(d.totalPieces ?? 0),
    paymentMethod: (d.paymentMethod as PaymentMethod) ?? "cash",
    ...(typeof d.cashAmountMinor === "number" && { cashAmountMinor: d.cashAmountMinor }),
    ...(typeof d.upiAmountMinor === "number" && { upiAmountMinor: d.upiAmountMinor }),
    ...(typeof d.customerId === "string" && { customerId: d.customerId }),
    ...(typeof d.customerName === "string" && { customerName: d.customerName }),
    ...(d.status === "voided" && { status: "voided" as const, voidedAt: toDate(d.voidedAt), voidedBy: typeof d.voidedBy === "string" ? d.voidedBy : undefined }),
  };
}

/** Every bill from `fromKey` to `toKey` (days, inclusive), newest first. Keep the range to the days still held in full. */
export async function getOrdersInDays(range: DayRange): Promise<Order[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), "orders"), where("dayKey", ">=", range.fromKey), where("dayKey", "<=", range.toKey)));
  return snap.docs.map((d) => toOrder(d.id, d.data())).sort((a, b) => (b.soldAt ?? b.createdAt).getTime() - (a.soldAt ?? a.createdAt).getTime());
}

/** The saved totals of the days in the range that have been rolled up (older than the 4 days of full bills). */
export async function getDayTotals(range: DayRange): Promise<DayTotals[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), "dailySummaries"), where("dayKey", ">=", range.fromKey), where("dayKey", "<=", range.toKey)));
  return snap.docs.map((d) => dayTotalsFromData(d.id, d.data())).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** A customer's credit bills, newest first (the latest `max`). */
export async function getCustomerOrders(customerId: string, max = 40): Promise<Order[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), "orders"), where("customerId", "==", customerId), limit(max)));
  return snap.docs.map((d) => toOrder(d.id, d.data())).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** The payments a customer has made against their balance, newest first (the latest `max`). */
export async function getCustomerPayments(customerId: string, max = 40): Promise<CustomerPayment[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), "customerPayments"), where("customerId", "==", customerId), limit(max)));
  return snap.docs
    .map((d): CustomerPayment => {
      const data = d.data();
      return {
        id: d.id,
        customerId: String(data.customerId ?? ""),
        customerName: String(data.customerName ?? ""),
        amountMinor: Number(data.amountMinor ?? 0),
        method: (data.method === "upi" ? "upi" : "cash") as SettleMethod,
        createdAt: toDate(data.createdAt) ?? new Date(0),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface RollUpResult {
  /** Days whose totals were saved in this run. */
  daysSaved: number;
  /** Bills removed after their day was saved. */
  billsRemoved: number;
  /** Bills the rules refused to remove (they will be tried again another day). */
  refused: number;
}

const REMOVE_AT_ONCE = 20;

/**
 * Keeps the free plan's limits: every day older than the 4 days of full bills is saved as one totals record, and
 * only then are that day's bills removed. A day is only saved once and never overwritten (the rules enforce both),
 * and the rules refuse to remove a bill whose day has no saved totals, so no figure can be lost. A day with leftovers
 * (a bill the rules refused, or a run cut short) is finished the next time. Works through at most `maxDays` days a run.
 */
export async function rollUpOldDays(now: Date = new Date(), maxDays = 14): Promise<RollUpResult> {
  const db = getFirestoreDb();
  const cutoff = firstKeptDay(now);
  const result: RollUpResult = { daysSaved: 0, billsRemoved: 0, refused: 0 };
  let after = "";
  for (let n = 0; n < maxDays; n++) {
    const oldest = await getDocs(query(collection(db, "orders"), where("dayKey", ">", after), where("dayKey", "<", cutoff), orderBy("dayKey"), limit(1)));
    if (oldest.empty) break;
    const day = String(oldest.docs[0].data().dayKey);
    after = day;
    const bills = await getDocs(query(collection(db, "orders"), where("dayKey", "==", day)));
    const summaryRef = doc(db, "dailySummaries", day);
    if (!(await getDoc(summaryRef)).exists()) {
      const orders = bills.docs.map((d) => toOrder(d.id, d.data()));
      try {
        await setDoc(summaryRef, { ...dayTotalsFromOrders(day, orders), createdAt: serverTimestamp() });
        result.daysSaved += 1;
      } catch (error) {
        // Saved a moment ago by another device (the rules allow it once): carry on. Anything else: stop, remove nothing.
        if (!(await getDoc(summaryRef).then((s) => s.exists(), () => false))) throw error;
      }
    }
    for (let i = 0; i < bills.docs.length; i += REMOVE_AT_ONCE) {
      await Promise.all(
        bills.docs.slice(i, i + REMOVE_AT_ONCE).map((d) =>
          deleteDoc(d.ref).then(
            () => {
              result.billsRemoved += 1;
            },
            () => {
              result.refused += 1;
            },
          ),
        ),
      );
    }
  }
  return result;
}

const ROLLUP_KEY = "broiler.owner.rollUpDay";
const store = browserStore();

/** Runs `rollUpOldDays` at most once per day on this device. Errors are returned, never thrown: the reports still work. */
export async function ensureRolledUp(now: Date = new Date()): Promise<{ ran: boolean; result?: RollUpResult; error?: unknown }> {
  const today = dayKey(now);
  if (store.getItem(ROLLUP_KEY) === today) return { ran: false };
  try {
    const result = await rollUpOldDays(now);
    // Leftovers the rules refused are retried tomorrow; a run that saved everything need not run again today.
    store.setItem(ROLLUP_KEY, today);
    return { ran: true, result };
  } catch (error) {
    return { ran: true, error };
  }
}
