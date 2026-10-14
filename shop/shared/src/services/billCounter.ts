import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "../firebase";

/**
 * Bill numbers, resetting to DAILY_BILL_START every calendar day — an
 * explicit product decision (owner wants each day's bills to start over
 * from a fixed number, not a lifetime-running count) that replaced the
 * original "starts at 1, never resets" design. That original design's own
 * reasoning (a real running count to reconcile against a physical bill
 * book / GST) still holds *within* a day; it just no longer spans days.
 *
 * The hard part is unchanged from before: the worker app has to keep
 * taking orders with no connection (see useOrderSubmit.ts / createOrder's
 * offline-first design), and a real global counter safe against two
 * devices incrementing it at once needs a Firestore transaction — which
 * needs a connection. Same pragmatic middle path for a *single-tablet*
 * counter (per the PRD, there is one Worker App/tablet):
 *
 *  - The counter that actually assigns numbers lives in this device's own
 *    localStorage, alongside the calendar date it was last issued for.
 *    Reading, resetting and incrementing it is synchronous and works with
 *    zero connectivity, which is what offline order submission requires.
 *  - `seedBillCounterFromServer()` is called once at app startup: if
 *    Firestore has a higher high-water-mark *for today* than this
 *    device's local counter (e.g. the browser storage was cleared, or the
 *    app was reinstalled mid-day), it catches the local counter up first,
 *    so a fresh install can't hand out a bill number that already exists
 *    today. A server value left over from a previous day is ignored —
 *    today starts fresh regardless of what yesterday ended on.
 *  - Every issued number is reported to Firestore in the background
 *    (best-effort, never blocks issuing the number) so the server
 *    high-water-mark stays current for that recovery case.
 *
 * What this does NOT protect against: two tablets simultaneously taking
 * orders while both offline could hand out the same number — there is no
 * way to prevent that without a server round-trip at the moment of
 * issuing, which would break offline submission. Fine for one till; flag
 * this comment again before ever adding a second one.
 */
export const DAILY_BILL_START = 1111;

const STORAGE_KEY = "kumbakonam.billCounter";

/** The device's own local calendar date, not UTC — bills reset when the
 *  shop's day turns over, not at a UTC-midnight that could be mid-shift. */
function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface StoredCounter {
  date: string;
  value: number;
}

const FRESH_DAY: Omit<StoredCounter, "date"> = { value: DAILY_BILL_START - 1 };

function readLocal(): StoredCounter {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today, ...FRESH_DAY };
    // JSON.parse happily accepts a bare number token too, which is exactly
    // what the old (pre-daily-reset) format stored here — `.date` on that
    // comes back undefined, which never equals `today`, so this falls
    // through to a fresh day below. A deliberate, not incidental, migration
    // path: no separate one-off script needed for the format change.
    const parsed = JSON.parse(raw) as Partial<StoredCounter>;
    if (parsed.date !== today || typeof parsed.value !== "number") {
      return { date: today, ...FRESH_DAY };
    }
    return { date: today, value: parsed.value };
  } catch {
    return { date: today, ...FRESH_DAY };
  }
}

function writeLocal(counter: StoredCounter): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counter));
}

/**
 * Hands out the next bill number. Synchronous and offline-safe — this is
 * called from the same order-submission path that must never wait on the
 * network (see createOrder in orders.service.ts).
 */
export function getNextBillNo(): number {
  const current = readLocal();
  const next: StoredCounter = { date: current.date, value: current.value + 1 };
  writeLocal(next);
  reportIssued(next);
  return next.value;
}

/** Fire-and-forget: keeps the server high-water-mark caught up. Never awaited by a caller. */
function reportIssued(issued: StoredCounter): void {
  const db = getFirestoreDb();
  const ref = doc(db, "counters", "billNo");
  runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as Partial<StoredCounter> | undefined;
    // A stale date on the server (still yesterday's, say another device
    // hasn't reported yet today) never blocks today's number from being
    // recorded — only a same-day, equal-or-higher value does.
    if (!current || current.date !== issued.date || issued.value > (current.value ?? 0)) {
      tx.set(ref, { date: issued.date, value: issued.value, updatedAt: serverTimestamp() }, { merge: true });
    }
  }).catch((err) => {
    // Fine to lose this — it only matters for the fresh-install recovery
    // path, and it'll be retried on every subsequent order anyway.
    console.error("Bill counter reconciliation failed (non-fatal)", err);
  });
}

/**
 * Resolves once Firebase Auth has a signed-in user.
 *
 * Needed because this module is called from main.tsx at raw app boot,
 * before React has even rendered SessionProvider (which is what actually
 * calls signInAnonymously, on mount). On a fresh load, `onAuthStateChanged`
 * fires immediately with `null` — the signed-out state — well before that
 * anonymous sign-in resolves; resolving on the first callback regardless
 * of its value would race exactly the same way calling this with no wait
 * at all did. Querying Firestore too early doesn't throw at the call site
 * either — it just runs unauthenticated, and `counters` requires
 * isSignedIn(), so every call was silently hitting permission-denied and
 * falling back to local-only. Non-fatal by design, but it meant the
 * fresh-install recovery path this function exists for never actually ran.
 */
function waitForSignedIn(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Called once at worker app startup. Catches the local counter up to
 * Firestore's high-water-mark for *today* if the server is ahead — the
 * recovery path for a cleared/reinstalled device. A server value left
 * over from a previous day is ignored: today's counter starts at
 * DAILY_BILL_START either way, nothing to catch up to. Best-effort: if
 * this can't reach the server (offline at startup, or auth never
 * completes), the local counter is used as-is and this silently does
 * nothing, which is correct — there's nothing more accurate to fall back
 * to offline.
 */
export async function seedBillCounterFromServer(): Promise<void> {
  try {
    await waitForSignedIn();
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, "counters", "billNo"));
    const server = snap.data() as Partial<StoredCounter> | undefined;
    const today = todayKey();
    if (!server || server.date !== today || typeof server.value !== "number") return;
    const local = readLocal();
    if (server.value > local.value) writeLocal({ date: today, value: server.value });
  } catch (err) {
    console.error("Bill counter seed from server failed (non-fatal, using local)", err);
  }
}
