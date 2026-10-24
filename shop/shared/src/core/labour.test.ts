import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKeyFromSheetDate, daysWorkedSince, earnedFor, labourBalance, labourEntryProblem } from './labour.ts';

test('labour: a day earns the wage, nothing on leave, twice on a double day, and a typed amount for a trip', () => {
  assert.equal(earnedFor('work', 65000), 65000);
  assert.equal(earnedFor('leave', 65000), 0);
  assert.equal(earnedFor('double', 65000), 130000);
  assert.equal(earnedFor('vehicle', 65000, 160000), 160000);
  assert.equal(earnedFor('other', 65000, 12000), 12000);
});

test('labour: the balance is opening + earned - paid - advance (the sheet running balance)', () => {
  // Ganeshan from the sheet: advance 500 on the 13th, then days with part paid.
  const days = [
    { earnedMinor: 65000, paidMinor: 65000, advanceMinor: 0 },
    { earnedMinor: 65000, paidMinor: 65000, advanceMinor: 50000 },
    { earnedMinor: 90000, paidMinor: 80000, advanceMinor: 0 },
    { earnedMinor: 65000, paidMinor: 55000, advanceMinor: 0 },
  ];
  assert.equal(labourBalance(0, days.slice(0, 2)), -50000);
  assert.equal(labourBalance(0, days), -30000);
  assert.equal(labourBalance(340000, []), 340000); // an opening amount alone
  assert.equal(labourBalance(0, []), 0);
});

test('labour: an entry needs whole, non-negative amounts, and something in it unless it is leave', () => {
  const ok = { kind: 'work', earnedMinor: 65000, paidMinor: 0, advanceMinor: 0 } as const;
  assert.equal(labourEntryProblem(ok), null);
  assert.equal(labourEntryProblem({ ...ok, kind: 'leave', earnedMinor: 0 }), null);
  assert.equal(labourEntryProblem({ ...ok, earnedMinor: 0 }), 'empty');
  assert.equal(labourEntryProblem({ ...ok, paidMinor: -1 }), 'amount');
  assert.equal(labourEntryProblem({ ...ok, advanceMinor: 1.5 }), 'amount');
  assert.equal(labourEntryProblem({ ...ok, kind: 'holiday' as never }), 'kind');
});

test('labour: days worked counts each day with earnings once, from a date on', () => {
  const e = [
    { dayKey: '2026-10-20', earnedMinor: 1 },
    { dayKey: '2026-10-21', earnedMinor: 0 },
    { dayKey: '2026-10-22', earnedMinor: 5 },
    { dayKey: '2026-10-22', earnedMinor: 5 },
    { dayKey: '2026-10-23', earnedMinor: 5 },
  ];
  assert.equal(daysWorkedSince(e, '2026-10-21'), 2);
  assert.equal(daysWorkedSince(e, '2026-10-01'), 3);
});

test('labour: a sheet date 12.10.26 is the day 2026-10-12, and a bad one is refused', () => {
  assert.equal(dayKeyFromSheetDate('12.10.26'), '2026-10-12');
  assert.equal(dayKeyFromSheetDate('5.10.26'), '2026-10-05');
  assert.equal(dayKeyFromSheetDate('20.20.26'), null);
  assert.equal(dayKeyFromSheetDate('hello'), null);
});
