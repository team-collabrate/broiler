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
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../packages/shared/src/roles.ts';
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
const testId = newId();
await allowed('can save a correct order', () => save(testId, order([line()])));
await allowed('can look the same order up again by its id (a safe retry)', () => getDoc(doc(db, 'orders', testId)));
await allowed('can save a correctly adjusted order (within the limit)', () =>
  save(newId(), order([line({ rateMinor: 23500, lineTotalMinor: 23500 })])));
await denied('cannot edit an order', () => updateDoc(doc(db, 'orders', testId), { paymentMethod: 'upi' }));
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
await signOut(auth);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
console.log('Remember: npm run reset-demo removes the test orders this saved.');
process.exit(failures === 0 ? 0 : 1);
