import { useCallback, useEffect, useState } from "react";
import { getOutstandingCustomers, type Customer } from "@kumbakonam/shared";

export interface UseOutstandingCustomersResult {
  customers: Customer[];
  loading: boolean;
  refresh: () => void;
}

/**
 * Everyone who currently owes — feeds the Credit and Khata modals' customer
 * pickers. Was a live subscription, running for as long as the worker
 * screen stayed open (i.e. the whole shift) and re-delivering on every
 * balance change from any device, even the many hours neither modal was
 * open. Same fetch-once-plus-manual-refresh move as the 2026-09-07
 * owner-app/reports-app refactor (this one was missed then — worker-app's
 * *other* listeners are small/bounded/essential in a way this wasn't: it's
 * the one unbounded, continuously-open worker-app subscription there was).
 *
 * Fetches once on mount so the first time either modal opens there's
 * already something to show, then `refresh()` is called by WorkerHome right
 * as either modal opens — a picker a few minutes stale is a non-issue, so
 * this trades a little freshness for cutting out most of the read volume.
 */
export function useOutstandingCustomers(): UseOutstandingCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    getOutstandingCustomers()
      .then((result) => {
        setCustomers(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching outstanding customers failed", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, refresh: fetchCustomers };
}
