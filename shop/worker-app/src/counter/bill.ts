import {
  adjustmentMinor,
  billLabel,
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
import type { BillInput } from "../printing/receipt";
import { t } from "./strings";

export interface SavedSale {
  orderId: string;
  orderNo: number;
  /** The counter letter; the label printed is the number alone for counter A. */
  device?: string;
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
  staffName?: string;
}

/**
 * The printable bill for a saved sale. Every figure is formatted here, once, so the paper shows exactly what the
 * screen showed. Receipts always print in Tamil, whatever the app is showing.
 */
export function toBillInput(sale: SavedSale): BillInput {
  return {
    orderId: sale.orderId,
    billNo: billLabel(sale.device, sale.orderNo),
    createdAt: sale.createdAt,
    lines: sale.lines.map((line) => ({
      name: line.name,
      quantity: formatLineQuantity(line),
      rate: formatRate(line.rateMinor, line.unit),
      amount: formatMoney(orderLineTotalMinor(line)),
      ...(adjustmentMinor(line) !== 0 && { note: t.listRate(formatRate(line.listRateMinor, line.unit)) }),
    })),
    ...(sale.totalGrams > 0 && { totalWeight: formatWeight(sale.totalGrams) }),
    ...(sale.totalPieces > 0 && { totalPieces: formatQty(sale.totalPieces) }),
    total: formatMoney(sale.totalMinor),
    paymentLabel: PAYMENT_LABELS[sale.paymentMethod],
    ...(sale.paymentMethod === "split" &&
      sale.cashAmountMinor !== undefined &&
      sale.upiAmountMinor !== undefined && {
        paymentDetail: `ரொக்கம் ${formatMoney(sale.cashAmountMinor)} + GPay ${formatMoney(sale.upiAmountMinor)}`,
      }),
    ...(sale.paymentMethod === "credit" && sale.customerName && { customerName: sale.customerName }),
    ...(sale.staffName && { staffName: sale.staffName }),
  };
}
