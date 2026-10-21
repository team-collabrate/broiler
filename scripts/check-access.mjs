// Checks the live access rules with the real accounts. Run it after `npm run seed:users` and after
// the rules are deployed, in your own terminal:
//
//   npm run check:access
//
// It signs in as the counter and as the owner (PINs typed at a hidden prompt) and tries things each
// should and should not be allowed to do, then prints PASS or FAIL for each. It saves exactly one
// small test order (to prove the till can save), so afterwards run `npm run reset-demo`.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../packages/shared/src/roles.ts';
import { customerIdFromName } from '../packages/shared/src/sale.ts';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const app = initializeApp(firebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);

let failures = 0;
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
};
const allowed = async (name, fn) => {
  try {
    await fn();
    record(name, true);
  } catch (e) {
    record(name, false, e.code ?? e.message);
  }
};
const denied = async (name, fn) => {
  try {
    await fn();
    record(name, false, 'it was allowed');
  } catch (e) {
    record(name, e.code === 'permission-denied', e.code ?? e.message);
  }
};

const line = (over = {}) => ({
  itemId: 'access-check',
  name: 'Access check',
  category: 'more',
  unit: 'kg',
  rateMinor: 24000,
  listRateMinor: 24000,
  grams: 1000,
  qty: 0,
  lineTotalMinor: 24000,
  ...over,
});
const order = (lines, over = {}) => ({
  orderNo: 1,
  dayKey: '2000-01-01',
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
const save = (id, data) => runTransaction(db, async (tx) => {
  await tx.get(doc(db, 'orders', id));
  tx.set(doc(db, 'orders', id), data);
});
const newId = () => doc(collection(db, 'orders')).id;

// ---- Anyone who is not the owner or the counter -------------------------------------------
console.log('\nAn account that is neither owner nor counter (anonymous):');
try {
  await signInAnonymously(auth);
  await denied('cannot read the menu', () => getDocs(query(collection(db, 'menu'), limit(1))));
  await denied('cannot save an order', () => save(newId(), order([line()])));
  await signOut(auth);
} catch (e) {
  console.log(`SKIP  anonymous sign-in is turned off (${e.code}), which is the intended final setting`);
}

// ---- Counter -------------------------------------------------------------------------------
console.log('\nCounter:');
const counterPin = await askPin('Counter PIN', 'COUNTER_PIN');
await signInWithEmailAndPassword(auth, ROLE_EMAILS.counter, pinPassword(counterPin));
await allowed('can read the menu', () => getDocs(query(collection(db, 'menu'), limit(1))));
await denied('cannot list orders', () => getDocs(query(collection(db, 'orders'), limit(1))));
await denied('cannot change a rate', async () => {
  const first = (await getDocs(query(collection(db, 'menu'), limit(1)))).docs[0];
  await updateDoc(first.ref, { rateMinor: 1 });
});
await denied('cannot change settings', () => setDoc(doc(db, 'settings', 'pricing'), { maxAdjustMinor: 100000 }));
await denied('cannot save an order whose total does not match its lines', () =>
  save(newId(), order([line()], { totalMinor: 100 })));
await denied('cannot save a rate beyond the adjustment limit', () =>
  save(newId(), order([line({ rateMinor: 99000, lineTotalMinor: 99000 })])));
await denied('cannot save a line priced wrongly for its weight', () =>
  save(newId(), order([line({ lineTotalMinor: 1 })])));
await denied('cannot save an order with a backdated time', () =>
  save(newId(), order([line()], { createdAt: new Date(2000, 0, 1) })));

// ---- selling with no internet: the sale is queued on the tablet and arrives later ----------------------------------
const hoursAgo = (h) => Timestamp.fromMillis(Date.now() - h * 3600 * 1000);
await allowed('can save an order the way the tablet queues it (a batch, with the counter note)', () => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'orders', newId()), order([line()]));
  batch.set(doc(db, 'counters', '2000-01-01_A'), { next: 2 });
  return batch.commit();
});
await allowed('can save a sale that was made 2 days ago and only now arrives (an outage)', () =>
  save(newId(), order([line()], { soldAt: hoursAgo(48) })));
await denied('cannot save a sale dated more than 3 days ago', () =>
  save(newId(), order([line()], { soldAt: hoursAgo(24 * 4) })));
await denied('cannot save a sale dated in the future', () =>
  save(newId(), order([line()], { soldAt: Timestamp.fromMillis(Date.now() + 3600 * 1000) })));
await denied('cannot save an order with no sale time', () => {
  const { soldAt, ...rest } = order([line()]);
  return save(newId(), rest);
});
await denied('cannot save an order with a counter letter that is not one capital letter', () =>
  save(newId(), order([line()], { device: 'ab' })));
const testId = newId();
await allowed('can save a correct order', () => save(testId, order([line()])));
await allowed('can look the same order up again by its id (a safe retry)', () => getDoc(doc(db, 'orders', testId)));
await allowed('can save a correctly adjusted order (within the limit)', () =>
  save(newId(), order([line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
await denied('cannot edit an order', () => updateDoc(doc(db, 'orders', testId), { paymentMethod: 'upi' }));

// ---- split and credit (கடன்) ----------------------------------------------------------------
console.log('\nCounter, split and credit:');
await allowed('can save a split bill whose halves add up to the total', () =>
  save(newId(), order([line()], { paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 14000 })));
await denied('cannot save a split whose halves do not add up', () =>
  save(newId(), order([line()], { paymentMethod: 'split', cashAmountMinor: 10000, upiAmountMinor: 10000 })));
await denied('cannot save a split with nothing on one side', () =>
  save(newId(), order([line()], { paymentMethod: 'split', cashAmountMinor: 0, upiAmountMinor: 24000 })));
await denied('cannot put split amounts on a cash bill', () =>
  save(newId(), order([line()], { cashAmountMinor: 10000, upiAmountMinor: 14000 })));
await denied('cannot save a credit bill with nobody on it', () =>
  save(newId(), order([line()], { paymentMethod: 'credit' })));

const debtor = 'Check Access Debtor';
const debtorId = customerIdFromName(debtor);
const customerRef = doc(db, 'customers', debtorId);
// A credit bill: the order and the customer's balance, in one transaction, as the till does it.
const creditSale = (id, total) => runTransaction(db, async (tx) => {
  const snap = await tx.get(customerRef);
  const l = line({ rateMinor: total, listRateMinor: total, grams: 1000, lineTotalMinor: total });
  tx.set(doc(db, 'orders', id), order([l], { paymentMethod: 'credit', customerId: debtorId, customerName: debtor }));
  if (snap.exists()) {
    tx.update(customerRef, { balanceMinor: snap.data().balanceMinor + total, lastOrderId: id, updatedAt: serverTimestamp() });
  } else {
    tx.set(customerRef, { name: debtor, nameKey: debtor.toLowerCase(), balanceMinor: total, lastOrderId: id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
});
const payment = (id, amount, newBalance) => runTransaction(db, async (tx) => {
  tx.update(customerRef, { balanceMinor: newBalance, lastPaymentId: id, updatedAt: serverTimestamp() });
  tx.set(doc(db, 'customerPayments', id), { customerId: debtorId, customerName: debtor, amountMinor: amount, method: 'cash', dayKey: '2000-01-01', createdAt: serverTimestamp() });
});
await allowed('can sell on credit to a new customer (order and balance together)', () => creditSale(newId(), 24000));
await allowed('can sell on credit to the same customer again', () => creditSale(newId(), 12000));
await denied('cannot change a balance with no order behind it', () => updateDoc(customerRef, { balanceMinor: 1, lastOrderId: 'nothing', updatedAt: serverTimestamp() }));
await denied('cannot raise a balance by more than the credit order was for', () => runTransaction(db, async (tx) => {
  const id = newId();
  const snap = await tx.get(customerRef);
  tx.set(doc(db, 'orders', id), order([line({ rateMinor: 5000, listRateMinor: 5000, lineTotalMinor: 5000 })], { paymentMethod: 'credit', customerId: debtorId, customerName: debtor }));
  tx.update(customerRef, { balanceMinor: snap.data().balanceMinor + 999999, lastOrderId: id, updatedAt: serverTimestamp() });
}));
await denied('cannot delete a customer', () => deleteDoc(customerRef));
await denied('cannot record a payment bigger than the balance', async () => {
  const bal = (await getDoc(customerRef)).data().balanceMinor;
  await payment(newId(), bal + 1, bal - (bal + 1));
});
await denied('cannot lower a balance by more than the receipt says', async () => {
  const bal = (await getDoc(customerRef)).data().balanceMinor;
  await payment(newId(), 1000, bal - 5000);
});
await allowed('can record a correct payment (receipt and balance together)', async () => {
  const bal = (await getDoc(customerRef)).data().balanceMinor;
  await payment(newId(), 1000, bal - 1000);
});
await allowed('can see who owes (the counter picks a customer)', () => getDocs(query(collection(db, 'customers'), limit(5))));
await denied('cannot read the payment receipts', () => getDocs(query(collection(db, 'customerPayments'), limit(1))));
await signOut(auth);

// ---- Owner ---------------------------------------------------------------------------------
console.log('\nOwner:');
const ownerPin = await askPin('Owner PIN', 'OWNER_PIN');
await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(ownerPin));
await allowed('can list orders', () => getDocs(query(collection(db, 'orders'), limit(1))));
await allowed('can confirm a rate (unchanged)', async () => {
  const first = (await getDocs(query(collection(db, 'menu'), limit(1)))).docs[0];
  await updateDoc(first.ref, { rateMinor: first.data().rateMinor });
});
await denied('cannot edit an order either (orders are append-only)', () => updateDoc(doc(db, 'orders', testId), { paymentMethod: 'upi' }));
await allowed('can set the price-adjustment limit', () => setDoc(doc(db, 'settings', 'pricing'), { maxAdjustMinor: 2000 }));
await allowed('can read the payment receipts', () => getDocs(query(collection(db, 'customerPayments'), limit(1))));
await denied('cannot edit a payment receipt', async () => {
  const first = (await getDocs(query(collection(db, 'customerPayments'), limit(1)))).docs[0];
  await updateDoc(first.ref, { amountMinor: 1 });
});
await signOut(auth);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
console.log('Remember: npm run reset-demo removes the test orders this saved. Also delete the customer "Check Access Debtor" and its payments in the Firebase console (Firestore > customers, customerPayments).');
process.exit(failures === 0 ? 0 : 1);
