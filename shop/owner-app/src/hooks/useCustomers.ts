import { useCallback, useEffect, useMemo, useState } from "react";
import { describeFirestoreError, getOutstandingCustomers, useLanguage, type Customer } from "@kumbakonam/shared";

export interface UseCustomersResult {
  /** Only those who currently owe, biggest first. */
  outstanding: Customer[];
  totalOutstanding: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Customer balances for the owner.
 *
 * Fetch-once-plus-manual-refresh, not live — see useOrdersInRange's own
 * comment for the full reasoning (2026-09-07, the Firestore read quota
 * kept exhausting mid-day). Was subscribeToAllCustomers (every customer,
 * settled or not) even though only the outstanding subset was ever
 * actually used by either screen this feeds — switched to
 * getOutstandingCustomers directly, which is both cheaper per fetch and
 * matches what's actually needed.
 */
export function useCustomers(): UseCustomersResult {
  const { language } = useLanguage();
  const [outstanding, setOutstanding] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    getOutstandingCustomers()
      .then((result) => {
        setError(null);
        setOutstanding(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching customers failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
  }, [language]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalOutstanding = useMemo(() => outstanding.reduce((sum, c) => sum + c.balance, 0), [outstanding]);

  return { outstanding, totalOutstanding, loading, error, refresh: fetchCustomers };
}
