import { useCallback, useEffect, useMemo, useState } from "react";
import { describeFirestoreError, getDailySummariesInRange, useLanguage } from "@kumbakonam/shared";
import type { DateRange } from "../utils/dateRange";

export interface UseDailySummariesInRangeResult {
  totalSales: number;
  totalSpent: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * The permanent-totals half of a report figure — see
 * dailySummary.service.ts. Only ever has documents for business days
 * already past the detail-retention window, so adding this to the
 * matching orders/expenses-in-range totals never double-counts a day:
 * each day's total comes from exactly one of the two sources, never both.
 *
 * Fetch-once-plus-manual-refresh, not live — see useOrdersInRange's own
 * comment for why (2026-09-07).
 */
export function useDailySummariesInRange(range: DateRange): UseDailySummariesInRangeResult {
  const { language } = useLanguage();
  const [totalSales, setTotalSales] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startTime = range.start.getTime();
  const endTime = range.end.getTime();

  const fetchSummaries = useCallback(() => {
    setLoading(true);
    getDailySummariesInRange(new Date(startTime), new Date(endTime))
      .then((summaries) => {
        setError(null);
        setTotalSales(summaries.reduce((sum, s) => sum + s.totalSales, 0));
        setTotalSpent(summaries.reduce((sum, s) => sum + s.totalSpent, 0));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching daily summaries failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
  }, [startTime, endTime, language]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  return useMemo(
    () => ({ totalSales, totalSpent, loading, error, refresh: fetchSummaries }),
    [totalSales, totalSpent, loading, error, fetchSummaries],
  );
}
