import { collection, doc, runTransaction, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import {
  billLabel,
  counterDocId,
  customerIdFromName,
  customerNameKey,
  dayKey,
  formatLineQuantity,
  isRealSplit,
  MAX_CUSTOMER_NAME,
  MAX_ORDER_LINES,
  MAX_QTY,
  orderLineTotalMinor,
  PAYMENT_METHODS,
  roundBillMinor,
  tidyCustomerName,
  UserError,
  type OrderLine,
  type OrderLineInput,
  type PaymentMethod,
} from "../core";
import { getFirebaseAuth, getFirestoreDb } from "../firebase";
import { abandonBillNo, getDeviceLetter, reserveBillNo, settleBillNo } from "./billCounter";
import { isOnlineNow, needsConnectionError } from "./online";
import { trackSale } from "./outbox";

export interface CreateOrderInput {
  /** From `newOrderId()`. Reuse the same id when retrying a sale, so a retry can never save it twice. */
  orderId: string;
  lines: OrderLineInput[];
  paymentMethod: PaymentMethod;
  /** Required for a `split` bill: the GPay half in paise. The cash half is whatever is left of the total. */
  split?: { upiMinor: number };
  /** Required for a `credit` bill: who it is on account for. A name seen before finds the same customer. */
  customer?: { name: string };
  /** A flat discount in paise off the bill (the lines keep their prices). It must be above zero and less than the lines' sum. */
  discountMinor?: number;
  /** Round the bill to the nearest ten rupees. The lines keep their own prices; the difference is saved as `roundOffMinor`. */
  roundOff?: boolean;
  /** The worker who was billing (up to 40 letters). Optional. */
}

export interface CreatedOrder {
  id: string;
  orderNo: number;
  /** The counter (tablet) letter that made the sale. */
  device: string;
  /** What is printed on the bill: the number, with the counter letter in front for any counter but A. */
  label: string;
  totalMinor: number;
  /** When the sale was made, by this tablet's clock. */
  soldAt: Date;
  /** Credit bills only: the customer's name as the book has it, which is what the bill should show. */
  customerName?: string;
  /** The flat discount taken off, in paise; absent when there was none. */
  discountMinor?: number;
  /** How much the total was rounded (negative when rounded down); absent when it was not. */
  roundOffMinor?: number;
}

/** A fresh order id. Make one per sale and keep it until the sale is saved. */
export function newOrderId(): string {
  return doc(collection(getFirestoreDb(), "orders")).id;
}

/** A sale was dropped (the cart changed after a failed save): its bill number goes back. */
export function abandonOrder(orderId: string): void {
  abandonBillNo(orderId);
}

function checkLine(l: OrderLineInput): void {
  const isInt = Number.isInteger;
  if (l.unit !== "kg" && l.unit !== "piece") throw new UserError(`${l.name}: invalid unit`);
  if (!isInt(l.rateMinor) || l.rateMinor <= 0 || !isInt(l.listRateMinor) || l.listRateMinor <= 0) throw new UserError(`${l.name}: invalid rate`);
  if (l.unit === "piece") {
    if (!isInt(l.qty) || l.qty < 1 || l.qty > MAX_QTY || l.grams !== 0) throw new UserError(`${l.name}: invalid count`);
  } else if (!isInt(l.grams) || l.grams <= 0 || l.qty !== 0) {
    throw new UserError(`${l.name}: invalid weight`);
  }
  if (l.amountMinor !== undefined && (!isInt(l.amountMinor) || l.amountMinor <= 0)) throw new UserError(`${l.name}: invalid amount`);
}

/**
 * Saves a sale. Cash, UPI and split sales are written to the tablet first and uploaded by Firestore whenever the
 * connection allows, so this returns at once, with or without internet: the bill number is made on the tablet, the
 * order and the day's counter note go in one batch, and the outbox (see outbox.ts) tracks the upload. The order id
 * is chosen by the caller.
 *
 * A credit bill is different: it changes a customer's balance, and the rules only accept that change when the order
 * and the new balance arrive in one server transaction. A transaction needs a connection, so a credit bill asks for
 * one (and is refused with a clear message when there is none) rather than risk a write the server would refuse
 * after the customer had already walked away. See OFFLINE.md.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { orderId, lines, paymentMethod, split, customer, roundOff: roundIt, discountMinor: discountIn } = input;
  if (lines.length === 0) throw new UserError("The bill needs at least one item");
  if (lines.length > MAX_ORDER_LINES) throw new UserError(`A bill can hold at most ${MAX_ORDER_LINES} items`);
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new UserError(`Unknown payment method: ${paymentMethod}`);
  lines.forEach(checkLine);
  const customerName = customer ? tidyCustomerName(customer.name) : "";
  if (paymentMethod === "credit" && (customerName === "" || customerName.length > MAX_CUSTOMER_NAME)) {
    throw new UserError("A credit bill needs a customer name");
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
    // A weight line made of equal packs (2 × 250 g) keeps its pack count so the bill can say so.
    ...(l.unit === "kg" && l.amountMinor === undefined && l.packs !== undefined && l.packs >= 2 && { packs: l.packs }),
    lineTotalMinor: orderLineTotalMinor(l),
  }));
  const subtotalMinor = orderLines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const discountMinor = discountIn ?? 0;
  if (!Number.isInteger(discountMinor) || discountMinor < 0 || (discountMinor > 0 && discountMinor >= subtotalMinor)) {
    throw new UserError("The discount must be less than the bill");
  }
  // The discount comes off first; the round-off then works on what is left.
  const netMinor = subtotalMinor - discountMinor;
  const roundOffMinor = roundIt ? roundBillMinor(netMinor) - netMinor : 0;
  const totalMinor = netMinor + roundOffMinor;
  const totalGrams = orderLines.reduce((sum, l) => sum + l.grams, 0);
  const totalPieces = orderLines.reduce((sum, l) => sum + l.qty, 0);

  if (paymentMethod === "split" && !(split && isRealSplit(totalMinor, split.upiMinor))) {
    throw new UserError("A split bill needs an amount in both GPay and cash");
  }
  const upiMinor = paymentMethod === "split" && split ? Math.round(split.upiMinor) : 0;

  if (paymentMethod === "credit" && !isOnlineNow()) {
    throw needsConnectionError();
  }

  const db = getFirestoreDb();
  const now = new Date();
  const day = dayKey(now);
  const device = getDeviceLetter();
  const orderNo = reserveBillNo(orderId, day, device);
  const label = billLabel(day, device, orderNo);
  const orderRef = doc(db, "orders", orderId);
  const counterRef = doc(db, "counters", counterDocId(day, device));
  const customerId = paymentMethod === "credit" ? customerIdFromName(customerName) : "";
  const customerRef = paymentMethod === "credit" ? doc(db, "customers", customerId) : null;

  // `createdAt` is the server's clock, which the rules require, so it records when the sale arrived. `soldAt` is
  // when it was made, by this tablet's clock: the rules accept it only if it is recent, so a wrong clock cannot
  // push a sale more than a few days from the truth. Reports use `soldAt`.
  const orderData = (existingName?: string) => ({
    orderNo,
    dayKey: day,
    device,
    soldAt: Timestamp.fromDate(now),
    createdAt: serverTimestamp(),
    lines: orderLines,
    totalMinor,
    ...(discountMinor > 0 && { discountMinor }),
    ...(roundOffMinor !== 0 && { roundOffMinor }),
    totalGrams,
    totalPieces,
    paymentMethod,
    ...(paymentMethod === "split" && { upiAmountMinor: upiMinor, cashAmountMinor: totalMinor - upiMinor }),
    ...(paymentMethod === "credit" && { customerId, customerName: existingName ?? customerName }),
  });

  if (customerRef === null) {
    try {
      const batch = writeBatch(db);
      batch.set(orderRef, orderData());
      // The server's note of how far this counter got today, used to carry on after a reinstall.
      batch.set(counterRef, { next: orderNo + 1 });
      const committed = batch.commit();
      trackSale(
        {
          orderId,
          uid: getFirebaseAuth().currentUser?.uid ?? "",
          label,
          totalMinor,
          soldAtMs: now.getTime(),
          state: "pending",
          // Shown on the counter screen only (in the "bill not accepted" notice), so the units are English.
          summary: lines.map((l) => `${l.name} ${formatLineQuantity(l, "en")}`).join(", ").slice(0, 160),
        },
        committed,
      );
    } catch (error) {
      abandonBillNo(orderId);
      throw error;
    }
    settleBillNo(orderId);
    return { id: orderId, orderNo, device, label, totalMinor, soldAt: now, ...(discountMinor > 0 && { discountMinor }), ...(roundOffMinor !== 0 && { roundOffMinor }) };
  }

  // Credit: one transaction that saves the order and moves the customer's balance together. If it fails after it
  // may have reached the server, the number stays reserved so a retry of the same sale reuses it.
  const saved = await runTransaction(db, async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists()) {
      // This sale was already saved (a retry after a lost response): report it, don't repeat it.
      const data = existing.data();
      return {
        orderNo: data.orderNo as number,
        day: (data.dayKey as string | undefined) ?? day,
        device: (data.device as string | undefined) ?? device,
        totalMinor: data.totalMinor as number,
        soldAt: (data.soldAt as Timestamp | undefined)?.toDate() ?? now,
        customerName: (data.customerName as string | undefined) ?? customerName,
        ...(typeof data.discountMinor === "number" && { discountMinor: data.discountMinor }),
        ...(typeof data.roundOffMinor === "number" && { roundOffMinor: data.roundOffMinor }),
      };
    }
    // Every read comes before the first write, as Firestore requires.
    const customerSnap = await tx.get(customerRef);
    tx.set(counterRef, { next: orderNo + 1 });
    if (customerSnap.exists()) {
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
    const bookName = customerSnap.exists() ? (customerSnap.data().name as string) : customerName;
    tx.set(orderRef, orderData(bookName));
    return { orderNo, day, device, totalMinor, soldAt: now, customerName: bookName, ...(discountMinor > 0 && { discountMinor }), ...(roundOffMinor !== 0 && { roundOffMinor }) };
  });
  settleBillNo(orderId);
  const { day: savedDay, ...rest } = saved;
  return { id: orderId, ...rest, label: billLabel(savedDay, saved.device, saved.orderNo) };
}
