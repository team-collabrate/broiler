import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRecent, parseRecent, RECENT_BILLS_KEPT, serializeRecent, type RecentEntry } from './recentBills.ts';

const entry = (id: string, soldAtMs = 1): RecentEntry<{ n: string }> => ({ id, soldAtMs, payload: { n: id } });
const accept = (p: unknown) => (typeof p === 'object' && p !== null && typeof (p as { n?: unknown }).n === 'string' ? (p as { n: string }) : null);

test('the newest bill goes on top', () => {
  const list = addRecent(addRecent([], entry('a')), entry('b'));
  assert.deepEqual(list.map((e) => e.id), ['b', 'a']);
});

test('printing the same sale again lists it once, moved to the top', () => {
  const list = addRecent(addRecent(addRecent([], entry('a')), entry('b')), entry('a'));
  assert.deepEqual(list.map((e) => e.id), ['a', 'b']);
});

test('only the most recent bills are kept', () => {
  let list: RecentEntry<{ n: string }>[] = [];
  for (let i = 0; i < RECENT_BILLS_KEPT + 7; i += 1) list = addRecent(list, entry(`o${i}`));
  assert.equal(list.length, RECENT_BILLS_KEPT);
  assert.equal(list[0].id, `o${RECENT_BILLS_KEPT + 6}`);
  assert.ok(!list.some((e) => e.id === 'o0'));
});

test('the list survives being saved and read back', () => {
  const list = addRecent(addRecent([], entry('a', 5)), entry('b', 9));
  assert.deepEqual(parseRecent(serializeRecent(list), accept), list);
});

test('damaged stored data is dropped, never thrown', () => {
  assert.deepEqual(parseRecent(null, accept), []);
  assert.deepEqual(parseRecent('not json', accept), []);
  assert.deepEqual(parseRecent('{"a":1}', accept), []);
  const mixed = JSON.stringify([entry('good'), { id: '', soldAtMs: 1, payload: { n: 'x' } }, { id: 'no-payload', soldAtMs: 1, payload: 5 }, null, 'x', { id: 'no-time', payload: { n: 'x' } }]);
  assert.deepEqual(parseRecent(mixed, accept).map((e) => e.id), ['good']);
});
