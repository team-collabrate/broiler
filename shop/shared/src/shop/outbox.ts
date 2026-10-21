import { useSyncExternalStore } from "react";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import {
  addEntry,
  classifySale,
  confirmEntry,
  describeError,
  dismissEntry,
  dropExpired,
  parseOutbox,
  rejectEntry,
  serializeOutbox,
  type Outbox,
  type OutboxEntry,
} from "../core";
import { getFirebaseAuth, getFirestoreDb } from "../firebase";
import { browserStore } from "./storage";

// The sales saved on this tablet that the server has not confirmed yet. A sale is saved to the tablet first and
// uploaded by Firestore whenever it can; this list is how the screen knows what is still waiting and whether the
// server refused anything. It is kept in storage, so it survives the app being closed with bills still waiting.

const KEY = "broiler.outbox";
const store = browserStore();
const REFUSED = "சர்வர் இந்த பில்லை ஏற்கவில்லை";

let list: Outbox = dropExpired(parseOutbox(store.getItem(KEY)), Date.now());
const listeners = new Set<() => void>();
const watchers = new Map<string, Unsubscribe>();

function update(next: Outbox): void {
  if (next === list) return;
  list = next;
  store.setItem(KEY, serializeOutbox(list));
  listeners.forEach((listener) => listener());
}

function stopWatching(orderId: string): void {
  watchers.get(orderId)?.();
  watchers.delete(orderId);
}

function confirmed(orderId: string): void {
  stopWatching(orderId);
  update(confirmEntry(list, orderId));
}

function refused(orderId: string, reason: string): void {
  stopWatching(orderId);
  update(rejectEntry(list, orderId, reason));
}

/**
 * Watches one saved sale until the server confirms or refuses it. A listener that includes metadata changes tells
 * three things apart: still queued on the tablet, accepted by the server, and gone (refused). While a different
 * account is signed in the sale is out of view, so nothing is concluded until its own account is back.
 */
function watch(orderId: string): void {
  if (watchers.has(orderId)) return;
  const unsubscribe = onSnapshot(
    doc(getFirestoreDb(), "orders", orderId),
    { includeMetadataChanges: true },
    (snap) => {
      const entry = list.find((e) => e.orderId === orderId);
      if (!entry) return stopWatching(orderId);
      if (getFirebaseAuth().currentUser?.uid !== entry.uid) return;
      const status = classifySale({ exists: snap.exists(), hasPendingWrites: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache });
      if (status === "confirmed") confirmed(orderId);
      else if (status === "rejected") refused(orderId, REFUSED);
    },
    // A listener error (no connection yet, rules) proves nothing about the sale: keep waiting.
    () => undefined,
  );
  watchers.set(orderId, unsubscribe);
}

/**
 * Records a sale that was just handed to Firestore. `committed` is the write's own promise: it settles only once
 * the server has answered, so it never holds up the sale, but it gives the exact reason when the server says no.
 */
export function trackSale(entry: OutboxEntry, committed: Promise<void>): void {
  update(addEntry(list, entry));
  committed.then(
    () => confirmed(entry.orderId),
    (error) => refused(entry.orderId, describeError(error)),
  );
  watch(entry.orderId);
}

/** Starts watching the sales left waiting by an earlier launch. Call once signed in; safe to call again. */
export function resumeOutbox(): void {
  update(dropExpired(list, Date.now()));
  for (const entry of list) if (entry.state === "pending") watch(entry.orderId);
}

/** The refused sale has been seen; take it off the warning. */
export function dismissRefused(orderId: string): void {
  update(dismissEntry(list, orderId));
}

export function getOutbox(): Outbox {
  return list;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The live list of unconfirmed sales, for the screen. */
export function useOutbox(): Outbox {
  return useSyncExternalStore(subscribe, getOutbox);
}
