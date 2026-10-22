import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRateStale, itemsNeedingRate } from './rates.ts';

const now = new Date(2026, 9, 22, 9, 30);

test('a rate set earlier today is current; one set yesterday, or never, is not', () => {
  assert.equal(isRateStale({ rateUpdatedAt: new Date(2026, 9, 22, 7, 0) }, now), false);
  assert.equal(isRateStale({ rateUpdatedAt: new Date(2026, 9, 21, 23, 59) }, now), true);
  assert.equal(isRateStale({ rateUpdatedAt: null }, now), true);
});

test('only items on sale count as needing a rate', () => {
  const items = [
    { id: 'a', active: true, rateUpdatedAt: null },
    { id: 'b', active: false, rateUpdatedAt: null },
    { id: 'c', active: true, rateUpdatedAt: new Date(2026, 9, 22, 8, 0) },
  ];
  assert.deepEqual(itemsNeedingRate(items, now).map((i) => i.id), ['a']);
});
