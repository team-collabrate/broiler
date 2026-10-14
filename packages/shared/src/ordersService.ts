import {
  collection,
  doc,
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
import { MAX_ORDER_LINES, MAX_QTY, orderLineTotalMinor } from './sale';
import { PAYMENT_METHODS, type Order, type OrderLine, type OrderLineInput, type PaymentMethod, type Unit } from './types';

export interface CreateOrderInput {
  /** From `newOrderId()`. Reuse the same id when retrying a sale, so a retry can never save it twice. */
  orderId: string;
  lines: OrderLineInput[];
  paymentMethod: PaymentMethod;
}

export interface CreatedOrder {
  id: string;
  orderNo: number;
  totalMinor: number;
}

/** A fresh order id. Make one per sale and keep it until the sale is saved. */
export function newOrderId(): string {
  const { db } = getServices();
  return doc(collection(db, 'orders')).id;
}

function checkLine(l: OrderLineInput): void {
  const isInt = Number.isInteger;
  if (l.unit !== 'kg' && l.unit !== 'piece') throw new Error(`${l.name}: அலகு தவறானது`);
  if (!isInt(l.rateMinor) || l.rateMinor <= 0 || !isInt(l.listRateMinor) || l.listRateMinor <= 0) throw new Error(`${l.name}: விலை தவறானது`);
  if (l.unit === 'piece') {
    if (!isInt(l.qty) || l.qty < 1 || l.qty > MAX_QTY || l.grams !== 0) throw new Error(`${l.name}: எண்ணிக்கை தவறானது`);
    if (l.amountMinor !== undefined && (!isInt(l.amountMinor) || l.amountMinor <= 0)) throw new Error(`${l.name}: தொகை தவறானது`);
  } else {
    if (!isInt(l.grams) || l.grams <= 0 || l.qty !== 0) throw new Error(`${l.name}: எடை தவறானது`);
    if (l.amountMinor !== undefined && (!isInt(l.amountMinor) || l.amountMinor <= 0)) throw new Error(`${l.name}: தொகை தவறானது`);
  }
}

/**
 * Saves a sale. The order number comes from a per-day counter bumped in the same transaction as
 * the order, so two counters never hand out the same number. The order id is chosen by the caller
 * and a second save with the same id returns the first order untouched, so retrying after a lost
 * response cannot double-charge. This needs a connection: Firestore transactions fail while offline.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { orderId, lines, paymentMethod } = input;
  if (lines.length === 0) throw new Error('ஆர்டரில் குறைந்தது ஒரு பொருள் வேண்டும்');
  if (lines.length > MAX_ORDER_LINES) throw new Error(`ஒரு ஆர்டரில் அதிகபட்சம் ${MAX_ORDER_LINES} பொருட்கள்`);
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error(`தெரியாத பணம் செலுத்தும் முறை: ${paymentMethod}`);
  lines.forEach(checkLine);

  // Totals are computed here, not by the caller, so every order is priced the same way. Each field
  // is named, so UI-only fields (like the cart's line key) never reach the database, and
  // `amountMinor` is only written when set: Firestore rejects `undefined` field values.
  const orderLines: OrderLine[] = lines.map((l) => ({
    itemId: l.itemId,
    name: l.name,
    category: l.category,
    unit: l.unit,
    rateMinor: l.rateMinor,
    listRateMinor: l.listRateMinor,
    grams: l.grams,
    qty: l.qty,
    ...(l.amountMinor !== undefined && { amountMinor: l.amountMinor }),
    lineTotalMinor: orderLineTotalMinor(l),
  }));
  const totalMinor = orderLines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const totalGrams = orderLines.reduce((sum, l) => sum + l.grams, 0);
  const totalPieces = orderLines.reduce((sum, l) => sum + l.qty, 0);

  const { db } = getServices();
  const now = new Date();
  const key = dayKey(now);
  const counterRef = doc(db, 'counters', key);
  const orderRef = doc(db, 'orders', orderId);

  const saved = await runTransaction(db, async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists()) {
      // This sale was already saved (a retry after a lost response): report it, don't repeat it.
      return { orderNo: existing.data().orderNo as number, totalMinor: existing.data().totalMinor as number };
    }
    const counter = await tx.get(counterRef);
    const next: number = counter.exists() ? (counter.data().next as number) : 1;
    tx.set(counterRef, { next: next + 1 });
    tx.set(orderRef, {
      orderNo: next,
      dayKey: key,
      // The server's clock, which the rules require, so a wrong tablet clock cannot backdate a sale.
      createdAt: serverTimestamp(),
      lines: orderLines,
      totalMinor,
      totalGrams,
      totalPieces,
      paymentMethod,
    });
    return { orderNo: next, totalMinor };
  });

  return { id: orderId, ...saved };
}

/** One stored line as an `OrderLine`. Orders saved before units existed have per-kg lines named `pricePerKgMinor`. */
function toLine(raw: DocumentData): OrderLine {
  const unit: Unit = raw.unit === 'piece' ? 'piece' : 'kg';
  const rateMinor = Number(raw.rateMinor ?? raw.pricePerKgMinor ?? 0);
  return {
    itemId: String(raw.itemId ?? ''),
    name: String(raw.name ?? ''),
    category: typeof raw.category === 'string' && raw.category !== '' ? raw.category : 'more',
    unit,
    rateMinor,
    listRateMinor: Number(raw.listRateMinor ?? rateMinor),
    grams: Number(raw.grams ?? 0),
    qty: Number(raw.qty ?? 0),
    ...(typeof raw.amountMinor === 'number' && { amountMinor: raw.amountMinor }),
    lineTotalMinor: Number(raw.lineTotalMinor ?? 0),
  };
}

function toOrder(id: string, data: DocumentData): Order {
  return {
    id,
    orderNo: data.orderNo,
    dayKey: data.dayKey,
    createdAt: (data.createdAt as Timestamp).toDate(),
    lines: (data.lines as DocumentData[]).map(toLine),
    totalMinor: data.totalMinor,
    totalGrams: Number(data.totalGrams ?? 0),
    totalPieces: Number(data.totalPieces ?? 0),
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
