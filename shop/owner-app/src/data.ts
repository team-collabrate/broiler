import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDaysToKey,
  combineSales,
  dayKey,
  describeError,
  firstKeptDay,
  itemsNeedingRate,
  monthStartKey,
  weekStartKey,
  type Customer,
  type DayRange,
  type DayTotals,
  type Order,
  type SalesFigures,
} from "@kumbakonam/shared/core";
import { ensureRolledUp, getDayTotals, getMenuItems, getOrdersInDays, getOutstandingCustomers } from "@kumbakonam/shared/shop";

// Everything the owner's screens show, fetched once when the app opens and again on Refresh (or when the phone is
// picked up after a minute or more). There are no live listeners: an app left open costs no reads.

export interface OwnerData {
  status: "loading" | "ready" | "error";
  /** Something is being fetched right now (the first load or a Refresh). */
  busy: boolean;
  /** The last fetch failed (the figures below are from the one before, if there was one). */
  error: string | null;
  /** When this was read: today, this week and this month are as of this moment. */
  now: Date;
  /** Every bill of the 4 days still held in full, newest first. Deleted bills are in here, marked. */
  orders: Order[];
  /** Saved totals of the older days of this week and month. */
  dayTotals: DayTotals[];
  /** Customers who owe money, biggest first. */
  customers: Customer[];
  /** How many items on sale have no rate set today. */
  ratesMissing: number;
  /** Set when old days could not be tidied this time (they are tried again next time). */
  tidyNote: string | null;
  refresh: () => Promise<void>;
  /** Saved totals for older days, fetched once and kept until the next Refresh. */
  loadArchived: (range: DayRange) => Promise<DayTotals[]>;
}

type Loaded = Omit<OwnerData, "refresh" | "loadArchived">;

const EMPTY: Loaded = {
  status: "loading",
  busy: true,
  error: null,
  now: new Date(),
  orders: [],
  dayTotals: [],
  customers: [],
  ratesMissing: 0,
  tidyNote: null,
};

/** Re-read after this long when the phone comes back to the app. */
const STALE_AFTER_MS = 60_000;

export function useOwnerData(): OwnerData {
  const [state, setState] = useState<Loaded>(EMPTY);
  const busy = useRef(false);
  const lastLoad = useRef(0);
  const archived = useRef(new Map<string, Promise<DayTotals[]>>());

  const loadArchived = useCallback((range: DayRange) => {
    const key = `${range.fromKey}_${range.toKey}`;
    let pending = archived.current.get(key);
    if (!pending) {
      pending = getDayTotals(range);
      archived.current.set(key, pending);
      pending.catch(() => archived.current.delete(key));
    }
    return pending;
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, busy: true }));
    try {
      const now = new Date();
      // Days that have fallen out of the 4 days of full bills are saved as totals first, so the figures below are whole.
      const tidy = await ensureRolledUp(now);
      archived.current.clear();
      const kept = firstKeptDay(now);
      const lastArchived = addDaysToKey(kept, -1);
      const week = weekStartKey(now);
      const month = monthStartKey(now);
      const olderFrom = week < month ? week : month;
      const [orders, customers, menu, dayTotals] = await Promise.all([
        getOrdersInDays({ fromKey: kept, toKey: dayKey(now) }),
        getOutstandingCustomers(),
        getMenuItems(),
        olderFrom <= lastArchived ? loadArchived({ fromKey: olderFrom, toKey: lastArchived }) : Promise.resolve<DayTotals[]>([]),
      ]);
      lastLoad.current = Date.now();
      setState({
        status: "ready",
        busy: false,
        error: null,
        now,
        orders,
        dayTotals,
        customers,
        ratesMissing: itemsNeedingRate(menu, now).length,
        tidyNote: tidy.error ? "Old bills could not be tidied up this time. It will try again." : null,
      });
    } catch (error) {
      setState((s) => ({ ...s, status: s.status === "ready" ? "ready" : "error", busy: false, error: describeError(error) }));
    } finally {
      busy.current = false;
    }
  }, [loadArchived]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Picking the phone up again after a while shows fresh figures without a tap.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > STALE_AFTER_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return { ...state, refresh, loadArchived };
}

/** The figures for some days, from the bills held in full and the saved totals of older days. */
export function figuresForRange(orders: Order[], dayTotals: DayTotals[], range: DayRange): SalesFigures {
  const inRange = (key: string) => key >= range.fromKey && key <= range.toKey;
  return combineSales(
    orders.filter((o) => inRange(o.dayKey)),
    dayTotals.filter((d) => inRange(d.dayKey)),
  );
}
