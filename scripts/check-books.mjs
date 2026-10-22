// Reconciles a day's money from the raw records, independently of the app, and exits with an error if anything does not
// add up. Run it after a test or trial day:
//
//   node --env-file=shop/worker-app/.env scripts/check-books.mjs [YYYY-MM-DD]
//
// It checks, as the owner:
//   - every order: its lines add up to its total, a split's two halves add up to the total, a credit bill names a customer
//   - every customer: the balance equals all their credit bills minus all the payments taken (all days)
//   - the day's money: cash and GPay collected (sales, split halves and credit payments), credit given, and what is owed
// The owner PIN is asked for without echo (or read from OWNER_PIN when there is no terminal). The day defaults to today.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../shop/shared/src/core/roles.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only
await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(await askPin('Owner PIN', 'OWNER_PIN')));

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = process.argv[2] ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const money = (minor) => `₹${(minor / 100).toFixed(2)}`.padStart(12);

const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

const docs = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const dayOrders = await docs(query(collection(db, 'orders'), where('dayKey', '==', day)));
const dayPayments = await docs(query(collection(db, 'customerPayments'), where('dayKey', '==', day)));
const allCredit = await docs(query(collection(db, 'orders'), where('paymentMethod', '==', 'credit')));
const allPayments = await docs(collection(db, 'customerPayments'));
const customers = await docs(collection(db, 'customers'));

// --- every order is internally consistent -----------------------------------------------------------------------------
for (const o of dayOrders) {
  const label = `bill ${o.device ?? '?'}${o.orderNo} (${o.id})`;
  const linesTotal = (o.lines ?? []).reduce((sum, l) => sum + l.lineTotalMinor, 0);
  check(linesTotal === o.totalMinor, `${label}: lines add up to ${money(linesTotal)} but the total says ${money(o.totalMinor)}`);
  if (o.paymentMethod === 'split') {
    check(Number.isInteger(o.upiAmountMinor) && Number.isInteger(o.cashAmountMinor), `${label}: a split bill is missing a half`);
    check(o.upiAmountMinor + o.cashAmountMinor === o.totalMinor, `${label}: the split halves ${money(o.cashAmountMinor)} + ${money(o.upiAmountMinor)} do not add up to ${money(o.totalMinor)}`);
    check(o.upiAmountMinor > 0 && o.cashAmountMinor > 0, `${label}: a split bill has nothing on one side`);
  } else {
    check(o.upiAmountMinor === undefined && o.cashAmountMinor === undefined, `${label}: only a split bill should have halves`);
  }
  if (o.paymentMethod === 'credit') check(Boolean(o.customerId && o.customerName), `${label}: a credit bill has no customer`);
}

// --- every customer's balance is what their bills and payments say ----------------------------------------------------
for (const c of customers) {
  const owed = allCredit.filter((o) => o.customerId === c.id).reduce((sum, o) => sum + o.totalMinor, 0);
  const paid = allPayments.filter((p) => p.customerId === c.id).reduce((sum, p) => sum + p.amountMinor, 0);
  check(c.balanceMinor === owed - paid, `customer ${c.name}: balance ${money(c.balanceMinor)} but bills ${money(owed)} − payments ${money(paid)} = ${money(owed - paid)}`);
  check(c.balanceMinor >= 0, `customer ${c.name}: balance is below zero (${money(c.balanceMinor)})`);
}

// --- the day's money ---------------------------------------------------------------------------------------------------
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
const by = (method) => dayOrders.filter((o) => o.paymentMethod === method);
const sales = sum(dayOrders, (o) => o.totalMinor);
const cashSales = sum(by('cash'), (o) => o.totalMinor);
const upiSales = sum(by('upi'), (o) => o.totalMinor);
const cardSales = sum(by('card'), (o) => o.totalMinor);
const splitCash = sum(by('split'), (o) => o.cashAmountMinor ?? 0);
const splitUpi = sum(by('split'), (o) => o.upiAmountMinor ?? 0);
const creditGiven = sum(by('credit'), (o) => o.totalMinor);
const cashReceipts = sum(dayPayments.filter((p) => p.method === 'cash'), (p) => p.amountMinor);
const upiReceipts = sum(dayPayments.filter((p) => p.method === 'upi'), (p) => p.amountMinor);

check(sales === cashSales + upiSales + cardSales + splitCash + splitUpi + creditGiven, 'the day\'s sales do not equal the sum of how they were paid');

const row = (label, minor, note = '') => console.log(`  ${label.padEnd(34)}${money(minor)}  ${note}`);
console.log(`\nDay ${day}: ${dayOrders.length} bills, ${dayPayments.length} credit payments\n`);
row('Sales (all bills)', sales);
row('  paid in cash', cashSales);
row('  paid by GPay/UPI', upiSales);
if (cardSales) row('  paid by card', cardSales);
row('  split: cash halves', splitCash);
row('  split: GPay halves', splitUpi);
row('  on credit (kadan)', creditGiven, 'not collected');
console.log('');
row('Credit payments: cash', cashReceipts);
row('Credit payments: GPay/UPI', upiReceipts);
console.log('');
row('CASH collected', cashSales + splitCash + cashReceipts, 'sales + split halves + credit payments');
row('GPay/UPI collected', upiSales + splitUpi + upiReceipts, 'sales + split halves + credit payments');
row('Credit given today', creditGiven);
row('Owed by customers now', sum(customers, (c) => c.balanceMinor), `${customers.filter((c) => c.balanceMinor > 0).length} customers`);

console.log('');
if (problems.length === 0) console.log('ALL CHECKS PASSED: every bill, every balance and the day\'s money add up.\n');
else {
  console.log(`${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log('');
}
process.exit(problems.length === 0 ? 0 : 1);
