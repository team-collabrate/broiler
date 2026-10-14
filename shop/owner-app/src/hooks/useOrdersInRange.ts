import { useCallback, useEffect, useState } from "react";
import { describeFirestoreError, getOrdersInRange, useLanguage, type Order } from "@kumbakonam/shared";
import type { DateRange } from "../utils/dateRange";

export interface UseOrdersInRangeResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  /** Re-fetches on demand — see this hook's own comment on why there's no
   *  live listener to do that automatically anymore. */
  refresh: () => void;
}

/**
 * Fetch-once-plus-manual-refresh, not live (onSnapshot) — changed
 * 2026-09-07 after the project's Firestore read quota kept getting
 * exhausted mid-afternoon on ordinary days, and a live listener here was
 * one of the biggest reasons why: every order/expense change from ANY
 * device re-delivers to EVERY currently-open dashboard, for as long as
 * that screen stays open — hours, for a phone dashboard left running.
 * A fetch-once-plus-refresh screen costs a small, predictable number of
 * reads per open or tap of Refresh instead of an unbounded number tied to
 * how long the tab happens to stay open and how much order volume happens
 * elsewhere while it does. The tradeoff: numbers here can go stale until
 * refreshed — acceptable for a dashboard someone glances at, not
 * acceptable for something that has to reflect a change the instant it
 * happens (nothing currently on this screen needs that).
 */
export function useOrdersInRange(range: DateRange): UseOrdersInRangeResult {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startTime = range.start.getTime();
  const endTime = range.end.getTime();

  const fetchOrders = useCallback(() => {
    setLoading(true);
    getOrdersInRange(new Date(startTime), new Date(endTime))
      .then((result) => {
        setError(null);
        setOrders(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching orders failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
    // Depend on the primitive timestamps, not `range` itself — a new Date
    // object every render would otherwise refetch on every render.
  }, [startTime, endTime, language]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refresh: fetchOrders };
}
