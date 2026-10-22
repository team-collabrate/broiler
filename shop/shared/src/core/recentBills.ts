// The last few bills this tablet printed, kept on the tablet so an earlier bill can be printed again: a customer comes
// back for a copy, or the printer ran out of paper in the middle. The counter cannot read orders from the server (the
// rules keep sales owner-only), so this is a small local list of the bills exactly as they were printed. Pure
// TypeScript: the stored text is read back through a function that decides what a valid entry is.

/** How many bills are kept. Older ones fall off the end. */
export const RECENT_BILLS_KEPT = 20;

export interface RecentEntry<T> {
  /** The order id: printing the same sale twice never lists it twice. */
  id: string;
  /** When the sale was made (milliseconds since 1970). */
  soldAtMs: number;
  payload: T;
}

/** Puts the entry first (newest on top), replacing any earlier entry for the same sale, and drops the oldest past `keep`. */
export function addRecent<T>(list: RecentEntry<T>[], entry: RecentEntry<T>, keep = RECENT_BILLS_KEPT): RecentEntry<T>[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, keep);
}

export const serializeRecent = <T>(list: RecentEntry<T>[]): string => JSON.stringify(list);

/**
 * Reads the stored list. `revive` turns a stored payload back into the real thing (for example text back into a Date)
 * and returns null for a payload it does not accept. Anything damaged is dropped, so a bad file never blocks printing.
 */
export function parseRecent<T>(raw: string | null, revive: (payload: unknown) => T | null): RecentEntry<T>[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentEntry<T>[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const { id, soldAtMs, payload } = item as Record<string, unknown>;
      if (typeof id !== 'string' || id === '' || typeof soldAtMs !== 'number') continue;
      const revived = revive(payload);
      if (revived !== null) out.push({ id, soldAtMs, payload: revived });
    }
    return out.slice(0, RECENT_BILLS_KEPT);
  } catch {
    return [];
  }
}
