import {
  adjustmentMinor,
  formatLineQuantity,
  formatMoney,
  formatQty,
  formatRate,
  formatWeight,
  orderLineTotalMinor,
  PAYMENT_LABELS,
  type CartLine,
  type PaymentMethod,
} from "@kumbakonam/shared/core";
import { billText } from "../printing/billText";
import type { BillInput } from "../printing/receipt";

export interface SavedSale {
  orderId: string;
  /** The number printed on the bill, as made when the sale was saved (`22-10/12`). */
  billNo: string;
  /** When the sale was made. */
  createdAt: Date;
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  totalPieces: number;
  paymentMethod: PaymentMethod;
  /** Split bills: the two halves in paise. */
  cashAmountMinor?: number;
  upiAmountMinor?: number;
  /** Credit bills: who it is on account for. */
  customerName?: string;
}

/**
 * The printable bill for a saved sale. Every figure is formatted here, once, so the paper shows exactly what the
 * screen showed. Receipts always print in Tamil, whatever the app is showing.
 */
export function toBillInput(sale: SavedSale): BillInput {
  return {
    orderId: sale.orderId,
    billNo: sale.billNo,
    createdAt: sale.createdAt,
    lines: sale.lines.map((line) => ({
      name: line.name,
      quantity: formatLineQuantity(line),
      rate: formatRate(line.rateMinor, line.unit),
      amount: formatMoney(orderLineTotalMinor(line)),
      ...(adjustmentMinor(line) !== 0 && { note: billText.listRate(formatRate(line.listRateMinor, line.unit)) }),
    })),
    ...(sale.totalGrams > 0 && { totalWeight: formatWeight(sale.totalGrams) }),
    ...(sale.totalPieces > 0 && { totalPieces: formatQty(sale.totalPieces) }),
    total: formatMoney(sale.totalMinor),
    paymentLabel: PAYMENT_LABELS[sale.paymentMethod],
    ...(sale.paymentMethod === "split" &&
      sale.cashAmountMinor !== undefined &&
      sale.upiAmountMinor !== undefined && {
        paymentDetail: billText.splitDetail(formatMoney(sale.cashAmountMinor), formatMoney(sale.upiAmountMinor)),
      }),
    ...(sale.paymentMethod === "credit" && sale.customerName && { customerName: sale.customerName }),
  };
}
