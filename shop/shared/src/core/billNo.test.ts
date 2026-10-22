import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billLabel, counterDocId, createBillNumbers, isDeviceLetter, type KeyValueStore } from './billNo.ts';

function memoryStore(initial?: Record<string, string>): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial ?? {}));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('bill numbers start at 1 each day and count up without gaps', () => {
  const numbers = createBillNumbers(memoryStore());
  assert.deepEqual([1, 2, 3].map(() => numbers.issue('2026-10-21', 'A')), [1, 2, 3]);
  assert.equal(numbers.issue('2026-10-22', 'A'), 1);
  assert.equal(numbers.last('2026-10-21', 'A'), 3);
});

test('each counter letter has its own count', () => {
  const numbers = createBillNumbers(memoryStore());
  numbers.issue('2026-10-21', 'A');
  numbers.issue('2026-10-21', 'A');
  assert.equal(numbers.issue('2026-10-21', 'B'), 1);
  assert.equal(numbers.issue('2026-10-21', 'A'), 3);
});

test('the count survives a restart (a new reader over the same storage)', () => {
  const store = memoryStore();
  const first = createBillNumbers(store);
  first.issue('2026-10-21', 'A');
  first.issue('2026-10-21', 'A');
  assert.equal(createBillNumbers(store).issue('2026-10-21', 'A'), 3);
});

test('a number can be given back only while it is the latest one', () => {
  const numbers = createBillNumbers(memoryStore());
  const one = numbers.issue('2026-10-21', 'A');
  const two = numbers.issue('2026-10-21', 'A');
  assert.equal(numbers.release('2026-10-21', 'A', one), false);
  assert.equal(numbers.release('2026-10-21', 'A', two), true);
  assert.equal(numbers.issue('2026-10-21', 'A'), 2);
});

test('catching up to the server raises the count, never lowers it', () => {
  const numbers = createBillNumbers(memoryStore());
  // A reinstalled tablet has nothing stored; the server says the next number is 41.
  assert.equal(numbers.catchUp('2026-10-21', 'A', 41), true);
  assert.equal(numbers.issue('2026-10-21', 'A'), 41);
  // A stale server value (an older upload still on its way) must not pull the count back.
  assert.equal(numbers.catchUp('2026-10-21', 'A', 10), false);
  assert.equal(numbers.issue('2026-10-21', 'A'), 42);
});

test('nonsense server values are ignored', () => {
  const numbers = createBillNumbers(memoryStore());
  for (const bad of [0, -3, 1.5, Number.NaN]) assert.equal(numbers.catchUp('2026-10-21', 'A', bad), false);
  assert.equal(numbers.issue('2026-10-21', 'A'), 1);
});

test('damaged storage starts clean instead of throwing', () => {
  for (const raw of ['not json', '[1,2]', 'null', '{"2026-10-21|A":"7"}', '{"2026-10-21|A":-4}']) {
    const numbers = createBillNumbers(memoryStore({ 'broiler.billNumbers': raw }));
    assert.equal(numbers.issue('2026-10-21', 'A'), 1, raw);
  }
});

test('only the most recent days are kept', () => {
  const store = memoryStore();
  const numbers = createBillNumbers(store);
  for (let day = 1; day <= 12; day += 1) numbers.issue(`2026-10-${String(day).padStart(2, '0')}`, 'A');
  const kept = Object.keys(JSON.parse(store.data.get('broiler.billNumbers') ?? '{}'));
  assert.equal(kept.length, 8);
  assert.ok(kept.includes('2026-10-12|A'));
  assert.ok(!kept.includes('2026-10-01|A'));
});

test('the printed label is dd-mm/number, with the counter letter before the number for every counter but A', () => {
  assert.equal(billLabel('2026-10-22', 'A', 12), '22-10/12');
  assert.equal(billLabel('2026-10-22', undefined, 12), '22-10/12');
  assert.equal(billLabel('2026-10-22', '', 12), '22-10/12');
  assert.equal(billLabel('2026-10-22', 'B', 12), '22-10/B12');
  assert.equal(billLabel('2026-01-05', 'A', 1), '05-01/1');
});

test('a day in the wrong form gives the bare number, never a wrong date', () => {
  for (const bad of ['', '22-10-2026', '2026-1-5', 'today']) assert.equal(billLabel(bad, 'A', 7), '7');
  assert.equal(billLabel('nope', 'B', 7), 'B7');
});

test('counter letters are one capital letter', () => {
  assert.equal(isDeviceLetter('A'), true);
  assert.equal(isDeviceLetter('Z'), true);
  for (const bad of ['a', 'AB', '', '1', null, undefined, 5]) assert.equal(isDeviceLetter(bad), false);
});

test('the server note for a counter is named by day and letter', () => {
  assert.equal(counterDocId('2026-10-21', 'B'), '2026-10-21_B');
});
