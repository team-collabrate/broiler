import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { dayKey, type DateRange } from './dateRange';
import { getServices } from './firebase';
import { paymentProblem } from './sale';
import type { Customer, CustomerPayment, SettleMethod } from './types';

const toCustomer = (id: string, d: DocumentData): Customer => ({
  id,
  name: String(d.name ?? ''),
  nameKey: String(d.nameKey ?? ''),
  balanceMinor: Number(d.balanceMinor ?? 0),
  updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null,
});

const toPayment = (id: string, d: DocumentData): CustomerPayment => ({
  id,
  customerId: String(d.customerId ?? ''),
  customerName: String(d.customerName ?? ''),
  amountMinor: Number(d.amountMinor ?? 0),
  method: d.method === 'upi' ? 'upi' : 'cash',
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(0),
});

/**
 * Everyone who currently owes something, biggest balance first. This is the counter's whole customer
 * list: a settled customer drops off it by itself (nothing is deleted) and returns the next time they
 * take credit. One fetch, not a live listener, so an idle till costs no reads; call it again when the
 * list is opened.
 */
export async function getOutstandingCustomers(): Promise<Customer[]> {
  const { db } = getServices();
  const snap = await getDocs(query(collection(db, 'customers'), where('balanceMinor', '>', 0), orderBy('balanceMinor', 'desc')));
  return snap.docs.map((d) => toCustomer(d.id, d.data()));
}

/** Live outstanding balances, for the owner's credit screen. */
export function subscribeOutstandingCustomers(onData: (customers: Customer[]) => void, onError: (error: Error) => void): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    query(collection(db, 'customers'), where('balanceMinor', '>', 0), orderBy('balanceMinor', 'desc')),
    (snap) => onData(snap.docs.map((d) => toCustomer(d.id, d.data()))),
    onError,
  );
}

export interface RecordPaymentInput {
  customerId: string;
  /** Money received, in paise. */
  amountMinor: number;
  method: SettleMethod;
}

/**
 * Takes money off a customer's balance and leaves a receipt behind, in one transaction: the balance and
 * the receipt cannot disagree. The balance is re-read inside the transaction, so a bill added in the
 * meantime is not lost, and a payment larger than what is owed is refused.
 */
export async function recordCustomerPayment(input: RecordPaymentInput): Promise<void> {
  const { db } = getServices();
  const customerRef = doc(db, 'customers', input.customerId);
  const paymentRef = doc(collection(db, 'customerPayments'));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) throw new Error('வாடிக்கையாளர் கிடைக்கவில்லை');
    const customer = toCustomer(snap.id, snap.data());
    const problem = paymentProblem(input.amountMinor, customer.balanceMinor);
    if (problem === 'zero') throw new Error('பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்');
    if (problem === 'tooMuch') throw new Error('கடனை விட அதிகம்');
    tx.update(customerRef, {
      balanceMinor: customer.balanceMinor - input.amountMinor,
      lastPaymentId: paymentRef.id,
      updatedAt: serverTimestamp(),
    });
    tx.set(paymentRef, {
      customerId: customer.id,
      customerName: customer.name,
      amountMinor: input.amountMinor,
      method: input.method,
      dayKey: dayKey(new Date()),
      createdAt: serverTimestamp(),
    });
  });
}

/** Live payments received in `range`, newest first (the owner's record of what came back). */
export function subscribePayments(range: DateRange, onData: (payments: CustomerPayment[]) => void, onError: (error: Error) => void): Unsubscribe {
  const { db } = getServices();
  return onSnapshot(
    query(
      collection(db, 'customerPayments'),
      where('createdAt', '>=', Timestamp.fromDate(range.start)),
      where('createdAt', '<', Timestamp.fromDate(range.end)),
      orderBy('createdAt', 'desc'),
    ),
    (snap) => onData(snap.docs.map((d) => toPayment(d.id, d.data()))),
    onError,
  );
}
