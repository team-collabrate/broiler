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
} from '@broiler/shared';
import { t } from './strings';

/** Everything a bill shows, captured at the moment the sale is saved (the cart is cleared right after). */
export interface BillData {
  orderNo: number;
  createdAt: Date;
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  totalPieces: number;
  paymentMethod: PaymentMethod;
}

export function formatBillDate(date: Date): string {
  return date.toLocaleString('ta-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * One bill line as printable text. `rate` carries its unit (per kilo or per piece); a fixed-amount
 * line says how it was sold, and a line sold at other than the list rate shows the list rate too.
 */
export function billLine(line: CartLine) {
  return {
    name: line.name,
    quantity: formatLineQuantity(line),
    rate: formatRate(line.rateMinor, line.unit),
    amount: formatMoney(orderLineTotalMinor(line)),
    listRate: adjustmentMinor(line) !== 0 ? t.listRate(formatRate(line.listRateMinor, line.unit)) : null,
  };
}

/** The totals block. `weight` and `pieces` are null when the bill has none of that kind. */
export const billTotals = (bill: BillData) => ({
  weight: bill.totalGrams > 0 ? formatWeight(bill.totalGrams) : null,
  pieces: bill.totalPieces > 0 ? formatQty(bill.totalPieces) : null,
  total: formatMoney(bill.totalMinor),
  payment: PAYMENT_LABELS[bill.paymentMethod],
});
