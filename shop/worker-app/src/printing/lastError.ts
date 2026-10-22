import { useSyncExternalStore } from "react";

// The technical text of the last printer failure, shown small under the friendly message in Printer setup so a
// failure that is not "the printer is off" can be told apart (and read out) without a computer.
let detail = "";
const listeners = new Set<() => void>();

export function recordPrinterError(error: unknown): void {
  const e = error as { name?: string; message?: string; code?: unknown } | null;
  const text = e && typeof e === "object" ? [e.name, e.code, e.message].filter((x) => x !== undefined && x !== "").join(": ") : String(error);
  detail = (text || String(error)).slice(0, 300);
  listeners.forEach((l) => l());
}

export function usePrinterErrorDetail(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => detail,
  );
}
