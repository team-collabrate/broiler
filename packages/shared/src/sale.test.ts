import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addLine,
  applyRateKey,
  applyRupeesKey,
  BACKSPACE_KEY,
  cartTotals,
  DEFAULT_GRAMS,
  describeLine,
  formatMoney,
  formatRateInput,
  formatWeight,
  gramsForAmount,
  isValidRupeesInput,
  lineTotalMinor,
  MAX_LINE_GRAMS,
  MIN_GRAMS,
  meterGramsFromX,
  meterXFromGrams,
  normalizeDefaultGrams,
  orderLineTotalMinor,
  parseRateInput,
  parseRupeesInput,
  removeLine,
  stepDownGrams,
  stepUpGrams,
  type CartLine,
} from './sale.ts';

test('lineTotalMinor prices by the kilo and rounds to the paisa', () => {
  assert.equal(lineTotalMinor(24000, 1000), 24000); // 1 kg at 240.00
  assert.equal(lineTotalMinor(24000, 1250), 30000); // 1.25 kg
  assert.equal(lineTotalMinor(24000, 500), 12000);
  assert.equal(lineTotalMinor(24000, 1), 24); // 1 g
  assert.equal(lineTotalMinor(19999, 333), 6660); // 6659.667 rounds up
  assert.equal(lineTotalMinor(0, 1500), 0);
});

test('formatMoney uses Indian grouping and two decimals', () => {
  assert.equal(formatMoney(0), '₹0.00');
  assert.equal(formatMoney(24050), '₹240.50');
  assert.equal(formatMoney(12345678), '₹1,23,456.78');
  assert.equal(formatMoney(-500), '-₹5.00');
});

test('formatWeight switches between grams and kilos', () => {
  assert.equal(formatWeight(850), '850 g');
  assert.equal(formatWeight(1000), '1 kg');
  assert.equal(formatWeight(1250), '1.25 kg');
  assert.equal(formatWeight(1005), '1.005 kg');
  assert.equal(formatWeight(12500), '12.5 kg');
});

test('gramsForAmount converts rupees to the weight they buy, to the nearest gram', () => {
  assert.equal(gramsForAmount(10000, 24000), 417); // ₹100 at ₹240/kg = 416.67 g
  assert.equal(gramsForAmount(20000, 24000), 833); // 833.33 g
  assert.equal(gramsForAmount(24000, 24000), 1000); // exactly one kilo
  assert.equal(gramsForAmount(30000, 24000), 1250);
  assert.equal(gramsForAmount(50000, 24000), 2083); // 2083.33 g
});

test('gramsForAmount gives 0 for an item with no price instead of dividing by zero', () => {
  assert.equal(gramsForAmount(10000, 0), 0);
  assert.equal(gramsForAmount(10000, -5), 0);
});

test('stepUpGrams and stepDownGrams move in 50 g steps and snap odd weights to the grid', () => {
  assert.equal(stepUpGrams(1000), 1050);
  assert.equal(stepDownGrams(1000), 950);
  assert.equal(stepUpGrams(1235), 1250); // 1.235 kg from the keypad
  assert.equal(stepDownGrams(1235), 1200);
  assert.equal(stepUpGrams(1249), 1250);
  assert.equal(stepDownGrams(1251), 1250);
});

test('stepDownGrams never goes under the minimum and stepUpGrams never over the maximum', () => {
  assert.equal(MIN_GRAMS, 50);
  assert.equal(stepDownGrams(50), 50);
  assert.equal(stepDownGrams(30), 50);
  assert.equal(stepUpGrams(MAX_LINE_GRAMS), MAX_LINE_GRAMS);
  assert.equal(stepUpGrams(MAX_LINE_GRAMS - 10), MAX_LINE_GRAMS);
});

test('normalizeDefaultGrams keeps a sensible stored weight and falls back otherwise', () => {
  assert.equal(normalizeDefaultGrams(100), 100); // liver
  assert.equal(normalizeDefaultGrams(500), 500);
  assert.equal(normalizeDefaultGrams(1000), 1000);
  for (const bad of [undefined, null, 0, 30, -500, 1.5, '500', NaN, 10_000_000]) {
    assert.equal(normalizeDefaultGrams(bad), DEFAULT_GRAMS, `expected the fallback for ${String(bad)}`);
  }
  assert.equal(DEFAULT_GRAMS, 1000);
});

const METER = { width: 900, thumb: 64, max: 5000 };
const gramsAt = (x: number) => meterGramsFromX(x, METER.width, METER.thumb, METER.max);

test('meterGramsFromX maps the handle travel onto the scale and snaps to 50 g', () => {
  assert.equal(gramsAt(32), 50); // far left: 0 g is lifted to the minimum
  assert.equal(gramsAt(868), 5000); // far right
  assert.equal(gramsAt(450), 2500); // exact middle
  assert.equal(gramsAt(32 + 836 * 0.2), 1000); // 20% of the travel is 1 kg
  assert.equal(gramsAt(32 + 836 * 0.2 + 3), 1000); // a few dp either side still snaps to 1 kg
  assert.equal(gramsAt(32 + 836 * 0.2 + 5), 1050); // past half a step (4.2 dp) it moves on
});

test('meterGramsFromX clamps a finger that leaves the strip', () => {
  assert.equal(gramsAt(-200), 50);
  assert.equal(gramsAt(0), 50);
  assert.equal(gramsAt(5000), 5000);
  assert.equal(meterGramsFromX(10, 60, 64, 5000), 50); // strip narrower than the handle
});

test('meterXFromGrams and meterGramsFromX are inverses on every 50 g step', () => {
  for (let g = 50; g <= 5000; g += 50) {
    assert.equal(gramsAt(meterXFromGrams(g, METER.width, METER.thumb, METER.max)), g, `${g} g`);
  }
  assert.equal(meterXFromGrams(0, 900, 64, 5000), 32);
  assert.equal(meterXFromGrams(5000, 900, 64, 5000), 868);
  assert.equal(meterXFromGrams(12000, 900, 64, 5000), 868); // beyond the scale pins to the end
});

test('parseRupeesInput converts whole rupees to paise', () => {
  assert.equal(parseRupeesInput('350'), 35000);
  assert.equal(parseRupeesInput('1'), 100);
  assert.equal(parseRupeesInput('99999'), 9999900);
});

test('parseRupeesInput rejects empty, zero and malformed entries', () => {
  for (const bad of ['', '0', '00', '100000', '1.5', '-5', 'abc']) {
    assert.equal(parseRupeesInput(bad), null, `expected null for "${bad}"`);
  }
});

test('isValidRupeesInput accepts partial entries while typing', () => {
  for (const ok of ['', '1', '35', '99999']) assert.equal(isValidRupeesInput(ok), true, ok);
  for (const bad of ['100000', '1.5', 'x']) assert.equal(isValidRupeesInput(bad), false, bad);
});

const typeRupees = (keys: string[]) => keys.reduce(applyRupeesKey, '');

test('applyRupeesKey builds a whole-rupee entry key by key', () => {
  assert.equal(typeRupees(['3', '5', '0']), '350');
  assert.equal(typeRupees(['0', '5']), '5'); // no leading zero
  assert.equal(typeRupees(['1', '2', '3', '4', '5', '6']), '12345'); // at most 5 digits
  assert.equal(typeRupees(['1', '.', '5']), '15'); // no decimals in rupee entry
  assert.equal(typeRupees(['1', '2', BACKSPACE_KEY]), '1');
});

test('parseRateInput converts a per-kg rate to paise', () => {
  assert.equal(parseRateInput('240'), 24000);
  assert.equal(parseRateInput('240.5'), 24050);
  assert.equal(parseRateInput('240.50'), 24050);
  assert.equal(parseRateInput('99.99'), 9999);
  assert.equal(parseRateInput('.5'), 50);
  assert.equal(parseRateInput('5.'), 500);
  assert.equal(parseRateInput('9999.99'), 999999);
});

test('parseRateInput rejects empty, zero and malformed entries', () => {
  for (const bad of ['', '.', '0', '0.00', '10000', '1.234', '1.2.3', '-5', 'abc']) {
    assert.equal(parseRateInput(bad), null, `expected null for "${bad}"`);
  }
});

test('formatRateInput gives editable text that parses back to the same rate', () => {
  assert.equal(formatRateInput(24000), '240');
  assert.equal(formatRateInput(24050), '240.50');
  assert.equal(formatRateInput(24010), '240.10');
  assert.equal(formatRateInput(50), '0.50');
  for (const minor of [24000, 24050, 9999, 1, 999999]) assert.equal(parseRateInput(formatRateInput(minor)), minor);
});

test('applyRateKey builds a rate entry key by key', () => {
  const typeRate = (keys: string[]) => keys.reduce(applyRateKey, '');
  assert.equal(typeRate(['2', '4', '0']), '240');
  assert.equal(typeRate(['2', '4', '0', '.', '5']), '240.5');
  assert.equal(typeRate(['.', '5']), '0.5');
  assert.equal(typeRate(['0', '5']), '5');
  assert.equal(typeRate(['1', '2', '3', '4', '5']), '1234'); // at most 4 integer digits
  assert.equal(typeRate(['1', '.', '2', '3', '4']), '1.23'); // at most 2 decimals
  assert.equal(typeRate(['1', '.', '5', '.']), '1.5');
  assert.equal(typeRate(['2', '4', BACKSPACE_KEY]), '2');
});

const chicken = { itemId: 'chicken', name: 'Chicken', pricePerKgMinor: 24000 };
const byWeight = (grams: number): CartLine => ({ ...chicken, grams });
const byAmount = (amountMinor: number): CartLine => ({
  ...chicken,
  grams: gramsForAmount(amountMinor, chicken.pricePerKgMinor),
  amountMinor,
});

test('orderLineTotalMinor prices a weighed line from its weight and a fixed-amount line at exactly the amount', () => {
  assert.equal(orderLineTotalMinor(byWeight(1250)), 30000);
  // 417 g would price at ₹100.08, but the customer asked for ₹100.
  assert.equal(lineTotalMinor(24000, 417), 10008);
  assert.equal(orderLineTotalMinor(byAmount(10000)), 10000);
});

test('describeLine explains how a line was sold', () => {
  assert.equal(describeLine(byWeight(1250)), '1.25 kg × ₹240.00/kg');
  assert.equal(describeLine(byAmount(10000)), '≈ 417 g (by amount)');
});

test('addLine starts a new line and merges repeat weighings of the same item', () => {
  const two = addLine(addLine([], byWeight(500)), { ...chicken, itemId: 'liver', name: 'Liver', grams: 250 });
  assert.equal(two.length, 2);
  const merged = addLine(two, byWeight(1000));
  assert.equal(merged.length, 2);
  assert.equal(merged.find((l) => l.itemId === 'chicken')?.grams, 1500);
  assert.equal(cartTotals(merged).totalGrams, 1750);
});

test('merging two weighed portions stays priced by weight', () => {
  const merged = addLine([byWeight(500)], byWeight(750));
  assert.equal(merged[0].amountMinor, undefined);
  assert.equal(merged[0].grams, 1250);
  assert.equal(cartTotals(merged).totalMinor, 30000);
});

test('merging a fixed-amount portion keeps the exact sum of what each portion cost', () => {
  const merged = addLine([byAmount(10000)], byAmount(20000));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].amountMinor, 30000);
  assert.equal(merged[0].grams, 417 + 833);
  assert.equal(cartTotals(merged).totalMinor, 30000);

  // A weighed portion added to a fixed-amount one: ₹100 + 500 g (₹120.00) = ₹220.00.
  const mixed = addLine([byAmount(10000)], byWeight(500));
  assert.equal(mixed[0].amountMinor, 22000);
  assert.equal(cartTotals(mixed).totalMinor, 22000);

  // The other way round gives the same total.
  const reversed = addLine([byWeight(500)], byAmount(10000));
  assert.equal(cartTotals(reversed).totalMinor, 22000);
});

test('addLine caps a merged weight at the maximum', () => {
  const merged = addLine([byWeight(MAX_LINE_GRAMS - 100)], byWeight(5000));
  assert.equal(merged[0].grams, MAX_LINE_GRAMS);
});

test('removeLine drops one item and cartTotals sums the rest', () => {
  const lines = [byWeight(1000), { ...chicken, itemId: 'liver', name: 'Liver', pricePerKgMinor: 20000, grams: 500 }];
  assert.deepEqual(cartTotals(lines), { totalMinor: 34000, totalGrams: 1500 });
  const after = removeLine(lines, 'chicken');
  assert.deepEqual(after.map((l) => l.itemId), ['liver']);
  assert.deepEqual(cartTotals(after), { totalMinor: 10000, totalGrams: 500 });
  assert.deepEqual(cartTotals([]), { totalMinor: 0, totalGrams: 0 });
});
