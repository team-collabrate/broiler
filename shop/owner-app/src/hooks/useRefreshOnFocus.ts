import { useEffect, useRef } from "react";

/**
 * Re-runs `refresh` when the owner comes back to this tab/app.
 *
 * Root cause of the 2026-09-09 "no records after 10:15am" report: the
 * 2026-09-07 fetch+refresh refactor (see useOrdersInRange's comment) fetches
 * once on mount and otherwise only updates after a mutation this screen
 * itself made (void, payment, expense) — an owner who just leaves the
 * Dashboard open never sees orders a worker rings up later. This re-fetches
 * on the browser/PWA "focus" and "visibilitychange" events, which cover the
 * common real cases (phone locked and unlocked, switched to another app and
 * back, tab re-selected) without restoring a permanent live connection.
 *
 * Throttled — rapid tab-switching (or a flaky OS that fires these events in
 * bursts) shouldn't turn into a burst of reads.
 */
export function useRefreshOnFocus(refresh: () => void, minIntervalMs = 45_000): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const lastRunRef = useRef(0);

  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      refreshRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [minIntervalMs]);
}
