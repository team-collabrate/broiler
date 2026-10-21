import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addEntry,
  classifySale,
  confirmEntry,
  dismissEntry,
  dropExpired,
  MAX_SALE_AGE_MS,
  isStale,
  oldestPendingAgeMs,
  parseOutbox,
  pendingEntries,
  rejectedEntries,
  rejectEntry,
  serializeOutbox,
  STALE_WARNING_MS,
  type OutboxEntry,
} from './outbox.ts';

const entry = (orderId: string, soldAtMs = 1_000): OutboxEntry => ({
  orderId,
  uid: 'counter-1',
  label: orderId.toUpperCase(),
  totalMinor: 25000,
  soldAtMs,
  state: 'pending',
  summary: 'நாட்டுக்கோழி 1 கிலோ',
});

test('a sale that exists and is no longer waiting was confirmed', () => {
  assert.equal(classifySale({ exists: true, hasPendingWrites: false, fromCache: false }), 'confirmed');
  // Acknowledged earlier, the server just cannot be reached right now: still confirmed.
  assert.equal(classifySale({ exists: true, hasPendingWrites: false, fromCache: true }), 'confirmed');
});

test('a sale that is still queued is pending, whether or not the server can be reached', () => {
  assert.equal(classifySale({ exists: true, hasPendingWrites: true, fromCache: true }), 'pending');
  assert.equal(classifySale({ exists: true, hasPendingWrites: true, fromCache: false }), 'pending');
});

test('a missing sale is refused only once the server has been asked', () => {
  assert.equal(classifySale({ exists: false, hasPendingWrites: false, fromCache: false }), 'rejected');
  assert.equal(classifySale({ exists: false, hasPendingWrites: false, fromCache: true }), 'unknown');
});

test('adding the same sale twice keeps one entry', () => {
  const list = addEntry(addEntry([], entry('a')), entry('a'));
  assert.equal(list.length, 1);
});

test('confirming a sale takes it off the list; other sales stay in order', () => {
  const list = [entry('a'), entry('b'), entry('c')];
  assert.deepEqual(confirmEntry(list, 'b').map((e) => e.orderId), ['a', 'c']);
});

test('a refused sale stays on the list with its reason until it is dismissed', () => {
  const list = rejectEntry([entry('a'), entry('b')], 'a', 'permission-denied');
  assert.equal(pendingEntries(list).length, 1);
  assert.equal(rejectedEntries(list)[0].reason, 'permission-denied');
  assert.deepEqual(dismissEntry(list, 'a').map((e) => e.orderId), ['b']);
});

test('dismissing never removes a sale that is still waiting', () => {
  assert.deepEqual(dismissEntry([entry('a')], 'a').map((e) => e.orderId), ['a']);
});

test('the oldest waiting sale sets the age, and refused sales do not count', () => {
  const list = rejectEntry([entry('old', 1_000), entry('new', 9_000), entry('x', 100)], 'x', 'no');
  assert.equal(oldestPendingAgeMs(list, 10_000), 9_000);
  assert.equal(oldestPendingAgeMs([], 10_000), 0);
  assert.equal(oldestPendingAgeMs([entry('future', 20_000)], 10_000), 0);
});

test('bills waiting a day or more are stale', () => {
  assert.equal(isStale([entry('a', 0)], STALE_WARNING_MS - 1), false);
  assert.equal(isStale([entry('a', 0)], STALE_WARNING_MS), true);
  assert.equal(isStale([], STALE_WARNING_MS * 10), false);
});

test('the list survives being saved and read back', () => {
  const list = rejectEntry([entry('a'), entry('b')], 'b', 'permission-denied');
  assert.deepEqual(parseOutbox(serializeOutbox(list)), list);
});

test('damaged stored data is dropped, never thrown', () => {
  assert.deepEqual(parseOutbox(null), []);
  assert.deepEqual(parseOutbox('not json'), []);
  assert.deepEqual(parseOutbox('{"a":1}'), []);
  const { uid: _uid, ...noUid } = entry('no-uid');
  const mixed = JSON.stringify([entry('good'), { orderId: 5 }, null, 'x', { ...entry('bad'), state: 'weird' }, noUid]);
  assert.deepEqual(parseOutbox(mixed).map((e) => e.orderId), ['good']);
});

test('a waiting sale too old for the server to accept is forgotten, a refused one is kept to be seen', () => {
  const now = 10 * MAX_SALE_AGE_MS;
  const ancient = entry('ancient', 0);
  const refused = rejectEntry([entry('refused', 0)], 'refused', 'no')[0];
  const fresh = entry('fresh', now - 1000);
  assert.deepEqual(dropExpired([ancient, refused, fresh], now).map((e) => e.orderId), ['refused', 'fresh']);
  const list = [fresh];
  assert.equal(dropExpired(list, now), list);
});
