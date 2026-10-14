import type { Timestamp } from "firebase/firestore";

/**
 * `split` is cash and UPI together on one bill — the cafe takes no cards, so
 * the card button became the split button.
 *
 * `credit` is a regular buying on account: the sale happens, no money moves,
 * and the total lands on the customer's balance instead.
 *
 * `card` is legacy: no longer offered at the till, but orders taken before
 * the change still carry it, so it stays in the union. Dropping it would
 * make historical orders render a blank payment label in the owner app.
 */
export type PaymentMethod = "cash" | "upi" | "split" | "credit" | "card";
/**
 * `voided` — the owner cancelled a mistakenly-billed order after the fact.
 * The document is kept, never deleted, so the bill number and audit trail
 * survive; every sales/report calculation excludes it instead. Only the
 * owner app can set this (see `voidOrder` and the `orders` update rule in
 * firestore.rules) — a worker mis-billing something is exactly the case
 * this exists for, so the fix can't be something the worker triggers too.
 */
export type OrderStatus = "completed" | "voided";

/** Embedded line item inside `orders/{orderId}.items` — see 05_Data_Model.md §4 */
export interface OrderItem {
  itemId: string;
  /**
   * Canonical English/Tanglish name — screen display when the app language
   * is English, and reports/exports.
   *
   * NOT what's sent to the printer, despite this comment's own history:
   * receipts render to a bitmap (see worker-app/printing/receiptCanvas.ts),
   * not ESC/POS text, specifically so they can carry Tamil script — the
   * receipt always uses `nameTa`, never this field. See BillLine/`name` in
   * printing/receipt.ts.
   */
  name: string;
  /** Tamil-script name captured at time of sale, for on-screen display when
   *  the app language is Tamil, AND for the printed receipt always,
   *  regardless of the app's own language toggle (see the note on `name`). */
  nameTa?: string;
  price: number;
  qty: number;
  note?: string;
}

/** `orders/{orderId}` document — see 05_Data_Model.md §4 */
export interface Order {
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  /**
   * Always 0 for orders taken from 2026-08-29 onward — the cafe gives no
   * discounts and the till no longer offers one. Kept on the document
   * because earlier orders have real values here and the owner's history
   * still has to add up.
   */
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Cash portion of a `split` bill. Absent on every other payment method. */
  cashAmount?: number;
  /** UPI/GPay portion of a `split` bill. Absent on every other method. */
  upiAmount?: number;
  /** Set only on a `credit` order — who owes for it. */
  customerId?: string;
  /** Customer name captured at the time of sale, so history reads even if
   *  the customer record is later renamed. */
  customerName?: string;
  /** Reference to `users.userId` who created the order */
  workerId: string;
  /**
   * Who was actually on shift when this was billed, from the Worker app's
   * shift picker (see useActiveWorkerName / WorkerNameSelect) — separate
   * from `workerId`, which is just whichever shared PIN unlocked the
   * tablet and stays tied to a real `users` doc for firestore.rules'
   * `isActiveUserWithRole` check. This is display-only, captured at the
   * moment of sale so it survives a shift-picker change later. Optional
   * because orders taken before the picker existed don't have one.
   */
  billedByName?: string;
  createdAt: Timestamp;
  /** Set once the write is confirmed by the server; null while queued offline */
  syncedAt: Timestamp | null;
  status: OrderStatus;
  /**
   * The bill number printed on the receipt — a real running count starting
   * at 1, not derived from the order id (see shared/src/services/
   * billCounter.ts). Optional only because orders taken before this field
   * existed don't have one; every order from here on does.
   */
  billNo?: number;
  /** Set only when status is "voided" — who cancelled it and when. */
  voidedAt?: Timestamp;
  voidedBy?: string;
}
