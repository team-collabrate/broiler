import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADJUST_STEP_MINOR,
  addLine,
  adjustLine,
  canAddLine,
  MAX_ORDER_LINES,
  adjustmentMinor,
  applyQtyKey,
  applyRateKey,
  applyRupeesKey,
  BACKSPACE_KEY,
  cartTotals,
  clampRate,
  DEFAULT_GRAMS,
  DEFAULT_MAX_ADJUST_MINOR,
  DEFAULT_QTY,
  describeLine,
  formatLineQuantity,
  formatMoney,
  formatQty,
  formatRate,
  formatRateInput,
  formatTotals,
  formatWeight,
  gramsForAmount,
  isValidRupeesInput,
  lineTotalMinor,
  MAX_LINE_GRAMS,
  MAX_QTY,
  MIN_GRAMS,
  meterGramsFromX,
  meterXFromGrams,
  normalizeDefaultGrams,
  normalizeDefaultQty,
  normalizeMethods,
  replaceLine,
  splitGrams,
  splitPayment,
  unitSuffix,
  upiFromTyped,
  filterCustomersByName,
  isRealSplit,
  customerNameKey,
  tidyCustomerName,
  customerIdFromName,
  paymentProblem,
  wheelIndexFromOffset,
  wheelMaxOffset,
  normalizeMaxAdjust,
  orderLineTotalMinor,
  parseQtyInput,
  parseRateInput,
  parseRupeesInput,
  pieceTotalMinor,
  removeLine,
  stepDownGrams,
  stepDownQty,
  stepUpGrams,
  stepUpQty,
  type CartLine,
} from './sale.ts';
import type { OrderLineInput } from './types.ts';

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
  assert.equal(formatWeight(850), '850 கிராம்');
  assert.equal(formatWeight(1000), '1 கிலோ');
  assert.equal(formatWeight(1250), '1.25 கிலோ');
  assert.equal(formatWeight(1005), '1.005 கிலோ');
  assert.equal(formatWeight(12500), '12.5 கிலோ');
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

const chicken = { itemId: 'chicken', name: 'Chicken', category: 'broiler', unit: 'kg' as const, rateMinor: 24000, listRateMinor: 24000, qty: 0 };
const byWeight = (grams: number): OrderLineInput => ({ ...chicken, grams });
const byAmount = (amountMinor: number): OrderLineInput => ({
  ...chicken,
  grams: gramsForAmount(amountMinor, chicken.rateMinor),
  amountMinor,
});
const eggs = (qty: number, rateMinor = 1000): OrderLineInput => ({
  itemId: 'podi',
  name: 'Podi',
  category: 'more',
  unit: 'piece',
  rateMinor,
  listRateMinor: rateMinor,
  grams: 0,
  qty,
});
const cart = (...lines: OrderLineInput[]): CartLine[] => lines.reduce<CartLine[]>(addLine, []);

test('orderLineTotalMinor prices a weighed line from its weight and a fixed-amount line at exactly the amount', () => {
  assert.equal(orderLineTotalMinor({ ...byWeight(1250) }), 30000);
  // 417 g would price at ₹100.08, but the customer asked for ₹100.
  assert.equal(lineTotalMinor(24000, 417), 10008);
  assert.equal(orderLineTotalMinor(byAmount(10000)), 10000);
});

test('a piece line is priced as rate times count', () => {
  assert.equal(orderLineTotalMinor(eggs(3)), 3000);
  assert.equal(orderLineTotalMinor(eggs(12, 750)), 9000);
  assert.equal(pieceTotalMinor(1000, 0), 0);
});

test('the formatters speak English on the counter screen and Tamil on the bill', () => {
  assert.equal(formatWeight(850, 'en'), '850 g');
  assert.equal(formatWeight(1250, 'en'), '1.25 kg');
  assert.equal(formatWeight(1000, 'en'), '1 kg');
  assert.equal(formatQty(1, 'en'), '1 pc');
  assert.equal(formatQty(3, 'en'), '3 pcs');
  assert.equal(formatQty(3), '3 எண்');
  assert.equal(unitSuffix('kg', 'en'), '/kg');
  assert.equal(unitSuffix('piece', 'en'), '/pc');
  assert.equal(formatRate(24000, 'kg', 'en'), '₹240.00/kg');
  assert.equal(formatTotals(1500, 3, 'en'), '1.5 kg · 3 pcs');
  assert.equal(formatTotals(1500, 3), '1.5 கிலோ · 3 எண்');
  assert.equal(formatTotals(0, 0, 'en'), '');
  assert.equal(describeLine(byWeight(1250), 'en'), '1.25 kg × ₹240.00/kg');
  assert.equal(describeLine(byAmount(10000), 'en'), '≈ 417 g (by amount)');
  assert.equal(describeLine(eggs(3), 'en'), '3 pcs × ₹10.00/pc');
  assert.equal(formatLineQuantity(byAmount(10000), 'en'), '≈ 417 g');
});

test('describeLine explains how a line was sold', () => {
  assert.equal(describeLine(byWeight(1250)), '1.25 கிலோ × ₹240.00/கிலோ');
  assert.equal(describeLine(byAmount(10000)), '≈ 417 கிராம் (தொகைப்படி)');
  assert.equal(describeLine(eggs(3)), '3 எண் × ₹10.00/எண்');
});

test('formatLineQuantity gives the weight or the count for the bill', () => {
  assert.equal(formatLineQuantity(byWeight(500)), '500 கிராம்');
  assert.equal(formatLineQuantity(byAmount(10000)), '≈ 417 கிராம்');
  assert.equal(formatLineQuantity(eggs(2)), '2 எண்');
  assert.equal(formatRate(24000, 'kg'), '₹240.00/கிலோ');
  assert.equal(formatRate(1000, 'piece'), '₹10.00/எண்');
});

test('quantity stepping stays between 1 and the maximum', () => {
  assert.equal(stepUpQty(1), 2);
  assert.equal(stepDownQty(2), 1);
  assert.equal(stepDownQty(1), 1);
  assert.equal(stepUpQty(MAX_QTY), MAX_QTY);
});

test('normalizeDefaultQty keeps a sensible stored count and falls back to 1', () => {
  assert.equal(normalizeDefaultQty(5), 5);
  for (const bad of [undefined, null, 0, -1, 1.5, '2', NaN, 1000]) {
    assert.equal(normalizeDefaultQty(bad), DEFAULT_QTY, `expected the fallback for ${String(bad)}`);
  }
});

test('addLine starts a new line and merges repeat weighings of the same item', () => {
  const two = cart(byWeight(500), { ...byWeight(250), itemId: 'liver', name: 'Liver' });
  assert.equal(two.length, 2);
  const merged = addLine(two, byWeight(1000));
  assert.equal(merged.length, 2);
  assert.equal(merged.find((l) => l.itemId === 'chicken')?.grams, 1500);
  assert.equal(cartTotals(merged).totalGrams, 1750);
});

test('merging two weighed portions stays priced by weight', () => {
  const merged = cart(byWeight(500), byWeight(750));
  assert.equal(merged[0].amountMinor, undefined);
  assert.equal(merged[0].grams, 1250);
  assert.equal(cartTotals(merged).totalMinor, 30000);
});

test('merging piece lines adds the counts and caps at the maximum', () => {
  const merged = cart(eggs(2), eggs(3));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].qty, 5);
  assert.equal(cartTotals(merged).totalMinor, 5000);
  assert.equal(addLine(cart(eggs(MAX_QTY - 1)), eggs(10))[0].qty, MAX_QTY);
});

test('merging a fixed-amount portion keeps the exact sum of what each portion cost', () => {
  const merged = cart(byAmount(10000), byAmount(20000));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].amountMinor, 30000);
  assert.equal(merged[0].grams, 417 + 833);
  assert.equal(cartTotals(merged).totalMinor, 30000);

  // A weighed portion added to a fixed-amount one: ₹100 + 500 g (₹120.00) = ₹220.00.
  const mixed = cart(byAmount(10000), byWeight(500));
  assert.equal(mixed[0].amountMinor, 22000);
  assert.equal(cartTotals(mixed).totalMinor, 22000);

  // The other way round gives the same total.
  const reversed = cart(byWeight(500), byAmount(10000));
  assert.equal(cartTotals(reversed).totalMinor, 22000);
});

test('addLine caps a merged weight at the maximum', () => {
  const merged = addLine(cart(byWeight(MAX_LINE_GRAMS - 100)), byWeight(5000));
  assert.equal(merged[0].grams, MAX_LINE_GRAMS);
});

test('the same item at a different rate becomes its own line instead of merging', () => {
  const lines = cart(byWeight(500), { ...byWeight(500), rateMinor: 23500 });
  assert.equal(lines.length, 2);
  assert.notEqual(lines[0].key, lines[1].key);
  assert.equal(cartTotals(lines).totalMinor, 12000 + 11750);
});

test('removeLine drops one line by key and cartTotals sums the rest', () => {
  const lines = cart(byWeight(1000), { ...byWeight(500), itemId: 'liver', name: 'Liver', rateMinor: 20000, listRateMinor: 20000 }, eggs(4));
  assert.deepEqual(cartTotals(lines), { totalMinor: 24000 + 10000 + 4000, totalGrams: 1500, totalPieces: 4 });
  const after = removeLine(lines, lines[0].key);
  assert.deepEqual(after.map((l) => l.itemId), ['liver', 'podi']);
  assert.deepEqual(cartTotals(after), { totalMinor: 14000, totalGrams: 500, totalPieces: 4 });
  assert.deepEqual(cartTotals([]), { totalMinor: 0, totalGrams: 0, totalPieces: 0 });
});

test('clampRate keeps a rate within the allowed distance of the list rate and above zero', () => {
  assert.equal(clampRate(24500, 24000, DEFAULT_MAX_ADJUST_MINOR), 24500);
  assert.equal(clampRate(30000, 24000, DEFAULT_MAX_ADJUST_MINOR), 26000); // +₹20 at most
  assert.equal(clampRate(10000, 24000, DEFAULT_MAX_ADJUST_MINOR), 22000); // -₹20 at most
  assert.equal(clampRate(-5, 1000, 5000), 1); // never zero or negative
  assert.equal(adjustmentMinor({ rateMinor: 23500, listRateMinor: 24000 }), -500);
});

test('adjustLine moves the rate in the given step and re-prices the line', () => {
  const lines = cart(byWeight(1000));
  const down = adjustLine(lines, lines[0].key, -ADJUST_STEP_MINOR, DEFAULT_MAX_ADJUST_MINOR);
  assert.equal(down[0].rateMinor, 23500);
  assert.equal(down[0].listRateMinor, 24000); // the list rate stays on record
  assert.equal(cartTotals(down).totalMinor, 23500);
});

test('adjustLine stops at the limit and leaves other lines alone', () => {
  let lines = cart(byWeight(1000), eggs(2));
  for (let i = 0; i < 10; i++) lines = adjustLine(lines, lines[0].key, ADJUST_STEP_MINOR, DEFAULT_MAX_ADJUST_MINOR);
  assert.equal(lines[0].rateMinor, 26000); // 10 steps of +₹5 stop at +₹20
  assert.equal(lines[1].rateMinor, 1000);
});

test('adjusting a fixed-amount line keeps the amount and changes the weight to weigh out', () => {
  const lines = cart(byAmount(10000)); // ₹100 at ₹240/kg = 417 g
  const up = adjustLine(lines, lines[0].key, ADJUST_STEP_MINOR, DEFAULT_MAX_ADJUST_MINOR); // ₹245/kg
  assert.equal(up[0].amountMinor, 10000);
  assert.equal(up[0].grams, gramsForAmount(10000, 24500)); // 408 g
  assert.equal(cartTotals(up).totalMinor, 10000);
});

test('parseQtyInput accepts counts from 1 to 999 and rejects the rest', () => {
  assert.equal(parseQtyInput('1'), 1);
  assert.equal(parseQtyInput('12'), 12);
  assert.equal(parseQtyInput('999'), 999);
  for (const bad of ['', '0', '00', '1000', '1.5', '-2', 'x']) assert.equal(parseQtyInput(bad), null, `expected null for "${bad}"`);
});

test('applyQtyKey builds a count key by key', () => {
  const typeQty = (keys: string[]) => keys.reduce(applyQtyKey, '');
  assert.equal(typeQty(['1', '2']), '12');
  assert.equal(typeQty(['0', '5']), '5'); // no leading zero
  assert.equal(typeQty(['1', '2', '3', '4']), '123'); // at most 3 digits
  assert.equal(typeQty(['1', '.', '5']), '15');
  assert.equal(typeQty(['1', '2', BACKSPACE_KEY]), '1');
});

test('normalizeMaxAdjust keeps whole steps and falls back to the default for unusable values', () => {
  assert.equal(normalizeMaxAdjust(2000), 2000);
  assert.equal(normalizeMaxAdjust(0), 0); // the owner can switch adjustment off
  assert.equal(normalizeMaxAdjust(2300), 2000); // rounded down to a whole step
  for (const bad of [undefined, null, -500, 1.5, '2000', NaN, 10_000_000]) {
    assert.equal(normalizeMaxAdjust(bad), DEFAULT_MAX_ADJUST_MINOR, String(bad));
  }
});

test('canAddLine stops a 21st line but still lets an existing line grow', () => {
  let lines: CartLine[] = [];
  for (let i = 0; i < MAX_ORDER_LINES; i++) lines = addLine(lines, { ...byWeight(500), itemId: 'item' + i });
  assert.equal(lines.length, MAX_ORDER_LINES);
  assert.equal(canAddLine(lines, { ...byWeight(500), itemId: 'another' }), false);
  assert.equal(canAddLine(lines, { ...byWeight(500), itemId: 'item3' }), true);
  assert.equal(canAddLine([], byWeight(500)), true);
});

test('normalizeMethods keeps only methods that suit the unit and falls back to the usual ones', () => {
  assert.deepEqual(normalizeMethods('kg', ['amount', 'weight']), ['amount', 'weight']); // order is the owner's
  assert.deepEqual(normalizeMethods('kg', ['weight', 'weight', 'qty', 'junk']), ['weight']); // no repeats, no qty for kg
  assert.deepEqual(normalizeMethods('piece', ['qty', 'amount']), ['qty', 'amount']);
  assert.deepEqual(normalizeMethods('piece', ['weight']), ['qty']); // nothing usable: the usual
  for (const bad of [undefined, null, [], 'weight', 5]) {
    assert.deepEqual(normalizeMethods('kg', bad), ['weight', 'amount']);
    assert.deepEqual(normalizeMethods('piece', bad), ['qty']);
  }
});

test('wheelIndexFromOffset picks the nearest row and stays inside the list', () => {
  assert.equal(wheelIndexFromOffset(0, 48, 20), 0);
  assert.equal(wheelIndexFromOffset(47, 48, 20), 1);
  assert.equal(wheelIndexFromOffset(23, 48, 20), 0); // under half a row stays
  assert.equal(wheelIndexFromOffset(25, 48, 20), 1); // past half a row moves on
  assert.equal(wheelIndexFromOffset(-100, 48, 20), 0);
  assert.equal(wheelIndexFromOffset(99999, 48, 20), 19);
  assert.equal(wheelIndexFromOffset(10, 48, 0), 0);
  assert.equal(wheelMaxOffset(48, 20), 19 * 48);
  assert.equal(wheelMaxOffset(48, 0), 0);
});

test('splitGrams breaks a weight into the kilo and grams wheels, snapped to the step', () => {
  assert.deepEqual(splitGrams(1500, 30), { kg: 1, gramsPart: 500 });
  assert.deepEqual(splitGrams(850, 30), { kg: 0, gramsPart: 850 });
  assert.deepEqual(splitGrams(1000, 30), { kg: 1, gramsPart: 0 });
  assert.deepEqual(splitGrams(1235, 30), { kg: 1, gramsPart: 250 }); // snapped to 1250
  assert.deepEqual(splitGrams(1980, 30), { kg: 2, gramsPart: 0 }); // 1950 + rounding up carries to the next kilo
  assert.deepEqual(splitGrams(30000, 30), { kg: 30, gramsPart: 0 });
  assert.equal(splitGrams(31000, 30), null);
});

test('a 1.5 kg sale at 240 a kilo is 360 rupees', () => {
  const { kg, gramsPart } = splitGrams(1500, 30)!;
  assert.equal(kg * 1000 + gramsPart, 1500);
  assert.equal(lineTotalMinor(24000, 1500), 36000);
});

test('replaceLine swaps one line in place without merging it into another', () => {
  const lines = cart(byWeight(500), { ...byWeight(250), itemId: 'liver', name: 'Liver' });
  const keyOfChicken = lines[0].key;
  const edited = replaceLine(lines, keyOfChicken, { ...byWeight(1500), rateMinor: 23500 });
  assert.equal(edited.length, 2);
  assert.equal(edited[0].key, keyOfChicken); // same place, same key
  assert.equal(edited[0].grams, 1500);
  assert.equal(edited[0].rateMinor, 23500);
  assert.equal(edited[1].grams, 250);
  // Edited to exactly match the other line's item and rate: still two lines (an edit never merges).
  const same = replaceLine(edited, edited[1].key, { ...byWeight(250) });
  assert.equal(same.length, 2);
});

test('a piece line billed by amount charges that amount and keeps its count', () => {
  const masala: OrderLineInput = { ...eggs(3), amountMinor: 2500 };
  assert.equal(orderLineTotalMinor(masala), 2500);
  assert.equal(describeLine(masala), '3 எண் (தொகைப்படி)');
  assert.equal(cartTotals(cart(masala)).totalPieces, 3);
});

test('splitPayment stores the GPay half and leaves the rest as cash, held inside the bill', () => {
  assert.deepEqual(splitPayment(50000, 30000), { upiMinor: 30000, cashMinor: 20000 });
  assert.deepEqual(splitPayment(50000, 0), { upiMinor: 0, cashMinor: 50000 });
  assert.deepEqual(splitPayment(50000, 70000), { upiMinor: 50000, cashMinor: 0 }); // more than the bill: all GPay
  assert.deepEqual(splitPayment(50000, -5), { upiMinor: 0, cashMinor: 50000 });
  assert.deepEqual(splitPayment(50000, NaN), { upiMinor: 0, cashMinor: 50000 });
  assert.deepEqual(splitPayment(0, 100), { upiMinor: 0, cashMinor: 0 });
  const { upiMinor, cashMinor } = splitPayment(33333, 12345);
  assert.equal(upiMinor + cashMinor, 33333); // the two always add back to the bill
});

test('isRealSplit needs money on both sides', () => {
  assert.equal(isRealSplit(50000, 30000), true);
  assert.equal(isRealSplit(50000, 0), false);
  assert.equal(isRealSplit(50000, 50000), false);
  assert.equal(isRealSplit(50000, 90000), false);
});

test('customer names match whatever the spacing or case', () => {
  assert.equal(customerNameKey('  Ravi   Stores '), 'ravi stores');
  assert.equal(customerNameKey('RAVI stores'), customerNameKey('ravi  Stores'));
  assert.equal(tidyCustomerName('  Ravi   Stores '), 'Ravi Stores');
  assert.equal(customerIdFromName('Ravi Stores'), customerIdFromName(' ravi   stores'));
  assert.notEqual(customerIdFromName('Ravi'), customerIdFromName('Ravi Stores'));
});

test('customer ids are valid Firestore document ids, including for Tamil names and awkward characters', () => {
  for (const name of ['ரவி கடை', 'a/b', '.', '..', '__x__', 'Ravi & Sons (Main)']) {
    const id = customerIdFromName(name);
    assert.ok(id.length > 0 && id.length <= 300, name);
    assert.ok(!id.includes('/'), name + ' has a slash');
    assert.ok(id !== '.' && id !== '..', name);
  }
});

test('paymentProblem refuses zero and overpayment, accepts anything up to the balance', () => {
  assert.equal(paymentProblem(5000, 20000), null);
  assert.equal(paymentProblem(20000, 20000), null); // paying it all off
  assert.equal(paymentProblem(0, 20000), 'zero');
  assert.equal(paymentProblem(-1, 20000), 'zero');
  assert.equal(paymentProblem(1.5, 20000), 'zero');
  assert.equal(paymentProblem(20001, 20000), 'tooMuch');
});

test('typing in the GPay box is the GPay half; typing in the cash box leaves GPay as the rest', () => {
  assert.equal(upiFromTyped(50000, 'upi', 30000), 30000);
  assert.equal(upiFromTyped(50000, 'cash', 30000), 20000);
  assert.equal(upiFromTyped(50000, 'cash', 0), 50000); // nothing in cash: all GPay, which is not a real split
  assert.equal(upiFromTyped(50000, 'upi', 90000), 50000); // more than the bill is held inside it
  assert.equal(upiFromTyped(50000, 'cash', 90000), 0);
});

test('every typed split is whole paise that add up to the bill', () => {
  for (const side of ['upi', 'cash'] as const) {
    for (const typed of [0, 100, 12345, 49999, 50000, 50001]) {
      const upi = upiFromTyped(50000, side, typed);
      const { cashMinor } = splitPayment(50000, upi);
      assert.ok(Number.isInteger(upi) && upi >= 0 && cashMinor >= 0);
      assert.equal(upi + cashMinor, 50000);
    }
  }
});

test('the credit customer list narrows to names containing what was typed', () => {
  const people = ['Ravi Stores', 'Ravindran', 'Mohan'].map((name) => ({ name, nameKey: customerNameKey(name) }));
  assert.deepEqual(filterCustomersByName(people, 'rav').map((p) => p.name), ['Ravi Stores', 'Ravindran']);
  // Capitals and runs of spaces do not matter, the same as when a returning customer is matched.
  assert.deepEqual(filterCustomersByName(people, '  RAVI  s').map((p) => p.name), ['Ravi Stores']);
  assert.equal(filterCustomersByName(people, '   ').length, 3);
  assert.equal(filterCustomersByName(people, 'zzz').length, 0);
});

test('equal packs tapped one after another stay packs: 250 g twice is 2 × 250 g, not 500 g', () => {
  const pack = (grams: number): OrderLineInput => ({ ...chicken, grams, packGrams: grams, packs: 1 });
  let lines: CartLine[] = [];
  lines = addLine(lines, pack(250));
  lines = addLine(lines, pack(250));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].grams, 500);
  assert.equal(lines[0].packs, 2);
  assert.equal(describeLine(lines[0], 'en'), '2 × 250 g = 500 g × ₹240.00/kg');
  assert.equal(formatLineQuantity(lines[0], 'en'), '2 × 250 g');
  assert.equal(formatLineQuantity(lines[0]), '2 × 250 கிராம்');
  assert.equal(orderLineTotalMinor(lines[0]), 12000); // the same price as one 500 g line
  // A different pack size is its own line.
  lines = addLine(lines, pack(500));
  assert.equal(lines.length, 2);
  // A third 250 g joins the first line.
  lines = addLine(lines, pack(250));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].packs, 3);
  assert.equal(formatLineQuantity(lines[0], 'en'), '3 × 250 g');
});

test('weights tapped without packs add up, and never mix with packs', () => {
  let lines: CartLine[] = [];
  lines = addLine(lines, { ...chicken, grams: 250 });
  lines = addLine(lines, { ...chicken, grams: 250 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].grams, 500);
  assert.equal(lines[0].packs, undefined);
  assert.equal(formatLineQuantity(lines[0], 'en'), '500 g');
  lines = addLine(lines, { ...chicken, grams: 250, packGrams: 250, packs: 1 });
  assert.equal(lines.length, 2);
  // One pack on its own reads as a plain weight.
  assert.equal(formatLineQuantity(lines[1], 'en'), '250 g');
});
