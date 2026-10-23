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
  test('the counter can look up an order it saved in the last 24 hours (a safe retry, or deleting its own bill) but not an old one', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'orders', 'recent'), { ...order(), createdAt: hoursAgo(1) });
      await setDoc(doc(db, 'orders', 'old'), { ...order(), createdAt: hoursAgo(30) });
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
  test('a bill may be rounded to the nearest ten rupees, and only that way', async () => {
    const lines = (total) => [line({ rateMinor: total, listRateMinor: total, lineTotalMinor: total })];
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'r1'), order({ totalMinor: 24000, roundOffMinor: -350 }, lines(24350)))); // ₹243.50 down to ₹240
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'r2'), order({ totalMinor: 25000, roundOffMinor: 400 }, lines(24600)))); // ₹246 up to ₹250
    await assertFails(setDoc(doc(counter(), 'orders', 'r3'), order({ totalMinor: 24000, roundOffMinor: -300 }, lines(24350)))); // does not add up
    await assertFails(setDoc(doc(counter(), 'orders', 'r4'), order({ totalMinor: 24300, roundOffMinor: -50 }, lines(24350)))); // not a whole ten rupees
    await assertFails(setDoc(doc(counter(), 'orders', 'r5'), order({ totalMinor: 25000, roundOffMinor: 1000 }, lines(24000)))); // moved by more than half a step
    await assertFails(setDoc(doc(counter(), 'orders', 'r6'), order({ totalMinor: 24000, roundOffMinor: -350.5 }, lines(24350.5)))); // not whole paise
    await assertFails(setDoc(doc(counter(), 'orders', 'r7'), order({ totalMinor: 24350, roundOffMinor: 0 }, lines(24350)))); // a round-off still has to land on ten rupees
  });
  test('a flat discount comes off the lines\' sum, stays under the bill, and can go with a round-off', async () => {
    const lines = (total) => [line({ rateMinor: total, listRateMinor: total, lineTotalMinor: total })];
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'd1'), order({ totalMinor: 22000, discountMinor: 2000 }, lines(24000)))); // ₹240 less ₹20
    await assertSucceeds(setDoc(doc(owner(), 'orders', 'd2'), order({ totalMinor: 22000, discountMinor: 2000 }, lines(24000)))); // the owner too
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'd3'), order({ totalMinor: 22000, discountMinor: 2000, roundOffMinor: -350 }, lines(24350)))); // ₹243.50 less ₹20 is ₹223.50, rounded down to ₹220
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'd4'), order({ totalMinor: 22000, discountMinor: 2000, roundOffMinor: -150 }, lines(24150)))); // ₹241.50 − ₹20 = ₹221.50, down to ₹220
    await assertFails(setDoc(doc(counter(), 'orders', 'd5'), order({ totalMinor: 24000, discountMinor: 2000 }, lines(24000)))); // total ignores the discount
    await assertFails(setDoc(doc(counter(), 'orders', 'd6'), order({ totalMinor: 0, discountMinor: 24000 }, lines(24000)))); // a free bill
    await assertFails(setDoc(doc(counter(), 'orders', 'd7'), order({ totalMinor: 24000, discountMinor: 0 }, lines(24000)))); // a zero discount is just no discount
    await assertFails(setDoc(doc(counter(), 'orders', 'd8'), order({ totalMinor: 26000, discountMinor: -2000 }, lines(24000)))); // a negative discount raises the bill
    await assertFails(setDoc(doc(counter(), 'orders', 'd9'), order({ totalMinor: 23999.5, discountMinor: 0.5 }, lines(24000)))); // not whole paise
  });
  test('a rate may move from the list rate only within the owner\'s limit', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({}, [line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
    await assertFails(setDoc(doc(counter(), 'orders', 'b'), order({}, [line({ rateMinor: 99000, lineTotalMinor: 99000 })])));
    await seed((db) => setDoc(doc(db, 'settings', 'pricing'), { maxAdjustMinor: 0 }));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({}, [line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
  });
  test('a line must be priced by its own weight or count (or be exactly the amount it was billed for)', async () => {
    let n = 0; // a fresh order id each time: an order cannot be written twice
    const withLine = (over) => setDoc(doc(counter(), 'orders', `priced-${n++}`), order({}, [line(over)]));
    await assertFails(withLine({ lineTotalMinor: 1 })); // priced wrongly for its weight
    await assertFails(withLine({ grams: 500 })); // 500 g is not ₹240.00 at ₹240/kg
    await assertFails(withLine({ qty: 2 })); // a weight line has no count
    await assertFails(withLine({ unit: 'piece', grams: 50, qty: 3, rateMinor: 6000, listRateMinor: 6000, lineTotalMinor: 18000 })); // a count line has no weight
    await assertFails(withLine({ unit: 'piece', grams: 0, qty: 3, rateMinor: 6000, listRateMinor: 6000, lineTotalMinor: 17000 }));
    await assertFails(withLine({ amountMinor: 10000, lineTotalMinor: 9000, grams: 417 })); // billed for ₹100 but totalled ₹90
    await assertSucceeds(withLine({ amountMinor: 10000, lineTotalMinor: 10000, grams: 417 }));
    await assertSucceeds(withLine({ grams: 1250, lineTotalMinor: 30000 })); // 1.25 kg at ₹240
  });
  test('the bill can say which worker was billing, up to 40 letters', async () => {
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'a'), order({ staffName: 'Worker A' })));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'b'), order({ staffName: 'Worker B' })));
    await assertFails(setDoc(doc(counter(), 'orders', 'c'), order({ staffName: '' })));
    await assertFails(setDoc(doc(counter(), 'orders', 'd'), order({ staffName: 'x'.repeat(41) })));
    await assertFails(setDoc(doc(counter(), 'orders', 'e'), order({ staffName: 7 })));
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
  // Each request may evaluate at most 1000 expressions, so the rules cap a bill at 5 lines (MAX_ORDER_LINES in
  // shop/shared/src/core/sale.ts). This is the test that notices if a change to the rules makes 5 lines too costly.
  const many = (n) => Array.from({ length: n }, (_, i) => line({ itemId: `item${i}` }));
  test('5 lines are accepted for every way of paying, and 6 are refused', async () => {
    const five = many(5);
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'cash'), order({}, five)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'upi'), order({ paymentMethod: 'upi', staffName: 'Worker A' }, five)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'split'), order({ paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 110000, staffName: 'Worker B' }, five)));
    await assertSucceeds(setDoc(doc(counter(), 'orders', 'credit'), creditOrder(CID, { staffName: 'Worker A' }, five)));
    await assertFails(setDoc(doc(counter(), 'orders', 'six'), order({}, many(6))));
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

// --- deleting (voiding) a bill, removing old bills, and the daily totals ---------------------------------------------------
const OWNER_UID = 'uid-owner@broiler-pos.invalid';
const COUNTER_UID = 'uid-counter@broiler-pos.invalid';
const voidFields = (uid) => ({ status: 'voided', voidedAt: serverTimestamp(), voidedBy: uid });
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * 24 * 3600 * 1000);
const summary = (over = {}) => ({
  dayKey: '2026-10-15',
  orderCount: 3,
  totalMinor: 72000,
  cashMinor: 48000,
  upiMinor: 24000,
  creditMinor: 0,
  totalGrams: 3000,
  totalPieces: 0,
  items: { naatu: { name: 'Naatukoli', category: 'chicken', unit: 'kg', grams: 3000, qty: 0, totalMinor: 72000 } },
  categories: { chicken: 72000 },
  createdAt: serverTimestamp(),
  ...over,
});
const seedSummary = (day = '2026-10-21') => seed((db) => setDoc(doc(db, 'dailySummaries', day), { ...summary({ dayKey: day }), createdAt: Timestamp.now() }));

/** Deletes a credit bill the way the apps do: the bill marked voided and the customer's lowered balance, in one transaction. */
const voidCredit = (db, uid, { orderId = 'o1', total = 24000, balanceAfter = null, orderOver = {}, customerOver = {} } = {}) =>
  runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, 'customers', CID));
    tx.update(doc(db, 'customers', CID), { balanceMinor: balanceAfter ?? snap.data().balanceMinor - total, lastVoidedOrderId: orderId, updatedAt: serverTimestamp(), ...customerOver });
    tx.update(doc(db, 'orders', orderId), { ...voidFields(uid), ...orderOver });
  });
const seedCreditBill = async ({ balance = 24000, createdAt = hoursAgo(1) } = {}) => {
  await seed(async (db) => {
    await setDoc(doc(db, 'customers', CID), customer({ balanceMinor: balance, lastOrderId: 'o1' }));
    await setDoc(doc(db, 'orders', 'o1'), { ...creditOrder(CID), createdAt, soldAt: createdAt });
  });
};

describe('deleting (voiding) a bill', () => {
  test('the owner can void any bill, and the counter a bill made in the last 24 hours', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'orders', 'new'), { ...order(), createdAt: hoursAgo(1) });
      await setDoc(doc(db, 'orders', 'older'), { ...order(), createdAt: hoursAgo(30) });
    });
    await assertSucceeds(updateDoc(doc(counter(), 'orders', 'new'), voidFields(COUNTER_UID)));
    await assertSucceeds(updateDoc(doc(owner(), 'orders', 'older'), voidFields(OWNER_UID)));
    const voided = await seed((db) => getDoc(doc(db, 'orders', 'new')));
    assert.equal(voided.data().status, 'voided');
    assert.equal(voided.data().totalMinor, 24000); // the money fields are untouched
  });
  test('the counter cannot void a bill older than 24 hours', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'older'), { ...order(), createdAt: hoursAgo(30) }));
    await assertFails(updateDoc(doc(counter(), 'orders', 'older'), voidFields(COUNTER_UID)));
  });
  test('a void changes only the three void fields, with the server time and the caller\'s own id', async () => {
    await seed(async (db) => {
      for (const id of ['a', 'b', 'c', 'd', 'e']) await setDoc(doc(db, 'orders', id), { ...order(), createdAt: hoursAgo(1) });
    });
    await assertFails(updateDoc(doc(owner(), 'orders', 'a'), { ...voidFields(OWNER_UID), totalMinor: 1 }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'b'), { ...voidFields(OWNER_UID), voidedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'c'), { ...voidFields(OWNER_UID), voidedBy: 'someone-else' }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'd'), { ...voidFields(OWNER_UID), status: 'active' }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'e'), { status: 'voided' })); // no time, no name
  });
  test('a voided bill cannot be voided again or edited', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), { ...order(), createdAt: hoursAgo(1), status: 'voided', voidedAt: Timestamp.now(), voidedBy: OWNER_UID }));
    await assertFails(updateDoc(doc(owner(), 'orders', 'a'), voidFields(OWNER_UID)));
    await assertFails(updateDoc(doc(owner(), 'orders', 'a'), { paymentMethod: 'upi' }));
  });
  test('a stranger, an anonymous session and a signed-out visitor cannot void', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), { ...order(), createdAt: hoursAgo(1) }));
    for (const db of [stranger(), anonymous(), nobody()]) await assertFails(updateDoc(doc(db, 'orders', 'a'), voidFields('x')));
  });
  test('a bill cannot be created already voided', async () => {
    await assertFails(setDoc(doc(owner(), 'orders', 'a'), { ...order(), ...voidFields(OWNER_UID) }));
  });
  test('once a day\'s totals are saved its bills can no longer be voided', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), { ...order(), createdAt: hoursAgo(1) }));
    await seedSummary('2026-10-21');
    await assertFails(updateDoc(doc(owner(), 'orders', 'a'), voidFields(OWNER_UID)));
  });
});

describe('deleting (voiding) a credit bill gives the balance back', () => {
  test('the bill and the customer\'s balance change together: the balance falls by exactly the bill', async () => {
    await seedCreditBill({ balance: 50000 });
    await assertSucceeds(voidCredit(counter(), COUNTER_UID, { total: 24000 }));
    const after = await seed((db) => getDoc(doc(db, 'customers', CID)));
    assert.equal(after.data().balanceMinor, 26000);
    assert.equal(after.data().lastVoidedOrderId, 'o1');
  });
  test('the owner can do it too, and a customer who owes exactly the bill ends at zero', async () => {
    await seedCreditBill({ balance: 24000 });
    await assertSucceeds(voidCredit(owner(), OWNER_UID));
    const after = await seed((db) => getDoc(doc(db, 'customers', CID)));
    assert.equal(after.data().balanceMinor, 0);
  });
  test('voiding a credit bill without giving the balance back is refused', async () => {
    await seedCreditBill();
    await assertFails(updateDoc(doc(owner(), 'orders', 'o1'), voidFields(OWNER_UID)));
  });
  test('a balance that falls by more or less than the bill is refused', async () => {
    await seedCreditBill({ balance: 50000 });
    await assertFails(voidCredit(owner(), OWNER_UID, { balanceAfter: 20000 }));
    await assertFails(voidCredit(owner(), OWNER_UID, { balanceAfter: 30000 }));
    await assertFails(voidCredit(owner(), OWNER_UID, { balanceAfter: 50000 }));
  });
  test('a balance cannot go below zero: a customer who has already paid part of the bill off blocks the void', async () => {
    await seedCreditBill({ balance: 10000 });
    await assertFails(voidCredit(owner(), OWNER_UID));
  });
  test('a balance cannot be lowered "for a void" when the bill was not voided, or was not a credit bill', async () => {
    await seedCreditBill({ balance: 50000 });
    await seed((db) => setDoc(doc(db, 'orders', 'cash1'), { ...order(), createdAt: hoursAgo(1) }));
    await assertFails(updateDoc(doc(owner(), 'customers', CID), { balanceMinor: 26000, lastVoidedOrderId: 'o1', updatedAt: serverTimestamp() }));
    const db = owner();
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.update(doc(db, 'customers', CID), { balanceMinor: 26000, lastVoidedOrderId: 'cash1', updatedAt: serverTimestamp() });
        tx.update(doc(db, 'orders', 'cash1'), voidFields(OWNER_UID));
      }),
    );
  });
  test('a void cannot lower another customer\'s balance', async () => {
    await seedCreditBill({ balance: 50000 });
    await seed((db) => setDoc(doc(db, 'customers', 'other'), customer({ name: 'Other', nameKey: 'other', balanceMinor: 50000, lastOrderId: 'x' })));
    const db = owner();
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.update(doc(db, 'customers', 'other'), { balanceMinor: 26000, lastVoidedOrderId: 'o1', updatedAt: serverTimestamp() });
        tx.update(doc(db, 'orders', 'o1'), voidFields(OWNER_UID));
      }),
    );
  });
});

describe('removing old bills (after their day is summed up)', () => {
  const oldOrder = (over = {}) => ({ ...order({ dayKey: '2026-10-15' }), soldAt: daysAgo(5), createdAt: daysAgo(5), ...over });
  test('the owner removes a bill sold more than 3 days ago once that day\'s totals exist', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), oldOrder()));
    await seedSummary('2026-10-15');
    await assertSucceeds(deleteDoc(doc(owner(), 'orders', 'a')));
  });
  test('but not before the day\'s totals are saved', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), oldOrder()));
    await assertFails(deleteDoc(doc(owner(), 'orders', 'a')));
  });
  test('and not a recent bill, even with totals saved', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), oldOrder({ soldAt: daysAgo(2), createdAt: daysAgo(2) })));
    await seedSummary('2026-10-15');
    await assertFails(deleteDoc(doc(owner(), 'orders', 'a')));
  });
  test('the counter can never remove a bill', async () => {
    await seed((db) => setDoc(doc(db, 'orders', 'a'), oldOrder()));
    await seedSummary('2026-10-15');
    await assertFails(deleteDoc(doc(counter(), 'orders', 'a')));
  });
});

describe('daily totals (dailySummaries)', () => {
  test('the owner saves a day\'s totals once and reads them back; the counter can do neither', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary()));
    await assertSucceeds(getDoc(doc(owner(), 'dailySummaries', '2026-10-15')));
    await assertFails(getDoc(doc(counter(), 'dailySummaries', '2026-10-15')));
    await assertFails(setDoc(doc(counter(), 'dailySummaries', '2026-10-16'), summary({ dayKey: '2026-10-16' })));
    await assertFails(getDocs(collection(counter(), 'dailySummaries')));
  });
  test('a day\'s totals are never changed or removed', async () => {
    await seedSummary('2026-10-15');
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ totalMinor: 1 })));
    await assertFails(updateDoc(doc(owner(), 'dailySummaries', '2026-10-15'), { totalMinor: 1 }));
    await assertFails(deleteDoc(doc(owner(), 'dailySummaries', '2026-10-15')));
  });
  test('the document id is the day, and the figures are whole, non-negative and complete', async () => {
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ dayKey: '2026-10-14' })));
    await assertFails(setDoc(doc(owner(), 'dailySummaries', 'today'), summary({ dayKey: 'today' })));
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ totalMinor: -5 })));
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ totalMinor: 10.5 })));
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ extra: 1 })));
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), summary({ createdAt: Timestamp.now() })));
    const { items: _items, ...noItems } = summary();
    await assertFails(setDoc(doc(owner(), 'dailySummaries', '2026-10-15'), noItems));
  });
});
