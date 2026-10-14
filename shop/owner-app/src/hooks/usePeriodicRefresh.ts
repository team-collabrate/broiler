import { useEffect, useRef } from "react";

/**
 * Re-runs `refresh` on a fixed interval, for the one figure that genuinely
 * needs to stay near-live even on a device that never loses focus (a
 * counter tablet left open all day never fires the focus/visibilitychange
 * events useRefreshOnFocus relies on). Deliberately NOT used for weekly/
 * monthly ranges — those can hold hundreds of orders, so polling them this
 * often would reproduce the same read-quota problem the 2026-09-07
 * live-listener removal was fixing. Only wire this to ranges bounded to a
 * single business day (today's orders/spend).
 */
export function usePeriodicRefresh(refresh: () => void, intervalMs: number): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const id = window.setInterval(() => refreshRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
