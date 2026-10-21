import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import {
  customerIdFromName,
  customerNameKey,
  dayKey,
  isRealSplit,
  MAX_CUSTOMER_NAME,
  MAX_ORDER_LINES,
  MAX_QTY,
  orderLineTotalMinor,
  PAYMENT_METHODS,
  tidyCustomerName,
  type OrderLine,
  type OrderLineInput,
  type PaymentMethod,
} from "../core";
import { getFirestoreDb } from "../firebase";

export interface CreateOrderInput {
  /** From `newOrderId()`. Reuse the same id when retrying a sale, so a retry can never save it twice. */
  orderId: string;
  lines: OrderLineInput[];
  paymentMethod: PaymentMethod;
  /** Required for a `split` bill: the GPay half in paise. The cash half is whatever is left of the total. */
  split?: { upiMinor: number };
  /** Required for a `credit` bill: who it is on account for. A name seen before finds the same customer. */
  customer?: { name: string };
}

export interface CreatedOrder {
  id: string;
  orderNo: number;
  totalMinor: number;
}

/** A fresh order id. Make one per sale and keep it until the sale is saved. */
export function newOrderId(): string {
  return doc(collection(getFirestoreDb(), "orders")).id;
}

function checkLine(l: OrderLineInput): void {
  const isInt = Number.isInteger;
  if (l.unit !== "kg" && l.unit !== "piece") throw new Error(`${l.name}: அலகு தவறானது`);
  if (!isInt(l.rateMinor) || l.rateMinor <= 0 || !isInt(l.listRateMinor) || l.listRateMinor <= 0) throw new Error(`${l.name}: விலை தவறானது`);
  if (l.unit === "piece") {
    if (!isInt(l.qty) || l.qty < 1 || l.qty > MAX_QTY || l.grams !== 0) throw new Error(`${l.name}: எண்ணிக்கை தவறானது`);
  } else if (!isInt(l.grams) || l.grams <= 0 || l.qty !== 0) {
    throw new Error(`${l.name}: எடை தவறானது`);
  }
  if (l.amountMinor !== undefined && (!isInt(l.amountMinor) || l.amountMinor <= 0)) throw new Error(`${l.name}: தொகை தவறானது`);
}

/**
 * Saves a sale. The order number comes from a per-day counter bumped in the same transaction as the order, so
 * two counters never hand out the same number. The order id is chosen by the caller and a second save with the
 * same id returns the first order untouched, so retrying after a lost response cannot double-charge. A credit
 * bill also moves the customer's balance in the same transaction. This needs a connection; Phase 3 replaces the
 * counter so selling also works offline.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { orderId, lines, paymentMethod, split, customer } = input;
  if (lines.length === 0) throw new Error("ஆர்டரில் குறைந்தது ஒரு பொருள் வேண்டும்");
  if (lines.length > MAX_ORDER_LINES) throw new Error(`ஒரு ஆர்டரில் அதிகபட்சம் ${MAX_ORDER_LINES} பொருட்கள்`);
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error(`தெரியாத பணம் செலுத்தும் முறை: ${paymentMethod}`);
  lines.forEach(checkLine);
  const customerName = customer ? tidyCustomerName(customer.name) : "";
  if (paymentMethod === "credit" && (customerName === "" || customerName.length > MAX_CUSTOMER_NAME)) {
    throw new Error("கடனுக்கு வாடிக்கையாளர் பெயர் வேண்டும்");
  }

  // Totals are computed here, not by the caller, so every order is priced the same way. Each field is named, so
  // UI-only fields (like the cart's line key) never reach the database, and `amountMinor` is only written when
  // set: Firestore rejects `undefined` field values.
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

  if (paymentMethod === "split" && !(split && isRealSplit(totalMinor, split.upiMinor))) {
    throw new Error("GPay மற்றும் ரொக்கம் இரண்டிலும் தொகை வேண்டும்");
  }
  const upiMinor = paymentMethod === "split" && split ? Math.round(split.upiMinor) : 0;

  const db = getFirestoreDb();
  const key = dayKey(new Date());
  const counterRef = doc(db, "counters", key);
  const orderRef = doc(db, "orders", orderId);
  const customerId = paymentMethod === "credit" ? customerIdFromName(customerName) : "";
  const customerRef = paymentMethod === "credit" ? doc(db, "customers", customerId) : null;

  const saved = await runTransaction(db, async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists()) {
      // This sale was already saved (a retry after a lost response): report it, don't repeat it.
      return { orderNo: existing.data().orderNo as number, totalMinor: existing.data().totalMinor as number };
    }
    const counter = await tx.get(counterRef);
    // Every read comes before the first write, as Firestore requires.
    const customerSnap = customerRef ? await tx.get(customerRef) : null;
    const next: number = counter.exists() ? (counter.data().next as number) : 1;
    tx.set(counterRef, { next: next + 1 });
    if (customerRef) {
      if (customerSnap && customerSnap.exists()) {
        tx.update(customerRef, {
          balanceMinor: (customerSnap.data().balanceMinor as number) + totalMinor,
          lastOrderId: orderId,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(customerRef, {
          name: customerName,
          nameKey: customerNameKey(customerName),
          balanceMinor: totalMinor,
          lastOrderId: orderId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
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
      ...(paymentMethod === "split" && { upiAmountMinor: upiMinor, cashAmountMinor: totalMinor - upiMinor }),
      ...(paymentMethod === "credit" && {
        customerId,
        customerName: customerSnap?.exists() ? (customerSnap.data().name as string) : customerName,
      }),
    });
    return { orderNo: next, totalMinor };
  });

  return { id: orderId, ...saved };
}
