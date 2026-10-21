import type { Order, PaymentMethod, Unit } from './types';

export interface ItemSales {
  itemId: string;
  name: string;
  category: string;
  unit: Unit;
  /** Weight sold, for `kg` items. */
  grams: number;
  /** Count sold, for `piece` items. */
  qty: number;
  totalMinor: number;
}

export interface CategorySales {
  category: string;
  totalMinor: number;
}

export interface SalesSummary {
  orderCount: number;
  totalMinor: number;
  totalGrams: number;
  totalPieces: number;
  /** Best-selling first, by revenue. */
  byItem: ItemSales[];
  /** Best-selling category first, by revenue. */
  byCategory: CategorySales[];
  /** Revenue per payment method. A credit sale is still a sale on the day it is made. */
  byPayment: Record<PaymentMethod, number>;
  /** Cash that actually reached the till: cash bills plus the cash half of split bills. */
  cashCollectedMinor: number;
  /** What reached the GPay/UPI account: UPI bills plus the GPay half of split bills. A split bill's cash half never touches it. */
  upiCollectedMinor: number;
  /** Sold on credit (கடன்) in the period: no money moved, it is owed. */
  creditGivenMinor: number;
  /** How many lines were sold at a rate other than the list rate. */
  adjustedLines: number;
  /**
   * What those adjustments changed the takings by, in paise: negative means the shop charged
   * less than list. Lines sold for a fixed amount are left out, since they charge that amount
   * whatever the rate.
   */
  adjustmentTotalMinor: number;
}

export function summarizeOrders(orders: Order[]): SalesSummary {
  const items = new Map<string, ItemSales>();
  const categories = new Map<string, number>();
  const byPayment: Record<PaymentMethod, number> = { cash: 0, upi: 0, card: 0, split: 0, credit: 0 };
  let cashCollectedMinor = 0;
  let upiCollectedMinor = 0;
  let totalMinor = 0;
  let totalGrams = 0;
  let totalPieces = 0;
  let adjustedLines = 0;
  let adjustmentTotalMinor = 0;

  for (const order of orders) {
    totalMinor += order.totalMinor;
    totalGrams += order.totalGrams;
    totalPieces += order.totalPieces;
    byPayment[order.paymentMethod] += order.totalMinor;
    if (order.paymentMethod === 'cash') cashCollectedMinor += order.totalMinor;
    else if (order.paymentMethod === 'upi') upiCollectedMinor += order.totalMinor;
    else if (order.paymentMethod === 'split') {
      cashCollectedMinor += order.cashAmountMinor ?? 0;
      upiCollectedMinor += order.upiAmountMinor ?? 0;
    }
    for (const line of order.lines) {
      const entry = items.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.name,
        category: line.category,
        unit: line.unit,
        grams: 0,
        qty: 0,
        totalMinor: 0,
      };
      entry.grams += line.grams;
      entry.qty += line.qty;
      entry.totalMinor += line.lineTotalMinor;
      items.set(line.itemId, entry);
      categories.set(line.category, (categories.get(line.category) ?? 0) + line.lineTotalMinor);

      if (line.rateMinor !== line.listRateMinor) {
        adjustedLines += 1;
        if (line.amountMinor === undefined) {
          const listTotal =
            line.unit === 'piece' ? line.listRateMinor * line.qty : Math.round((line.listRateMinor * line.grams) / 1000);
          adjustmentTotalMinor += line.lineTotalMinor - listTotal;
        }
      }
    }
  }

  return {
    orderCount: orders.length,
    totalMinor,
    totalGrams,
    totalPieces,
    byItem: [...items.values()].sort((a, b) => b.totalMinor - a.totalMinor),
    byCategory: [...categories.entries()]
      .map(([category, total]) => ({ category, totalMinor: total }))
      .sort((a, b) => b.totalMinor - a.totalMinor),
    byPayment,
    cashCollectedMinor,
    upiCollectedMinor,
    creditGivenMinor: byPayment.credit,
    adjustedLines,
    adjustmentTotalMinor,
  };
}
