import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { dayKey, type DateRange } from './dateRange';
import { getServices } from './firebase';
import { lineTotalMinor } from './money';
import { PAYMENT_METHODS, type Order, type OrderLine, type OrderLineInput, type PaymentMethod } from './types';

export interface CreateOrderInput {
  lines: OrderLineInput[];
  paymentMethod: PaymentMethod;
}

export interface CreatedOrder {
  id: string;
  orderNo: number;
  totalMinor: number;
}

/**
 * Saves a sale. The order number comes from a per-day counter bumped in the same
 * transaction as the order, so two counters never hand out the same number.
 * This needs a connection: Firestore transactions fail while offline.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { lines, paymentMethod } = input;
  if (lines.length === 0) throw new Error('An order needs at least one item');
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error(`Unknown payment method: ${paymentMethod}`);
  for (const l of lines) {
    if (!Number.isInteger(l.grams) || l.grams <= 0) throw new Error(`Invalid weight for ${l.name}`);
    if (!Number.isInteger(l.pricePerKgMinor) || l.pricePerKgMinor < 0) throw new Error(`Invalid price for ${l.name}`);
  }

  // Totals are computed here, not by the caller, so every order is priced the same way.
  const orderLines: OrderLine[] = lines.map((l) => ({ ...l, lineTotalMinor: lineTotalMinor(l.pricePerKgMinor, l.grams) }));
  const totalMinor = orderLines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const totalGrams = orderLines.reduce((sum, l) => sum + l.grams, 0);

  const { db } = getServices();
  const now = new Date();
  const key = dayKey(now);
  const counterRef = doc(db, 'counters', key);
  const orderRef = doc(collection(db, 'orders'));

  const orderNo = await runTransaction(db, async (tx) => {
    const counter = await tx.get(counterRef);
    const next: number = counter.exists() ? (counter.data().next as number) : 1;
    tx.set(counterRef, { next: next + 1 });
    tx.set(orderRef, {
      orderNo: next,
      dayKey: key,
      createdAt: Timestamp.fromDate(now),
      lines: orderLines,
      totalMinor,
      totalGrams,
      paymentMethod,
    });
    return next;
  });

  return { id: orderRef.id, orderNo, totalMinor };
}

function toOrder(id: string, data: DocumentData): Order {
  return {
    id,
    orderNo: data.orderNo,
    dayKey: data.dayKey,
    createdAt: (data.createdAt as Timestamp).toDate(),
    lines: data.lines,
    totalMinor: data.totalMinor,
    totalGrams: data.totalGrams,
    paymentMethod: data.paymentMethod,
  };
}

/** Live orders in `range`, newest first. Range and sort share one field, so no composite index is needed. */
export function subscribeOrders(
  range: DateRange,
  onData: (orders: Order[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getServices();
  const q = query(
    collection(db, 'orders'),
    where('createdAt', '>=', Timestamp.fromDate(range.start)),
    where('createdAt', '<', Timestamp.fromDate(range.end)),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((d) => toOrder(d.id, d.data()))), onError);
}
