import { useCallback, useEffect, useMemo, useState } from "react";
import { describeFirestoreError, getExpensesInRange, useLanguage, type Expense } from "@kumbakonam/shared";
import type { DateRange } from "../utils/dateRange";

export interface UseExpensesInRangeResult {
  expenses: Expense[];
  /** Sum of `amount` over the range — what the till paid out. */
  totalSpent: number;
  loading: boolean;
  error: string | null;
  /** Re-fetches on demand — see this hook's own comment on why there's no
   *  live listener to do that automatically anymore. */
  refresh: () => void;
}

/**
 * Fetch-once-plus-manual-refresh spend for a date range, mirroring
 * useOrdersInRange — same reasoning there applies here (2026-09-07): a
 * live listener on this re-delivered on every expense change from any
 * device, for as long as the screen stayed open. Callers that mutate
 * expenses (RecordExpenseModal, ExpenseHistoryRow's delete) now need to
 * call `refresh()` themselves afterward — nothing updates this list on
 * its own anymore.
 */
export function useExpensesInRange(range: DateRange): UseExpensesInRangeResult {
  const { language } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startTime = range.start.getTime();
  const endTime = range.end.getTime();

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    getExpensesInRange(new Date(startTime), new Date(endTime))
      .then((result) => {
        setError(null);
        setExpenses(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching expenses failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
  }, [startTime, endTime, language]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  return { expenses, totalSpent, loading, error, refresh: fetchExpenses };
}
