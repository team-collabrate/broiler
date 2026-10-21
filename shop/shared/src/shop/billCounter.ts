import { doc, getDoc } from "firebase/firestore";
import { counterDocId, createBillNumbers, dayKey, DEFAULT_DEVICE, isDeviceLetter } from "../core";
import { getFirestoreDb } from "../firebase";
import { browserStore } from "./storage";

// Bill numbers are made on the tablet so a sale never waits for the internet (see core/billNo.ts). A number is
// "reserved" for one sale from the moment the sale is attempted: a retry of the same sale gets the same number
// back, and a sale that is abandoned gives its number back, so a failed attempt does not leave a gap.

const DEVICE_KEY = "broiler.device";
const store = browserStore();
const numbers = createBillNumbers(store);

/** This tablet's counter letter. "A" until the owner gives a second tablet its own letter. */
export function getDeviceLetter(): string {
  const stored = store.getItem(DEVICE_KEY);
  return isDeviceLetter(stored) ? stored : DEFAULT_DEVICE;
}

export function setDeviceLetter(letter: string): void {
  if (!isDeviceLetter(letter)) throw new Error("கவுண்டர் எழுத்து A முதல் Z வரை இருக்க வேண்டும்");
  store.setItem(DEVICE_KEY, letter);
}

interface Reservation {
  day: string;
  device: string;
  orderNo: number;
}
const reservations = new Map<string, Reservation>();

/** The bill number for this sale. Asking again for the same sale returns the same number. */
export function reserveBillNo(orderId: string, day: string, device: string): number {
  const held = reservations.get(orderId);
  if (held && held.day === day && held.device === device) return held.orderNo;
  // Held for another day or counter (the clock passed midnight between attempts): give it back and start fresh.
  if (held) numbers.release(held.day, held.device, held.orderNo);
  const orderNo = numbers.issue(day, device);
  reservations.set(orderId, { day, device, orderNo });
  return orderNo;
}

/** The sale was saved: the number is its own for good. */
export function settleBillNo(orderId: string): void {
  reservations.delete(orderId);
}

/** The sale was dropped before anything was saved: the number goes back if no later sale has taken one. */
export function abandonBillNo(orderId: string): void {
  const held = reservations.get(orderId);
  if (!held) return;
  numbers.release(held.day, held.device, held.orderNo);
  reservations.delete(orderId);
}

/**
 * Carries this tablet's count up to what the server last saw for today, so a reinstalled tablet (or one whose
 * storage was cleared) does not hand out a number that was already used. Best effort: with no connection, or no
 * note on the server yet, the tablet's own count stands. Safe to call as often as is useful.
 */
export async function seedBillNumbers(now: Date = new Date()): Promise<void> {
  const day = dayKey(now);
  const device = getDeviceLetter();
  try {
    const snap = await getDoc(doc(getFirestoreDb(), "counters", counterDocId(day, device)));
    const next: unknown = snap.data()?.next;
    if (typeof next === "number") numbers.catchUp(day, device, next);
  } catch {
    /* offline or not signed in yet: the local count is all there is */
  }
}
