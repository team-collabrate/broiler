import { useSyncExternalStore } from "react";
import { addRecent, parseRecent, serializeRecent, type RecentEntry } from "@kumbakonam/shared/core";
import { browserStore } from "@kumbakonam/shared/shop";
import type { BillInput } from "../printing/receipt";

// The last bills printed on this tablet, kept exactly as they were printed so one can be printed again (marked as a
// copy). Local to the tablet: the counter has no right to read sales from the server.

const KEY = "broiler.recentBills";
const store = browserStore();

/** A stored bill comes back with its date as text; anything that does not look like a bill is dropped. */
function reviveBill(value: unknown): BillInput | null {
  if (typeof value !== "object" || value === null) return null;
  const b = value as Record<string, unknown>;
  const when = new Date(b.createdAt as string);
  if (
    typeof b.orderId !== "string" ||
    typeof b.billNo !== "string" ||
    Number.isNaN(when.getTime()) ||
    !Array.isArray(b.lines) ||
    typeof b.total !== "string" ||
    typeof b.paymentLabel !== "string"
  ) {
    return null;
  }
  return { ...(b as unknown as BillInput), createdAt: when };
}

let list: RecentEntry<BillInput>[] = parseRecent(store.getItem(KEY), reviveBill);
const listeners = new Set<() => void>();

/** Records a bill that was just printed (or shown). The copy mark is never stored: it is added when a bill is reprinted. */
export function rememberBill(bill: BillInput): void {
  const { isCopy: _isCopy, ...original } = bill;
  list = addRecent(list, { id: bill.orderId, soldAtMs: bill.createdAt.getTime(), payload: original });
  store.setItem(KEY, serializeRecent(list));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The recent bills, newest first. */
export function useRecentBills(): RecentEntry<BillInput>[] {
  return useSyncExternalStore(subscribe, () => list);
}
