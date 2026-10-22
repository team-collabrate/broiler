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

/** The figures the owner's reports show. They can be built from bills, from saved daily totals, or from both. */
export interface SalesFigures {
  orderCount: number;
  totalMinor: number;
  /** Weight sold, in grams. */
  totalGrams: number;
  totalPieces: number;
  /** Best-selling first, by revenue. */
  byItem: ItemSales[];
  /** Best-selling category first, by revenue. */
  byCategory: CategorySales[];
  /** Cash that actually reached the till: cash bills plus the cash half of split bills. */
  cashCollectedMinor: number;
  /** What reached the GPay/UPI account: UPI bills plus the GPay half of split bills. A split bill's cash half never touches it. */
  upiCollectedMinor: number;
  /** Sold on credit (கடன்) in the period: no money moved, it is owed. */
  creditGivenMinor: number;
}

export interface SalesSummary extends SalesFigures {
  /** Revenue per payment method. A credit sale is still a sale on the day it is made. */
  byPayment: Record<PaymentMethod, number>;
  /** How many lines were sold at a rate other than the list rate. */
  adjustedLines: number;
  /**
   * What those adjustments changed the takings by, in paise: negative means the shop charged
   * less than list. Lines sold for a fixed amount are left out, since they charge that amount
   * whatever the rate.
   */
  adjustmentTotalMinor: number;
}

/** Totals for the given bills. Deleted (voided) bills are left out: their money counts nowhere. */
export function summarizeOrders(allOrders: Order[]): SalesSummary {
  const orders = allOrders.filter((o) => o.status !== 'voided');
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

/** One item's sales on a saved day. */
export interface DayItem {
  name: string;
  category: string;
  unit: Unit;
  grams: number;
  qty: number;
  totalMinor: number;
}

/**
 * A whole day's totals, saved when the day falls out of the 4 days of full bills (the `dailySummaries` collection).
 * It is a plain map of numbers so Firestore stores it as it is; the field names are checked by the rules.
 */
export interface DayTotals {
  /** `YYYY-MM-DD`, also the document id. */
  dayKey: string;
  orderCount: number;
  totalMinor: number;
  /** Cash that reached the till (cash bills and the cash half of split bills). */
  cashMinor: number;
  /** What reached GPay/UPI (UPI bills and the GPay half of split bills). */
  upiMinor: number;
  /** Sold on credit that day. */
  creditMinor: number;
  totalGrams: number;
  totalPieces: number;
  items: Record<string, DayItem>;
  categories: Record<string, number>;
}

/** The totals to save for a day, from all of that day's bills (deleted ones are left out). */
export function dayTotalsFromOrders(dayKey: string, orders: Order[]): DayTotals {
  const s = summarizeOrders(orders);
  return {
    dayKey,
    orderCount: s.orderCount,
    totalMinor: s.totalMinor,
    cashMinor: s.cashCollectedMinor,
    upiMinor: s.upiCollectedMinor,
    creditMinor: s.creditGivenMinor,
    totalGrams: s.totalGrams,
    totalPieces: s.totalPieces,
    items: Object.fromEntries(
      s.byItem.map((i) => [i.itemId, { name: i.name, category: i.category, unit: i.unit, grams: i.grams, qty: i.qty, totalMinor: i.totalMinor }]),
    ),
    categories: Object.fromEntries(s.byCategory.map((c) => [c.category, c.totalMinor])),
  };
}

/** Reads a saved day back from stored data, tolerating a missing or odd field. */
export function dayTotalsFromData(id: string, data: Record<string, unknown>): DayTotals {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const items: Record<string, DayItem> = {};
  const rawItems = data.items && typeof data.items === 'object' ? (data.items as Record<string, Record<string, unknown>>) : {};
  for (const [itemId, it] of Object.entries(rawItems)) {
    items[itemId] = {
      name: typeof it?.name === 'string' ? it.name : itemId,
      category: typeof it?.category === 'string' ? it.category : '',
      unit: it?.unit === 'piece' ? 'piece' : 'kg',
      grams: n(it?.grams),
      qty: n(it?.qty),
      totalMinor: n(it?.totalMinor),
    };
  }
  const categories: Record<string, number> = {};
  const rawCategories = data.categories && typeof data.categories === 'object' ? (data.categories as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(rawCategories)) categories[key] = n(value);
  return {
    dayKey: id,
    orderCount: n(data.orderCount),
    totalMinor: n(data.totalMinor),
    cashMinor: n(data.cashMinor),
    upiMinor: n(data.upiMinor),
    creditMinor: n(data.creditMinor),
    totalGrams: n(data.totalGrams),
    totalPieces: n(data.totalPieces),
    items,
    categories,
  };
}

/**
 * The figures for a period that is partly recent (full bills) and partly older (saved daily totals). A day is only
 * ever in one of the two, so adding them never counts a day twice.
 */
export function combineSales(orders: Order[], days: DayTotals[]): SalesFigures {
  const live = summarizeOrders(orders);
  const items = new Map<string, ItemSales>(live.byItem.map((i) => [i.itemId, { ...i }]));
  const categories = new Map<string, number>(live.byCategory.map((c) => [c.category, c.totalMinor]));
  const figures: SalesFigures = {
    orderCount: live.orderCount,
    totalMinor: live.totalMinor,
    totalGrams: live.totalGrams,
    totalPieces: live.totalPieces,
    byItem: [],
    byCategory: [],
    cashCollectedMinor: live.cashCollectedMinor,
    upiCollectedMinor: live.upiCollectedMinor,
    creditGivenMinor: live.creditGivenMinor,
  };
  for (const day of days) {
    figures.orderCount += day.orderCount;
    figures.totalMinor += day.totalMinor;
    figures.totalGrams += day.totalGrams;
    figures.totalPieces += day.totalPieces;
    figures.cashCollectedMinor += day.cashMinor;
    figures.upiCollectedMinor += day.upiMinor;
    figures.creditGivenMinor += day.creditMinor;
    for (const [itemId, it] of Object.entries(day.items)) {
      const entry = items.get(itemId) ?? { itemId, name: it.name, category: it.category, unit: it.unit, grams: 0, qty: 0, totalMinor: 0 };
      entry.grams += it.grams;
      entry.qty += it.qty;
      entry.totalMinor += it.totalMinor;
      items.set(itemId, entry);
    }
    for (const [category, totalMinor] of Object.entries(day.categories)) categories.set(category, (categories.get(category) ?? 0) + totalMinor);
  }
  figures.byItem = [...items.values()].sort((a, b) => b.totalMinor - a.totalMinor);
  figures.byCategory = [...categories.entries()].map(([category, totalMinor]) => ({ category, totalMinor })).sort((a, b) => b.totalMinor - a.totalMinor);
  return figures;
}

/** Sales for each hour of the day (0 to 23), by the time the sale was made. Deleted bills are left out. */
export function salesByHour(orders: Order[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const order of orders) {
    if (order.status === 'voided') continue;
    hours[(order.soldAt ?? order.createdAt).getHours()] += order.totalMinor;
  }
  return hours;
}

/** Sales for each of the given days, from full bills where they are still held and saved totals for older days. */
export function salesByDay(keys: string[], orders: Order[], days: DayTotals[]): { dayKey: string; totalMinor: number }[] {
  const totals = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const order of orders) {
    if (order.status === 'voided' || !totals.has(order.dayKey)) continue;
    totals.set(order.dayKey, (totals.get(order.dayKey) ?? 0) + order.totalMinor);
  }
  for (const day of days) if (totals.has(day.dayKey)) totals.set(day.dayKey, (totals.get(day.dayKey) ?? 0) + day.totalMinor);
  return keys.map((dayKey) => ({ dayKey, totalMinor: totals.get(dayKey) ?? 0 }));
}
