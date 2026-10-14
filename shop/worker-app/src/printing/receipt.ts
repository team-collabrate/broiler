import type { PaymentMethod } from "@kumbakonam/shared";

/**
 * The shape of a printable bill.
 *
 * Receipts are rendered to a bitmap (receiptCanvas.ts) rather than emitted as
 * ESC/POS text, because the shop prints in Tamil and thermal printers only
 * carry single-byte Latin codepages. That also means names here keep their
 * Tamil script — nothing is forced back to ASCII for the printer's benefit.
 */
export interface BillLine {
  name: string;
  qty: number;
  price: number;
  note?: string;
}

export interface BillInput {
  orderId: string;
  /** Short human-facing reference shown as "Bill No" on the paper. */
  billNo: string;
  items: BillLine[];
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Payment method in the receipt's own language (receipts always print Tamil). */
  paymentLabel: string;
  /** Credit bills only: who the bill is on account for, printed under the
   *  payment line. A credit slip with no name on it records nothing. */
  customerName?: string;
  /** Split bills only: the two figures, printed on their own line beneath the
   *  payment line. It gets a line to itself because the payment line already
   *  has the worker's name right-aligned on it, and a long name or a
   *  four-figure total would otherwise run the two into each other. */
  paymentBreakdown?: string;
  workerName: string;
  createdAt: Date;
}

const PAYMENT_LABEL_TA: Record<PaymentMethod, string> = {
  cash: "பணம்",
  upi: "UPI",
  split: "பிரித்து",
  credit: "கடன்",
  card: "கார்டு", // legacy: never selectable now, kept so old bills still label
};

export interface SplitAmounts {
  cash: number;
  upi: number;
}

export function paymentLabelForReceipt(method: PaymentMethod): string {
  return PAYMENT_LABEL_TA[method];
}

/**
 * The two halves of a split bill, for the line under the payment line.
 *
 * The customer's copy has to show how much went each way, or the paper can't
 * settle a later question about what was actually handed over. "ரொக்கம்" is
 * used for the cash half so the receipt doesn't read "பணம்: ... பணம் ...".
 */
export function splitBreakdownForReceipt({ cash, upi }: SplitAmounts): string {
  return `ரொக்கம் ${cash.toFixed(2)} + GPay ${upi.toFixed(2)}`;
}

