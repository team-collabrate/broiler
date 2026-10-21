import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, rangeFor, startOfDay } from './dateRange.ts';

const afternoon = new Date(2026, 9, 8, 15, 30); // 8 Oct 2026, local time

test('dayKey is the local calendar date, zero padded', () => {
  assert.equal(dayKey(afternoon), '2026-10-08');
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
});

test('today spans local midnight to the next midnight', () => {
  const r = rangeFor('today', afternoon);
  assert.deepEqual(r.start, new Date(2026, 9, 8));
  assert.deepEqual(r.end, new Date(2026, 9, 9));
});

test('yesterday ends where today starts', () => {
  const r = rangeFor('yesterday', afternoon);
  assert.deepEqual(r.start, new Date(2026, 9, 7));
  assert.deepEqual(r.end, rangeFor('today', afternoon).start);
});

test('last7 covers today and the six days before it', () => {
  const r = rangeFor('last7', afternoon);
  assert.deepEqual(r.start, new Date(2026, 9, 2));
  assert.deepEqual(r.end, new Date(2026, 9, 9));
});

test('ranges roll over month and year ends', () => {
  const newYear = new Date(2027, 0, 1, 10, 0);
  assert.deepEqual(rangeFor('yesterday', newYear).start, new Date(2026, 11, 31));
  assert.deepEqual(rangeFor('last7', newYear).start, new Date(2026, 11, 26));
  assert.deepEqual(startOfDay(newYear), new Date(2027, 0, 1));
});
