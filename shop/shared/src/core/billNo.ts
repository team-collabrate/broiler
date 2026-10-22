// Bill numbers for a till that must keep selling with no internet. The number is made on the tablet, so it works
// offline; the server never hands one out. A bill is identified by its counter letter, its day and its number. The
// printed label is the day and month, a slash and the number: "22-10/12" is the 12th bill of 22 October. The first
// counter (A) prints the number alone; any other puts its letter first ("22-10/B12"), so a second tablet can never print
// the same label as the first. Pure TypeScript: the storage is passed in.

export const DEFAULT_DEVICE = 'A';
export const FIRST_BILL_NO = 1;

/** A counter letter: one capital letter. */
export function isDeviceLetter(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]$/.test(value);
}

/**
 * The number printed on the bill: the day and month, a slash, then the bill's number for that day (`22-10/12`), with the
 * counter's letter before the number for every counter but the first (`22-10/B12`). `day` is the sale's `YYYY-MM-DD`; if it
 * is not in that form the bare number is returned rather than a wrong date.
 */
export function billLabel(day: string, device: string | undefined, orderNo: number): string {
  const number = device === undefined || device === '' || device === DEFAULT_DEVICE ? String(orderNo) : `${device}${orderNo}`;
  const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  return parts ? `${parts[2]}-${parts[1]}/${number}` : number;
}

/** The server's note of how far a counter got on a day, so a reinstalled tablet can carry on from it. */
export function counterDocId(day: string, device: string): string {
  return `${day}_${device}`;
}

/** The two methods of the browser's `localStorage` that this needs. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BillNumbers {
  /** The last number handed out for this day and counter; 0 when none yet. */
  last(day: string, device: string): number;
  /** Hands out the next number. Synchronous and offline-safe. */
  issue(day: string, device: string): number;
  /** Gives a number back when the sale it was for was never saved; only the most recent one can be returned. */
  release(day: string, device: string, orderNo: number): boolean;
  /** Raises the count to what the server has seen (`next` is the server's "next number to give"); true if it moved. */
  catchUp(day: string, device: string, serverNext: number): boolean;
}

/** Days of counts kept; older ones are dropped so the stored text stays tiny. */
const KEEP_ENTRIES = 8;

export function createBillNumbers(store: KeyValueStore, storageKey = 'broiler.billNumbers'): BillNumbers {
  const entryKey = (day: string, device: string) => `${day}|${device}`;

  const read = (): Record<string, number> => {
    try {
      const raw = store.getItem(storageKey);
      const parsed: unknown = raw === null ? {} : JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      const clean: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) clean[key] = value;
      }
      return clean;
    } catch {
      return {};
    }
  };

  const write = (map: Record<string, number>) => {
    // Newest days first (YYYY-MM-DD sorts as text); the rest fall away.
    const keep = Object.keys(map)
      .sort()
      .reverse()
      .slice(0, KEEP_ENTRIES);
    const trimmed: Record<string, number> = {};
    for (const key of keep) trimmed[key] = map[key];
    store.setItem(storageKey, JSON.stringify(trimmed));
  };

  return {
    last: (day, device) => read()[entryKey(day, device)] ?? 0,
    issue(day, device) {
      const map = read();
      const key = entryKey(day, device);
      const next = Math.max(map[key] ?? 0, FIRST_BILL_NO - 1) + 1;
      map[key] = next;
      write(map);
      return next;
    },
    release(day, device, orderNo) {
      const map = read();
      const key = entryKey(day, device);
      if (map[key] !== orderNo || orderNo < FIRST_BILL_NO) return false;
      map[key] = orderNo - 1;
      write(map);
      return true;
    },
    catchUp(day, device, serverNext) {
      if (!Number.isInteger(serverNext) || serverNext < FIRST_BILL_NO) return false;
      const map = read();
      const key = entryKey(day, device);
      const serverLast = serverNext - 1;
      if ((map[key] ?? 0) >= serverLast) return false;
      map[key] = serverLast;
      write(map);
      return true;
    },
  };
}
