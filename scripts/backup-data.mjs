// Read-only: copies every collection of the live database into one JSON file under backups/ and prints what is in it.
// Nothing is changed or deleted. Run it before any clean-up.
//
//   node --env-file=apps/pos/.env scripts/backup-data.mjs
//
// The managing PIN is asked for without echo (or read from OWNER_PIN when there is no terminal).
import { mkdirSync, writeFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, Timestamp } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../packages/shared/src/roles.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only

/** Timestamps become ISO text so the file is readable. */
const plain = (value) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
};

const COLLECTIONS = ['menu', 'orders', 'customers', 'customerPayments', 'dailySummaries', 'counters'];
const SETTINGS = ['pricing', 'categories'];

try {
  await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(await askPin('Managing (owner) PIN', 'OWNER_PIN')));
  const backup = { takenAt: new Date().toISOString(), project: firebaseConfig().projectId, collections: {}, settings: {} };
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    backup.collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]));
  }
  for (const id of SETTINGS) {
    const snap = await getDoc(doc(db, 'settings', id));
    backup.settings[id] = snap.exists() ? plain(snap.data()) : null;
  }
  mkdirSync('backups', { recursive: true });
  const file = `backups/firestore-${backup.takenAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));

  console.log(`Backup written: ${file}`);
  for (const name of COLLECTIONS) console.log(`  ${name}: ${Object.keys(backup.collections[name]).length}`);
  console.log(`  settings: ${SETTINGS.filter((id) => backup.settings[id]).join(', ') || '(none)'}`);

  const orders = Object.values(backup.collections.orders);
  const days = {};
  for (const o of orders) days[o.dayKey] = (days[o.dayKey] ?? 0) + 1;
  console.log('Bills per day:', JSON.stringify(days));
  console.log('Voided bills:', orders.filter((o) => o.status === 'voided').length);
  console.log('Customers:', Object.values(backup.collections.customers).map((c) => `${c.name} (balance ${c.balanceMinor / 100})`).join(', ') || '(none)');
  console.log('Daily summaries:', Object.keys(backup.collections.dailySummaries).join(', ') || '(none)');
  await signOut(auth);
} catch (e) {
  console.error(`Backup failed: ${e.code ?? e.message}`);
  process.exitCode = 1;
}
setTimeout(() => process.exit(), 3000).unref();
