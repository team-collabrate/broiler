// Lists a day's orders as the owner and reports duplicate or missing bill numbers for each counter, with the time each
// sale was made and the time the server received it. Used to reconcile a test or trial day.
//
//   node --env-file=apps/pos/.env scripts/check-bills.mjs [YYYY-MM-DD]
//
// The owner PIN is asked for without echo (or read from OWNER_PIN when there is no terminal). The day defaults to today.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../packages/shared/src/roles.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only
await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(await askPin('Owner PIN', 'OWNER_PIN')));

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const today = process.argv[2] ?? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const snap = await getDocs(query(collection(db, 'orders'), where('dayKey', '==', today)));
const rows = snap.docs.map((s) => ({ id: s.id, ...s.data() }));
rows.sort((a, b) => (a.device ?? '').localeCompare(b.device ?? '') || a.orderNo - b.orderNo);
for (const r of rows) {
  const sold = r.soldAt?.toDate?.().toLocaleTimeString('en-GB') ?? '-';
  const made = r.createdAt?.toDate?.().toLocaleTimeString('en-GB') ?? '-';
  const label = `${r.dayKey.slice(8)}-${r.dayKey.slice(5, 7)}/${r.device && r.device !== 'A' ? r.device : ''}${r.orderNo}`;
  console.log(`${label.padEnd(10)} ${r.paymentMethod.padEnd(6)} ₹${(r.totalMinor / 100).toFixed(2).padStart(8)}  ${(r.staffName ?? '-').padEnd(9)} sold ${sold}  arrived ${made}  ${r.id}`);
}
const byDevice = new Map();
for (const r of rows) byDevice.set(r.device ?? '?', [...(byDevice.get(r.device ?? '?') ?? []), r.orderNo]);
for (const [device, numbers] of byDevice) {
  const seen = new Set();
  const dupes = numbers.filter((n) => seen.size === seen.add(n).size);
  const missing = [];
  for (let n = Math.min(...numbers); n <= Math.max(...numbers); n += 1) if (!seen.has(n)) missing.push(n);
  console.log(`counter ${device}: ${numbers.length} orders, numbers ${Math.min(...numbers)}..${Math.max(...numbers)}, duplicates [${dupes}], missing [${missing}]`);
}
if (rows.length === 0) console.log(`no orders for ${today}`);
const counters = await getDocs(collection(db, 'counters'));
console.log('counters:', counters.docs.map((c) => `${c.id}=${c.data().next}`).join('  '));
process.exit(0);
