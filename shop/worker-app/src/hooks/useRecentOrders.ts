import { useCallback, useEffect, useState } from "react";
import { getRecentOrders, type Order } from "@kumbakonam/shared";

export interface UseRecentOrdersResult {
  orders: Order[];
  loading: boolean;
  refresh: () => void;
}

/** The last N non-voided bills — backs the sidebar's "delete recent bill"
 *  panel. Fetch-once-plus-manual-refresh, not live (2026-09-09) — see
 *  getRecentOrders's own comment for why. WorkerHome calls `refresh()` right
 *  as the panel opens, so it's never more than a moment stale. */
export function useRecentOrders(count: number): UseRecentOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    getRecentOrders(count)
      .then((result) => {
        setOrders(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching recent orders failed", err);
        setLoading(false);
      });
  }, [count]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, refresh: fetchOrders };
}
