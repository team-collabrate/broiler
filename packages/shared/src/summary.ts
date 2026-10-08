import type { Order, PaymentMethod } from './types';

export interface ItemSales {
  itemId: string;
  name: string;
  grams: number;
  totalMinor: number;
}

export interface SalesSummary {
  orderCount: number;
  totalMinor: number;
  totalGrams: number;
  /** Best-selling first, by revenue. */
  byItem: ItemSales[];
  /** Revenue per payment method. */
  byPayment: Record<PaymentMethod, number>;
}

export function summarizeOrders(orders: Order[]): SalesSummary {
  const items = new Map<string, ItemSales>();
  const byPayment: Record<PaymentMethod, number> = { cash: 0, upi: 0, card: 0 };
  let totalMinor = 0;
  let totalGrams = 0;

  for (const order of orders) {
    totalMinor += order.totalMinor;
    totalGrams += order.totalGrams;
    byPayment[order.paymentMethod] += order.totalMinor;
    for (const line of order.lines) {
      const entry = items.get(line.itemId) ?? { itemId: line.itemId, name: line.name, grams: 0, totalMinor: 0 };
      entry.grams += line.grams;
      entry.totalMinor += line.lineTotalMinor;
      items.set(line.itemId, entry);
    }
  }

  return {
    orderCount: orders.length,
    totalMinor,
    totalGrams,
    byItem: [...items.values()].sort((a, b) => b.totalMinor - a.totalMinor),
    byPayment,
  };
}
