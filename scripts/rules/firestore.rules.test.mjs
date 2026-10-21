// Tests for firestore.rules, run against the local Firestore emulator with the real rules file.
//
//   npm run test:rules        (starts its own emulator, runs these, stops it; needs Java: see scripts/lib/java-env.mjs)
//   node --test scripts/rules/firestore.rules.test.mjs   (when `npm run emulators` is already running)
//
// Each test says what a person at the counter or the owner may or may not do. A rule that is too loose loses money
// quietly (a balance that can be edited, a bill that can be backdated), so most tests are about what must be refused.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

// A refused write is the expected result of most tests here; the library logs each one as an error, which is only noise.
setLogLevel('silent');

const rules = readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'firestore.rules'), 'utf8');
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-broiler', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

// --- who is asking ----------------------------------------------------------------------------------------------------
const signedIn = (email, provider = 'password') => env.authenticatedContext(`uid-${email ?? provider}`, { ...(email && { email }), firebase: { sign_in_provider: provider } }).firestore();
const owner = () => signedIn('owner@broiler-pos.invalid');
const counter = () => signedIn('counter@broiler-pos.invalid');
const anonymous = () => signedIn(undefined, 'anonymous');
const stranger = () => signedIn('someone@example.com');
const nobody = () => env.unauthenticatedContext().firestore();
/** Writes data directly, bypassing the rules, to set a scene. */
const seed = async (fn) => {
  let result;
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await fn(ctx.firestore());
  });
  return result;
};

// --- documents ----------------------------------------------------------------------------------------------------------
const line = (over = {}) => ({ itemId: 'naatu', name: 'Naatukoli', category: 'chicken', unit: 'kg', rateMinor: 24000, listRateMinor: 24000, grams: 1000, qty: 0, lineTotalMinor: 24000, ...over });
const order = (over = {}, lines = [line()]) => ({
  orderNo: 1,
  dayKey: '2026-10-21',
  device: 'A',
  soldAt: Timestamp.now(),
  createdAt: serverTimestamp(),
  lines,
  totalMinor: lines.reduce((s, l) => s + l.lineTotalMinor, 0),
  totalGrams: lines.reduce((s, l) => s + l.grams, 0),
  totalPieces: lines.reduce((s, l) => s + l.qty, 0),
  paymentMethod: 'cash',
  ...over,
});
const creditOrder = (customerId, over = {}, lines = [line()]) => order({ paymentMethod: 'credit', customerId, customerName: 'Ravi Stores', ...over }, lines);
const hoursAgo = (h) => Timestamp.fromMillis(Date.now() - h * 3600 * 1000);

const customer = (over = {}) => ({ name: 'Ravi Stores', nameKey: 'ravi stores', balanceMinor: 24000, lastOrderId: 'o0', createdAt: hoursAgo(5), updatedAt: hoursAgo(5), ...over });
const seedCustomer = (over = {}, id = 'ravi%20stores') => seed((db) => setDoc(doc(db, 'customers', id), customer(over)));
const CID = 'ravi%20stores';

/** A credit bill saved the way the till does it: the order and the customer's new balance, in one transaction. */
const creditSale = (db, { orderId = 'o1', total = 24000, existingBalance = null, over = {}, customerOver = {} } = {}) =>
  runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, 'customers', CID));
    const orderData = creditOrder(CID, over, [line({ lineTotalMinor: total, rateMinor: total, listRateMinor: total, grams: 1000 })]);
    if (snap.exists()) tx.update(doc(db, 'customers', CID), { balanceMinor: (existingBalance ?? snap.data().balanceMinor) + total, lastOrderId: orderId, updatedAt: serverTimestamp(), ...customerOver });
    else tx.set(doc(db, 'customers', CID), { name: 'Ravi Stores', nameKey: 'ravi stores', balanceMinor: total, lastOrderId: orderId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...customerOver });
    tx.set(doc(db, 'orders', orderId), orderData);
  });

/** A payment taken the way the till does it: the receipt and the lowered balance, in one transaction. */
const takePayment = (db, { paymentId = 'p1', amount = 10000, balanceAfter = null, receiptOver = {} } = {}) =>
  runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, 'customers', CID));
    tx.update(doc(db, 'customers', CID), { balanceMinor: balanceAfter ?? snap.data().balanceMinor - amount, lastPaymentId: paymentId, updatedAt: serverTimestamp() });
    tx.set(doc(db, 'customerPayments', paymentId), { customerId: CID, customerName: 'Ravi Stores', amountMinor: amount, method: 'cash', dayKey: '2026-10-21', createdAt: serverTimestamp(), ...receiptOver });
  });

describe('who may do anything at all', () => {
  test('a signed-out visitor, an anonymous session and a stranger with the public key get nothing', async () => {
    for (const db of [nobody(), anonymous(), stranger()]) {
      await assertFails(getDocs(query(collection(db, 'menu'), limit(1))));
      await assertFails(setDoc(doc(db, 'orders', 'x'), order()));
      await assertFails(getDocs(collection(db, 'customers')));
    }
  });
});

describe('menu and settings', () => {
  test('the counter reads the menu and settings but cannot change a rate or a setting', async () => {
    await seed((db) => setDoc(doc(db, 'menu', 'naatu'), { rateMinor: 24000 }));
    await assertSucceeds(getDocs(query(collection(counter(), 'menu'), limit(1))));
    await assertFails(updateDoc(doc(counter(), 'menu', 'naatu'), { rateMinor: 1 }));
    await assertFails(setDoc(doc(counter(), 'settings', 'pricing'), { maxAdjustMinor: 100000 }));
    await assertSucceeds(getDoc(doc(counter(), 'settings', 'pricing')));
  });
  test('the owner changes rates and the adjustment limit, within sensible bounds', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'menu', 'naatu'), { rateMinor: 25000 }));
    await assertFails(setDoc(doc(owner(), 'menu', 'bad'), { rateMinor: 0 }));
    await assertSucceeds(setDoc(doc(owner(), 'settings', 'pricing'), { maxAdjustMinor: 2000 }));
    await assertFails(setDoc(doc(owner(), 'settings', 'pricing'), { maxAdjustMinor: 9999999 }));
  });
});

describe('orders', () => {
  test('the counter saves a correct order, and the owner can too', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order()));
    await assertSucceeds(setDoc(doc(owner(), 'orders', 'b'), order({ orderNo: 2 })));
  });
  test('the counter saves an order the way a queued sale arrives: one batch with the day\'s counter note', async () => {
    const db = counter();
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', 'a'), order());
    batch.set(doc(db, 'counters', '2026-10-21_A'), { next: 2 });
    await assertSucceeds(batch.commit());
  });
  test('orders are append-only: nobody edits or deletes one, and the counter cannot list them', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), { ...order(), createdAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(counter(), 'orders', 'a'), { paymentMethod: 'upi' }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'a'), { paymentMethod: 'upi' }));
    await assertFails(deleteDoc(doc(owner(), 'orders', 'a')));
    await assertFails(getDocs(query(collection(counter(), 'orders'), limit(1))));
    await assertSucceeds(getDocs(query(collection(owner(), 'orders'), limit(1))));
  });
  test('the counter can look up an order it just saved (a safe retry) but not an old one', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'orders', 'recent'), { ...order(), createdAt: hoursAgo(1) });
      await setDoc(doc(db, 'orders', 'old'), { ...order(), createdAt: hoursAgo(3) });
    });
    await assertSucceeds(getDoc(doc(counter(), 'orders', 'recent')));
    await assertFails(getDoc(doc(counter(), 'orders', 'old')));
    await assertSucceeds(getDoc(doc(counter(), 'orders', 'never-saved'))); // a missing one may be asked for
  });
  test('the total must be the sum of the lines, and a bill must have lines', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ totalMinor: 100 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), order({ totalMinor: 24001 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({ lines: [], totalMinor: 0, totalGrams: 0 })));
  });
  test('a rate may move from the list rate only within the owner\'s limit', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({}, [line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), order({}, [line({ rateMinor: 99000, lineTotalMinor: 99000 })])));
    await seed((db) => setDoc(doc(db, 'settings', 'pricing'), { maxAdjustMinor: 0 }));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({}, [line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
  });
  test('a line needs a positive rate, a whole non-negative total and a known unit', async () => {
    const withLine = (over) => setDoc(doc(counter(), 'orders', 'x'), order({}, [line(over)]));
    await assertFails(withLine({ rateMinor: 0, listRateMinor: 0, lineTotalMinor: 0 })); // a free item
    await assertFails(withLine({ lineTotalMinor: -24000 })); // a negative line cannot offset another
    await assertFails(withLine({ lineTotalMinor: 24000.5 }));
    await assertFails(withLine({ unit: 'litre' }));
  });
  test('piece lines and fixed-amount lines are accepted like any other', async () => {
    const piece = line({ unit: 'piece', grams: 0, qty: 3, rateMinor: 6000, listRateMinor: 6000, lineTotalMinor: 18000 });
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({}, [piece])));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'b'), order({}, [line({ amountMinor: 10000, lineTotalMinor: 10000, grams: 417 })])));
  });
  test('an order with an unknown extra field is refused', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ discountMinor: 5000 })));
  });
});

describe('the most an order can hold', () => {
  // Each request may evaluate at most 1000 expressions, so the rules cap a bill at 10 lines (MAX_ORDER_LINES in
  // shop/shared/src/core/sale.ts). This is the test that notices if a change to the rules makes 10 lines too costly.
  const many = (n) => Array.from({ length: n }, (_, i) => line({ itemId: `item${i}` }));
  test('10 lines are accepted for every way of paying, and 11 are refused', async () => {
    const ten = many(10);
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'cash'), order({}, ten)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'upi'), order({ paymentMethod: 'upi' }, ten)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'split'), order({ paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 230000 }, ten)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'credit'), creditOrder(CID, {}, ten)));
    await assertFails(setDoc(doc(counter(), 'orders', 'eleven'), order({}, many(11))));
  });
});

describe('selling offline: the time and counter letter on a bill', () => {
  test('the sale time is the tablet\'s, accepted when recent: a sale from 2 days ago that only now arrives is fine', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({ soldAt: hoursAgo(48) })));
  });
  test('a sale dated more than 3 days ago is refused', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ soldAt: hoursAgo(24 * 4) })));
  });
  test('a sale dated in the future is refused, a few minutes of clock drift is not', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ soldAt: Timestamp.fromMillis(Date.now() + 3600 * 1000) })));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'b'), order({ soldAt: Timestamp.fromMillis(Date.now() + 60 * 1000) })));
  });
  test('the server time of arrival cannot be faked: createdAt must be the server\'s own clock', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ createdAt: new Date(2000, 0, 1) })));
  });
  test('a bill with no sale time, no counter letter or a bad one is refused', async () => {
    const { soldAt, ...noSoldAt } = order();
    const { device, ...noDevice } = order();
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), noSoldAt));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), noDevice));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({ device: 'ab' })));
    await assertFails(setDoc(doc(counter(), 'orders', 'd'), order({ device: 'a' })));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'e'), order({ device: 'B' })));
  });
});

describe('split payment (GPay + cash)', () => {
  test('a split whose two halves add up to the total is accepted', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({ paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 14000 })));
  });
  test('a split whose halves do not add up, or with nothing on one side, is refused', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 10000 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), order({ paymentMethod: 'split', cashAmountMinor: 0, upiAmountMinor: 24000 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({ paymentMethod: 'split', cashAmountMinor: 24000, upiAmountMinor: 0 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'd'), order({ paymentMethod: 'split' })));
  });
  test('only a split carries halves', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ paymentMethod: 'cash', cashAmountMinor: 24000 })));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), order({ paymentMethod: 'upi', upiAmountMinor: 24000 })));
  });
});

describe('credit bills (கடன்)', () => {
  test('a new customer is created with the credit bill, and their balance is exactly that bill', async () => {
    await assertSucceeds(creditSale(counter()));
    const saved = await seed((db) => getDoc(doc(db, 'customers', CID)));
    assert(saved.exists() && saved.data().balanceMinor === 24000);
  });
  test('a returning customer\'s balance goes up by exactly the new bill', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertSucceeds(creditSale(counter(), { orderId: 'o2', total: 24000 }));
    const saved = await seed((db) => getDoc(doc(db, 'customers', CID)));
    assert.equal(saved.data().balanceMinor, 74000);
  });
  test('a balance that rises by more or less than the bill is refused', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(creditSale(counter(), { orderId: 'o2', total: 24000, existingBalance: 50000 + 1 })); // 1 paise too many
    await assertFails(creditSale(counter(), { orderId: 'o3', total: 24000, existingBalance: 50000 - 24000 })); // balance lowered by a credit bill
  });
  test('a new customer whose starting balance is not the bill is refused', async () => {
    await assertFails(creditSale(counter(), { customerOver: { balanceMinor: 1 } }));
  });
  test('a balance cannot be changed with no bill or receipt behind it', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(updateDoc(doc(counter(), 'customers', CID), { balanceMinor: 0, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(counter(), 'customers', CID), { balanceMinor: 1, lastOrderId: 'nothing', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(owner(), 'customers', CID), { balanceMinor: 0, updatedAt: serverTimestamp() }));
  });
  test('an old bill cannot be replayed to raise a balance again', async () => {
    await seedCustomer({ balanceMinor: 24000 });
    await seed((db) => setDoc(doc(db, 'orders', 'old'), { ...creditOrder(CID), createdAt: hoursAgo(5) }));
    await assertFails(updateDoc(doc(counter(), 'customers', CID), { balanceMinor: 48000, lastOrderId: 'old', updatedAt: serverTimestamp() }));
  });
  test('a credit bill must name a customer, and the customer must be the one on the bill', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ paymentMethod: 'credit' })));
    await assertFails(creditSale(counter(), { over: { customerId: 'someone-else' } }));
  });
  test('only a credit bill names a customer', async () => {
    await assertFails(setDoc(doc(counter(), 'orders', 'a'), order({ customerId: CID, customerName: 'Ravi Stores' })));
  });
  test('a customer\'s name cannot be changed and a customer cannot be deleted', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(creditSale(counter(), { customerOver: { name: 'Someone Else' } }));
    await assertFails(deleteDoc(doc(counter(), 'customers', CID)));
    await assertFails(deleteDoc(doc(owner(), 'customers', CID)));
  });
  test('the counter and the owner can read the customers; a stranger cannot', async () => {
    await seedCustomer();
    await assertSucceeds(getDocs(collection(counter(), 'customers')));
    await assertSucceeds(getDocs(collection(owner(), 'customers')));
    await assertFails(getDocs(collection(stranger(), 'customers')));
  });
});

describe('taking a payment against a balance (the credit book)', () => {
  test('a payment lowers the balance by exactly the receipt', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertSucceeds(takePayment(counter(), { amount: 20000 }));
    const saved = await seed((db) => getDoc(doc(db, 'customers', CID)));
    assert.equal(saved.data().balanceMinor, 30000);
  });
  test('paying the whole balance leaves exactly zero', async () => {
    await seedCustomer({ balanceMinor: 8658 }); // a bill with paise
    await assertSucceeds(takePayment(counter(), { amount: 8658 }));
  });
  test('paying more than is owed is refused, so a balance can never go below zero', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(takePayment(counter(), { amount: 60000 }));
  });
  test('a balance that falls by more or less than the receipt is refused', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(takePayment(counter(), { amount: 20000, balanceAfter: 10000 })); // took 40000 off for a 20000 receipt
    await assertFails(takePayment(counter(), { paymentId: 'p2', amount: 20000, balanceAfter: 40000 })); // took 10000 off
  });
  test('a receipt must be positive, whole paise, and paid in cash or GPay', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertFails(takePayment(counter(), { amount: 0, balanceAfter: 50000 }));
    await assertFails(takePayment(counter(), { paymentId: 'p3', amount: 100, receiptOver: { method: 'cheque' } }));
    await assertFails(takePayment(counter(), { paymentId: 'p4', amount: 100, receiptOver: { note: 'extra' } }));
    await assertSucceeds(takePayment(counter(), { paymentId: 'p5', amount: 100, receiptOver: { method: 'upi' } }));
  });
  test('receipts are read by the owner only, and are never edited or deleted', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertSucceeds(takePayment(counter(), { amount: 20000 }));
    await assertFails(getDoc(doc(counter(), 'customerPayments', 'p1')));
    await assertSucceeds(getDoc(doc(owner(), 'customerPayments', 'p1')));
    await assertFails(updateDoc(doc(owner(), 'customerPayments', 'p1'), { amountMinor: 1 }));
    await assertFails(deleteDoc(doc(owner(), 'customerPayments', 'p1')));
  });
  test('a retry is recognised by the customer\'s own note of the last receipt, which the counter may read', async () => {
    await seedCustomer({ balanceMinor: 50000 });
    await assertSucceeds(takePayment(counter(), { amount: 20000 }));
    const snap = await assertSucceeds(getDoc(doc(counter(), 'customers', CID)));
    assert.equal(snap.data().lastPaymentId, 'p1');
  });
});

describe('the day\'s bill counter note', () => {
  test('staff write and read it, in the "<day>_<letter>" form, as just { next }', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'counters', '2026-10-21_A'), { next: 5 }));
    await assertSucceeds(getDoc(doc(counter(), 'counters', '2026-10-21_A')));
    await assertFails(setDoc(doc(counter(), 'counters', '2026-10-21_A'), { next: 0 }));
    await assertFails(setDoc(doc(counter(), 'counters', '2026-10-21_A'), { next: 5, extra: true }));
    await assertFails(setDoc(doc(stranger(), 'counters', '2026-10-21_A'), { next: 5 }));
  });
});
