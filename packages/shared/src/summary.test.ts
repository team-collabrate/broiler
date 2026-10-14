import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeOrders } from './summary.ts';
import type { Order, OrderLine } from './types.ts';

function order(partial: Partial<Order> & Pick<Order, 'lines' | 'paymentMethod'>): Order {
  const totalMinor = partial.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  const totalGrams = partial.lines.reduce((s, l) => s + l.grams, 0);
  const totalPieces = partial.lines.reduce((s, l) => s + l.qty, 0);
  return { id: 'o', orderNo: 1, dayKey: '2026-10-08', createdAt: new Date(2026, 9, 8), totalMinor, totalGrams, totalPieces, ...partial };
}

const line = (itemId: string, name: string, grams: number, lineTotalMinor: number, extra: Partial<OrderLine> = {}): OrderLine => ({
  itemId,
  name,
  category: 'broiler',
  unit: 'kg',
  rateMinor: 0,
  listRateMinor: 0,
  grams,
  qty: 0,
  lineTotalMinor,
  ...extra,
});

const pieces = (itemId: string, name: string, qty: number, rateMinor: number, extra: Partial<OrderLine> = {}): OrderLine =>
  line(itemId, name, 0, qty * rateMinor, { category: 'more', unit: 'piece', qty, rateMinor, listRateMinor: rateMinor, ...extra });

test('summarizing no orders gives zeros', () => {
  assert.deepEqual(summarizeOrders([]), {
    orderCount: 0,
    totalMinor: 0,
    totalGrams: 0,
    totalPieces: 0,
    byItem: [],
    byCategory: [],
    byPayment: { cash: 0, upi: 0, card: 0 },
    adjustedLines: 0,
    adjustmentTotalMinor: 0,
  });
});

test('totals, per-item sales and payment split add up', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'cash', lines: [line('a', 'Chicken', 1000, 24000), line('b', 'Liver', 500, 8000, { category: 'offal' })] }),
    order({ paymentMethod: 'upi', lines: [line('a', 'Chicken', 1500, 36000)] }),
  ]);

  assert.equal(s.orderCount, 2);
  assert.equal(s.totalMinor, 68000);
  assert.equal(s.totalGrams, 3000);
  assert.deepEqual(s.byPayment, { cash: 32000, upi: 36000, card: 0 });
  assert.deepEqual(s.byItem, [
    { itemId: 'a', name: 'Chicken', category: 'broiler', unit: 'kg', grams: 2500, qty: 0, totalMinor: 60000 },
    { itemId: 'b', name: 'Liver', category: 'offal', unit: 'kg', grams: 500, qty: 0, totalMinor: 8000 },
  ]);
  assert.deepEqual(s.byCategory, [
    { category: 'broiler', totalMinor: 60000 },
    { category: 'offal', totalMinor: 8000 },
  ]);
});

test('byItem is ordered by revenue, best seller first', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'cash', lines: [line('low', 'Low', 5000, 1000), line('high', 'High', 100, 9000)] }),
  ]);
  assert.deepEqual(s.byItem.map((i) => i.itemId), ['high', 'low']);
});

test('piece items add up as a count, separate from the weight sold', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'cash', lines: [line('a', 'Chicken', 1000, 24000), pieces('podi', 'Podi', 3, 1000)] }),
    order({ paymentMethod: 'cash', lines: [pieces('podi', 'Podi', 2, 1000)] }),
  ]);
  assert.equal(s.totalGrams, 1000);
  assert.equal(s.totalPieces, 5);
  const podi = s.byItem.find((i) => i.itemId === 'podi');
  assert.equal(podi?.qty, 5);
  assert.equal(podi?.grams, 0);
  assert.equal(podi?.totalMinor, 5000);
});

test('adjusted lines are counted and their effect on the takings is totalled', () => {
  const s = summarizeOrders([
    order({
      paymentMethod: 'cash',
      lines: [
        // 1 kg sold at ₹235 against a ₹240 list: ₹5 less.
        line('a', 'Chicken', 1000, 23500, { rateMinor: 23500, listRateMinor: 24000 }),
        // 3 pieces at ₹12 against a ₹10 list: ₹6 more.
        pieces('podi', 'Podi', 3, 1200, { listRateMinor: 1000 }),
        // A line at list rate is not an adjustment.
        line('b', 'Liver', 500, 10000, { rateMinor: 20000, listRateMinor: 20000 }),
      ],
    }),
  ]);
  assert.equal(s.adjustedLines, 2);
  assert.equal(s.adjustmentTotalMinor, -500 + 600);
});

test('a fixed-amount line that was adjusted counts as adjusted but does not change the takings figure', () => {
  const s = summarizeOrders([
    order({
      paymentMethod: 'cash',
      lines: [line('a', 'Chicken', 408, 10000, { rateMinor: 24500, listRateMinor: 24000, amountMinor: 10000 })],
    }),
  ]);
  assert.equal(s.adjustedLines, 1);
  assert.equal(s.adjustmentTotalMinor, 0);
});
