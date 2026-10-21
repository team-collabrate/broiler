// The list of sales that were saved on this tablet and have not yet been confirmed by the server. It drives the
// "bills waiting" badge and the warning when the server refuses a bill. Pure TypeScript: the list is plain data and
// every change returns a new list, so the rules here run under Node's test runner.

/** The longest a sale may wait on a tablet before the server refuses it (also enforced by firestore.rules). */
export const MAX_SALE_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** A waiting bill older than this is shown as urgent: the tablet needs a connection soon. */
export const STALE_WARNING_MS = 24 * 60 * 60 * 1000;
/** How far ahead of the server's clock a tablet's sale time may be (clock drift). Also in firestore.rules. */
export const MAX_CLOCK_AHEAD_MS = 5 * 60 * 1000;

export type OutboxState = 'pending' | 'rejected';

export interface OutboxEntry {
  orderId: string;
  /**
   * The account that saved the sale. A tablet keeps each account's unsent writes apart, so while a different account
   * is signed in (the owner setting rates) this sale is out of view and says nothing about whether it was accepted.
   */
  uid: string;
  /** The label printed on the bill ("12" or "B12"). */
  label: string;
  totalMinor: number;
  /** When the sale was made, by the tablet's clock (milliseconds since 1970). */
  soldAtMs: number;
  state: OutboxState;
  /** Why the server refused it; set only when `state` is `rejected`. */
  reason?: string;
  /** A short description of what was sold, kept so a refused sale can be rung up again by hand. */
  summary: string;
}

export type Outbox = OutboxEntry[];

/** What Firestore says about one saved order, from a snapshot listener that includes metadata changes. */
export interface OrderSnapshotFacts {
  exists: boolean;
  /** The write has not yet been acknowledged by the server. */
  hasPendingWrites: boolean;
  /** The data came from the tablet's own copy because the server has not been reached. */
  fromCache: boolean;
}

export type SaleStatus = 'pending' | 'confirmed' | 'rejected' | 'unknown';

/**
 * Where a sale stands. A sale that exists and is no longer waiting was acknowledged. A sale that is not there at all,
 * once the server has been asked, was refused (a refused write is taken out of the tablet's copy). While the server
 * cannot be reached a missing sale proves nothing, so it stays unknown.
 */
export function classifySale({ exists, hasPendingWrites, fromCache }: OrderSnapshotFacts): SaleStatus {
  if (exists) return hasPendingWrites ? 'pending' : 'confirmed';
  return fromCache ? 'unknown' : 'rejected';
}

export function addEntry(list: Outbox, entry: OutboxEntry): Outbox {
  return [...list.filter((e) => e.orderId !== entry.orderId), entry];
}

/** The server has the sale: it leaves the list. */
export function confirmEntry(list: Outbox, orderId: string): Outbox {
  return list.filter((e) => e.orderId !== orderId);
}

/** The server refused the sale: it stays in the list, marked, until someone has seen it and dismisses it. */
export function rejectEntry(list: Outbox, orderId: string, reason: string): Outbox {
  return list.map((e) => (e.orderId === orderId ? { ...e, state: 'rejected' as const, reason } : e));
}

export function dismissEntry(list: Outbox, orderId: string): Outbox {
  return list.filter((e) => !(e.orderId === orderId && e.state === 'rejected'));
}

export const pendingEntries = (list: Outbox): Outbox => list.filter((e) => e.state === 'pending');
export const rejectedEntries = (list: Outbox): Outbox => list.filter((e) => e.state === 'rejected');

/** Age in milliseconds of the oldest sale still waiting; 0 when nothing waits. */
export function oldestPendingAgeMs(list: Outbox, now: number): number {
  const waiting = pendingEntries(list);
  if (waiting.length === 0) return 0;
  return Math.max(0, now - Math.min(...waiting.map((e) => e.soldAtMs)));
}

/** True when the waiting bills have been waiting long enough that the connection must come back soon. */
export const isStale = (list: Outbox, now: number): boolean => oldestPendingAgeMs(list, now) >= STALE_WARNING_MS;

/**
 * Forgets waiting sales so old that the server would have refused them anyway (the rules cap a sale's age), plus a
 * day of slack. Without this a sale whose confirmation was lost in a crash would show as "waiting" for ever.
 */
export function dropExpired(list: Outbox, now: number): Outbox {
  const keep = list.filter((e) => e.state === 'rejected' || now - e.soldAtMs <= MAX_SALE_AGE_MS + STALE_WARNING_MS);
  return keep.length === list.length ? list : keep;
}

const isEntry = (value: unknown): value is OutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.orderId === 'string' &&
    e.orderId !== '' &&
    typeof e.uid === 'string' &&
    typeof e.label === 'string' &&
    typeof e.totalMinor === 'number' &&
    typeof e.soldAtMs === 'number' &&
    (e.state === 'pending' || e.state === 'rejected') &&
    typeof e.summary === 'string' &&
    (e.reason === undefined || typeof e.reason === 'string')
  );
};

/** Reads the stored list back. Anything damaged is dropped rather than thrown, so a bad file can never block selling. */
export function parseOutbox(raw: string | null): Outbox {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export const serializeOutbox = (list: Outbox): string => JSON.stringify(list);
