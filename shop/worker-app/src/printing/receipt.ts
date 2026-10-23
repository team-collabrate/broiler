/**
 * The shape of a printable bill.
 *
 * Receipts are rendered to a bitmap (receiptCanvas.ts) rather than emitted as ESC/POS text, because the
 * shop prints in Tamil and thermal printers only carry single-byte Latin codepages. That also means
 * names here keep their Tamil script, and every figure arrives already formatted (₹, grouping, kilo or
 * count wording) so the paper shows exactly what the screen showed.
 */
export interface BillLine {
  /** The item's Tamil name. */
  name: string;
  /** How much was sold: `1.25 கிலோ`, `≈ 417 கிராம்` (sold by amount) or `3 எண்`. */
  quantity: string;
  /** The rate charged, with its unit: `₹240.00/கிலோ`. */
  rate: string;
  /** The line total: `₹300.00`. */
  amount: string;
  /** A small line under the item, such as the list rate when the price was adjusted. */
  note?: string;
}

import type { OrderLineInput } from "@kumbakonam/shared/core";

export interface BillInput {
  orderId: string;
  /** Short human-facing reference shown as "Bill No" on the paper. */
  billNo: string;
  createdAt: Date;
  lines: BillLine[];
  /** Total weight and total count, only when the bill has any of that kind. */
  totalWeight?: string;
  totalPieces?: string;
  /** The bill total: `₹450.00`. */
  total: string;
  /** Only when the bill was rounded to ten rupees: the lines' sum (`₹243.50`) and the difference (`-₹3.50`), printed above the total. */
  subtotal?: string;
  discount?: string;
  roundOff?: string;
  /** Payment method in the receipt's own language (receipts always print Tamil). */
  paymentLabel: string;
  /**
   * A second payment line: the two halves of a split bill (`ரொக்கம் ₹250.00 + GPay ₹200.00`). It gets a
   * line to itself so a long figure can never run into the staff name on the payment line.
   */
  paymentDetail?: string;
  /** Credit bills only: who the bill is on account for. A credit slip with no name records nothing. */
  customerName?: string;
  /** A reprint of an earlier bill: the paper is marked as a copy so it cannot pass for a second original. */
  isCopy?: boolean;
  /** The items as they were rung up, kept in the recent list so a wrong bill can be put back on the screen and fixed. Not printed. */
  restore?: OrderLineInput[];
}
