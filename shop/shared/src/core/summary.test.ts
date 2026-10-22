import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combineSales, dayTotalsFromData, dayTotalsFromOrders, salesByDay, salesByHour, summarizeOrders } from './summary.ts';
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
    byPayment: { cash: 0, upi: 0, card: 0, split: 0, credit: 0 },
    cashCollectedMinor: 0,
    upiCollectedMinor: 0,
    creditGivenMinor: 0,
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
  assert.deepEqual(s.byPayment, { cash: 32000, upi: 36000, card: 0, split: 0, credit: 0 });
  assert.equal(s.cashCollectedMinor, 32000);
  assert.equal(s.upiCollectedMinor, 36000);
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

test('split bills count their cash half as cash and their GPay half as UPI; credit is sold but not collected', () => {
  const s = summarizeOrders([
    order({ paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 14000, lines: [line('a', 'Chicken', 1000, 24000)] }),
    order({ paymentMethod: 'credit', customerId: 'ravi', customerName: 'Ravi', lines: [line('a', 'Chicken', 500, 12000)] }),
    order({ paymentMethod: 'cash', lines: [line('a', 'Chicken', 250, 6000)] }),
  ]);
  assert.equal(s.totalMinor, 42000); // a credit sale is still a sale
  assert.equal(s.cashCollectedMinor, 10000 + 6000);
  assert.equal(s.upiCollectedMinor, 14000); // the split's cash half never reached the account
  assert.equal(s.creditGivenMinor, 12000);
  assert.equal(s.byPayment.split, 24000);
  assert.equal(s.byPayment.credit, 12000);
});

test('a deleted (voided) bill is left out of every total', () => {
  const live = order({ id: 'a', lines: [line('naatu', 'Naatukoli', 1000, 24000)], paymentMethod: 'cash' });
  const voided = order({ id: 'b', lines: [line('naatu', 'Naatukoli', 2000, 48000)], paymentMethod: 'upi', status: 'voided' });
  const s = summarizeOrders([live, voided]);
  assert.equal(s.orderCount, 1);
  assert.equal(s.totalMinor, 24000);
  assert.equal(s.totalGrams, 1000);
  assert.equal(s.upiCollectedMinor, 0);
  assert.equal(s.byItem.length, 1);
});

test('a day\'s totals are saved from its bills and read back unchanged', () => {
  const bills = [
    order({ id: 'a', lines: [line('naatu', 'Naatukoli', 1500, 36000)], paymentMethod: 'cash' }),
    order({ id: 'b', lines: [line('naatu', 'Naatukoli', 500, 12000), pieces('egg', 'Egg', 4, 1000)], paymentMethod: 'credit' }),
    order({ id: 'c', lines: [line('naatu', 'Naatukoli', 9000, 99999)], paymentMethod: 'cash', status: 'voided' }),
  ];
  const day = dayTotalsFromOrders('2026-10-08', bills);
  assert.equal(day.orderCount, 2);
  assert.equal(day.totalMinor, 52000);
  assert.equal(day.cashMinor, 36000);
  assert.equal(day.creditMinor, 16000);
  assert.equal(day.totalGrams, 2000);
  assert.equal(day.totalPieces, 4);
  assert.deepEqual(day.items.naatu, { name: 'Naatukoli', category: 'broiler', unit: 'kg', grams: 2000, qty: 0, totalMinor: 48000 });
  assert.deepEqual(day.categories, { broiler: 48000, more: 4000 });
  assert.deepEqual(dayTotalsFromData('2026-10-08', JSON.parse(JSON.stringify(day))), day);
});

test('reading a saved day tolerates missing fields', () => {
  const day = dayTotalsFromData('2026-10-08', { totalMinor: 500 });
  assert.equal(day.totalMinor, 500);
  assert.equal(day.orderCount, 0);
  assert.deepEqual(day.items, {});
});

test('recent bills and saved days add up together, item by item', () => {
  const recent = [order({ id: 'a', lines: [line('naatu', 'Naatukoli', 1000, 24000)], paymentMethod: 'cash' })];
  const saved = dayTotalsFromOrders('2026-10-01', [order({ id: 'z', lines: [line('naatu', 'Naatukoli', 2000, 48000), line('kadai', 'Kadai', 500, 10000)], paymentMethod: 'upi' })]);
  const both = combineSales(recent, [saved]);
  assert.equal(both.orderCount, 2);
  assert.equal(both.totalMinor, 82000);
  assert.equal(both.totalGrams, 3500);
  assert.equal(both.cashCollectedMinor, 24000);
  assert.equal(both.upiCollectedMinor, 58000);
  assert.deepEqual(both.byItem.map((i) => [i.itemId, i.grams, i.totalMinor]), [['naatu', 3000, 72000], ['kadai', 500, 10000]]);
  assert.deepEqual(both.byCategory, [{ category: 'broiler', totalMinor: 82000 }]);
  assert.equal(combineSales([], []).totalMinor, 0);
});

test('sales by hour use the time of the sale and skip deleted bills', () => {
  const at = (h: number) => new Date(2026, 9, 8, h, 15);
  const hours = salesByHour([
    order({ id: 'a', lines: [line('n', 'N', 1000, 100)], paymentMethod: 'cash', createdAt: at(11), soldAt: at(9) }),
    order({ id: 'b', lines: [line('n', 'N', 1000, 200)], paymentMethod: 'cash', createdAt: at(9) }),
    order({ id: 'c', lines: [line('n', 'N', 1000, 400)], paymentMethod: 'cash', createdAt: at(9), status: 'voided' }),
  ]);
  assert.equal(hours.length, 24);
  assert.equal(hours[9], 300);
  assert.equal(hours[11], 0);
});

test('sales by day take full bills for recent days and saved totals for older ones', () => {
  const keys = ['2026-10-05', '2026-10-06', '2026-10-07'];
  const bills = [
    order({ id: 'a', dayKey: '2026-10-07', lines: [line('n', 'N', 1000, 300)], paymentMethod: 'cash' }),
    order({ id: 'b', dayKey: '2026-10-07', lines: [line('n', 'N', 1000, 100)], paymentMethod: 'cash', status: 'voided' }),
    order({ id: 'c', dayKey: '2026-09-01', lines: [line('n', 'N', 1000, 999)], paymentMethod: 'cash' }),
  ];
  const saved = [dayTotalsFromOrders('2026-10-05', [order({ id: 'z', dayKey: '2026-10-05', lines: [line('n', 'N', 1000, 700)], paymentMethod: 'cash' })])];
  assert.deepEqual(salesByDay(keys, bills, saved), [
    { dayKey: '2026-10-05', totalMinor: 700 },
    { dayKey: '2026-10-06', totalMinor: 0 },
    { dayKey: '2026-10-07', totalMinor: 300 },
  ]);
});
