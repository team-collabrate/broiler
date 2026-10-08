import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, formatWeight, isValidKgInput, lineTotalMinor, parseKgInput } from './money.ts';

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

test('parseKgInput converts kilos to whole grams', () => {
  assert.equal(parseKgInput('1'), 1000);
  assert.equal(parseKgInput('1.25'), 1250);
  assert.equal(parseKgInput('0.5'), 500);
  assert.equal(parseKgInput('.5'), 500);
  assert.equal(parseKgInput('2.'), 2000);
  assert.equal(parseKgInput('0.001'), 1);
  assert.equal(parseKgInput('999.999'), 999999);
});

test('parseKgInput rejects empty, zero and malformed entries', () => {
  for (const bad of ['', '.', '0', '0.', '0.000', '1.2345', '1234', '1.2.3', 'abc', '-1']) {
    assert.equal(parseKgInput(bad), null, `expected null for "${bad}"`);
  }
});

test('isValidKgInput accepts partial entries while typing', () => {
  for (const ok of ['', '1', '12', '123', '1.', '1.2', '1.234', '.']) assert.equal(isValidKgInput(ok), true, ok);
  for (const bad of ['1234', '1.2345', '1..2', 'x']) assert.equal(isValidKgInput(bad), false, bad);
});
