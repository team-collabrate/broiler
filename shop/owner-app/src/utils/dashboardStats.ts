import type { Order } from "@kumbakonam/shared";

export interface TopItem {
  name: string;
  nameTa?: string;
  qty: number;
}

export interface DashboardStats {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  /** What actually reached the GPay/UPI account — not the same as
   *  "UPI orders", since a split bill's cash half never touches it. */
  gpayCollected: number;
  topItems: TopItem[];
}

/** Client-side aggregation per Data Model §6 — acceptable at single-cafe scale. */
export function computeDashboardStats(allOrders: Order[]): DashboardStats {
  // A voided order is a mistake the owner cancelled after the fact, not a
  // sale — it must not move sales totals, GPay collected, or top items.
  // The order document is kept (see voidOrder in orders.service.ts) so
  // order history can still show it happened; it just doesn't count here.
  const orders = allOrders.filter((o) => o.status !== "voided");

  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

  // A pure-UPI order sends its whole total; a split order only sends the
  // upiAmount half — the rest was handed over as cash and never reached
  // the account. Everything else (cash, credit) contributed nothing here.
  const gpayCollected = orders.reduce((sum, o) => {
    if (o.paymentMethod === "upi") return sum + o.total;
    if (o.paymentMethod === "split") return sum + (o.upiAmount ?? 0);
    return sum;
  }, 0);

  const byName = new Map<string, { qty: number; nameTa?: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = byName.get(item.name);
      byName.set(item.name, { qty: (existing?.qty ?? 0) + item.qty, nameTa: existing?.nameTa ?? item.nameTa });
    }
  }
  // Every item billed today, ranked by quantity — not just the top 5 (was
  // TOP_ITEMS_LIMIT-capped; the owner wants the full list here, the "top"
  // in the name is now just "ranked", not "shortened to the leaders").
  const topItems = Array.from(byName.entries())
    .map(([name, { qty, nameTa }]) => ({ name, nameTa, qty }))
    .sort((a, b) => b.qty - a.qty);

  return { totalSales, orderCount, avgOrderValue, gpayCollected, topItems };
}
