import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeOrders } from './summary.ts';
import type { Order } from './types.ts';

function order(partial: Partial<Order> & Pick<Order, 'lines' | 'paymentMethod'>): Order {
  const totalMinor = partial.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  const totalGrams = partial.lines.reduce((s, l) => s + l.grams, 0);
  return { id: 'o', orderNo: 1, dayKey: '2026-10-08', createdAt: new Date(2026, 9, 8), totalMinor, totalGrams, ...partial };
}

const line = (itemId: string, name: string, grams: number, lineTotalMinor: number) => ({
  itemId,
  name,
  grams,
  lineTotalMinor,
  pricePerKgMinor: 0,
});

test('summarizing no orders gives zeros', () => {
  assert.deepEqual(summarizeOrders([]), {
    orderCount: 0,
    totalMinor: 0,
    totalGrams: 0,
    byItem: [],
    byPayment: { cash: 0, upi: 0, card: 0 },
  });
});

test('totals, per-item sales and payment split add up', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'cash', lines: [line('a', 'Chicken', 1000, 24000), line('b', 'Liver', 500, 8000)] }),
    order({ paymentMethod: 'upi', lines: [line('a', 'Chicken', 1500, 36000)] }),
  ]);

  assert.equal(s.orderCount, 2);
  assert.equal(s.totalMinor, 68000);
  assert.equal(s.totalGrams, 3000);
  assert.deepEqual(s.byPayment, { cash: 32000, upi: 36000, card: 0 });
  assert.deepEqual(s.byItem, [
    { itemId: 'a', name: 'Chicken', grams: 2500, totalMinor: 60000 },
    { itemId: 'b', name: 'Liver', grams: 500, totalMinor: 8000 },
  ]);
});

test('byItem is ordered by revenue, best seller first', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'cash', lines: [line('low', 'Low', 5000, 1000), line('high', 'High', 100, 9000)] }),
  ]);
  assert.deepEqual(s.byItem.map((i) => i.itemId), ['high', 'low']);
});
