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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type { Customer, CustomerPayment } from "../types";

const CUSTOMERS = "customers";
const PAYMENTS = "customerPayments";

/** Match key for a returning customer — trimmed, collapsed, lower-cased. */
export function customerNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Finds the existing record for this name, or creates one.
 *
 * Matching on a normalised key matters more than it looks: without it, "Ravi
 * Stores" and "ravi  stores" become two customers and the balance splits
 * across both, which is exactly the way a paper khata goes wrong.
 *
 * Returns synchronously-usable ids — the lookup needs the network, but the
 * create does not, so a brand-new customer can still be opened offline.
 */
export async function findOrCreateCustomer(name: string): Promise<{ customerId: string; created: boolean }> {
  const db = getFirestoreDb();
  const key = customerNameKey(name);

  const existing = await getDocs(
    query(collection(db, CUSTOMERS), where("nameKey", "==", key), limit(1)),
  );
  if (!existing.empty) return { customerId: existing.docs[0].id, created: false };

  const ref = doc(collection(db, CUSTOMERS));
  await setDoc(ref, {
    name: name.trim().replace(/\s+/g, " "),
    nameKey: key,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { customerId: ref.id, created: true };
}

/**
 * Moves a customer's balance by `delta` — positive for a credit order, and
 * negative for a settlement.
 *
 * `increment` rather than read-then-write: it is applied server-side, so two
 * tills (or a queued offline write landing late) can't overwrite each other's
 * change, and unlike a transaction it still works with no connection.
 */
export function adjustCustomerBalance(customerId: string, delta: number): Promise<void> {
  const db = getFirestoreDb();
  return updateDoc(doc(db, CUSTOMERS, customerId), {
    balance: increment(delta),
    updatedAt: serverTimestamp(),
  });
}

/** One-shot counterpart to subscribeToOutstandingCustomers — added
 *  2026-09-07 when the owner/reports apps moved off live listeners onto
 *  fetch-once-plus-manual-refresh (see useOrdersInRange's own comment for
 *  why: this collection's own live subscription was one of the ordinary
 *  contributors to the Firestore read quota getting exhausted mid-day). */
export async function getOutstandingCustomers(): Promise<Customer[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, CUSTOMERS), where("balance", ">", 0), orderBy("balance", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ customerId: d.id, ...(d.data() as Omit<Customer, "customerId">) }));
}

/**
 * Everyone who currently owes something.
 *
 * This is the counter's whole customer list. Settled customers fall out of it
 * on their own once the balance reaches zero — nothing is deleted, they just
 * stop being the till's problem.
 */
export function subscribeToOutstandingCustomers(
  onChange: (customers: Customer[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(collection(db, CUSTOMERS), where("balance", ">", 0), orderBy("balance", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ customerId: d.id, ...(d.data() as Omit<Customer, "customerId">) }))),
    onError,
  );
}

/** Every customer ever, settled or not — the owner's record. */
export function subscribeToAllCustomers(
  onChange: (customers: Customer[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(collection(db, CUSTOMERS), orderBy("balance", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ customerId: d.id, ...(d.data() as Omit<Customer, "customerId">) }))),
    onError,
  );
}

export interface RecordPaymentInput {
  customerId: string;
  customerName: string;
  amount: number;
  workerId: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  /** Settles when the server has both the receipt and the balance change.
   *  Don't await it before confirming to the worker — Firestore write
   *  promises don't resolve while offline. */
  committed: Promise<unknown>;
}

/**
 * Takes money off a balance, and leaves a receipt behind.
 *
 * Two writes rather than one: the payment document is the audit trail, and
 * the balance is the fast lookup the till needs. They are not atomic with
 * each other — Firestore transactions need a connection, and this has to work
 * mid-outage — so the payments collection is the source of truth if they ever
 * disagree, and the owner can reconcile a balance from it.
 */
export function recordCustomerPayment(input: RecordPaymentInput): RecordPaymentResult {
  const db = getFirestoreDb();
  const ref = doc(collection(db, PAYMENTS));
  const receipt = setDoc(ref, {
    customerId: input.customerId,
    customerName: input.customerName,
    amount: input.amount,
    workerId: input.workerId,
    createdAt: serverTimestamp(),
  });
  const balance = adjustCustomerBalance(input.customerId, -input.amount);
  return { paymentId: ref.id, committed: Promise.all([receipt, balance]) };
}

export async function getPaymentsInRange(start: Date, end: Date): Promise<CustomerPayment[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, PAYMENTS),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ paymentId: d.id, ...(d.data() as Omit<CustomerPayment, "paymentId">) }));
}

/**
 * Every payment this customer has ever made — the "how much came back"
 * half of CustomerHistoryModal (requested 2026-09-05), paired with
 * orders.service.ts's getCustomerOrders. One-shot for the same reason
 * that one is: only runs when a customer's history is actually opened.
 * customerPayments is append-only and never pruned (see its own
 * firestore.rules comment), so unlike orders this has no retention-window
 * limitation — every payment a customer ever made is still here.
 */
export async function getCustomerPayments(customerId: string, maxCount = 200): Promise<CustomerPayment[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, PAYMENTS), where("customerId", "==", customerId), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ paymentId: d.id, ...(d.data() as Omit<CustomerPayment, "paymentId">) }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

/** Realtime counterpart to getPaymentsInRange — mirrors
 *  subscribeToExpensesInRange's shape/pattern. Added for reports-app's
 *  day-wise Loan breakdown (requested 2026-09-04): "given" (credit orders)
 *  needs pairing with "received" (payments) per day, and both need to stay
 *  live the same way Sales/Expenses already do. */
export function subscribeToPaymentsInRange(
  start: Date,
  end: Date,
  onChange: (payments: CustomerPayment[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, PAYMENTS),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ paymentId: d.id, ...(d.data() as Omit<CustomerPayment, "paymentId">) })));
    },
    onError,
  );
}
