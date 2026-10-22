import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDaysToKey, daysInclusive, dayKey, firstKeptDay, keyToDate, monthStartKey, periodRange, rangeFor, splitByWindow, startOfDay, weekStartKey } from './dateRange.ts';

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

test('days as keys: add days across months and years, list a range', () => {
  assert.deepEqual(keyToDate('2026-10-08'), new Date(2026, 9, 8));
  assert.equal(addDaysToKey('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysToKey('2026-01-01', -1), '2025-12-31');
  assert.equal(addDaysToKey('2028-02-28', 1), '2028-02-29');
  assert.deepEqual(daysInclusive('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(daysInclusive('2026-10-08', '2026-10-08'), ['2026-10-08']);
  assert.deepEqual(daysInclusive('2026-10-09', '2026-10-08'), []);
});

test('full bills are kept for today and the 3 days before it', () => {
  assert.equal(firstKeptDay(afternoon), '2026-10-05');
  assert.equal(firstKeptDay(new Date(2026, 0, 2, 9)), '2025-12-30');
});

test('the week starts on Monday and the month on the 1st', () => {
  assert.equal(weekStartKey(new Date(2026, 9, 8)), '2026-10-05'); // a Thursday
  assert.equal(weekStartKey(new Date(2026, 9, 5)), '2026-10-05'); // the Monday itself
  assert.equal(weekStartKey(new Date(2026, 9, 11)), '2026-10-05'); // a Sunday
  assert.equal(monthStartKey(afternoon), '2026-10-01');
});

test('report periods cover the right days', () => {
  assert.deepEqual(periodRange({ kind: 'today' }, afternoon), { fromKey: '2026-10-08', toKey: '2026-10-08' });
  assert.deepEqual(periodRange({ kind: 'yesterday' }, afternoon), { fromKey: '2026-10-07', toKey: '2026-10-07' });
  assert.deepEqual(periodRange({ kind: 'last7' }, afternoon), { fromKey: '2026-10-02', toKey: '2026-10-08' });
  assert.deepEqual(periodRange({ kind: 'month' }, afternoon), { fromKey: '2026-10-01', toKey: '2026-10-08' });
  assert.deepEqual(periodRange({ kind: 'date', date: '2026-09-20' }, afternoon), { fromKey: '2026-09-20', toKey: '2026-09-20' });
});

test('a range splits into recent days (full bills) and older days (saved totals)', () => {
  // On 8 Oct the full bills held are 5, 6, 7 and 8 Oct.
  assert.deepEqual(splitByWindow({ fromKey: '2026-10-08', toKey: '2026-10-08' }, afternoon), { live: { fromKey: '2026-10-08', toKey: '2026-10-08' }, archived: null });
  assert.deepEqual(splitByWindow({ fromKey: '2026-10-01', toKey: '2026-10-08' }, afternoon), {
    live: { fromKey: '2026-10-05', toKey: '2026-10-08' },
    archived: { fromKey: '2026-10-01', toKey: '2026-10-04' },
  });
  assert.deepEqual(splitByWindow({ fromKey: '2026-09-20', toKey: '2026-09-20' }, afternoon), { live: null, archived: { fromKey: '2026-09-20', toKey: '2026-09-20' } });
  assert.deepEqual(splitByWindow({ fromKey: '2026-10-05', toKey: '2026-10-05' }, afternoon), { live: { fromKey: '2026-10-05', toKey: '2026-10-05' }, archived: null });
  assert.deepEqual(splitByWindow({ fromKey: '2026-10-04', toKey: '2026-10-04' }, afternoon), { live: null, archived: { fromKey: '2026-10-04', toKey: '2026-10-04' } });
});
