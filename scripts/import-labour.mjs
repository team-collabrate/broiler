// Loads the labour salary sheets into the salary book (workers and their day entries).
//
//   node --env-file=shop/worker-app/.env scripts/import-labour.mjs <labour.json>            (shows what it would do)
//   node --env-file=shop/worker-app/.env scripts/import-labour.mjs <labour.json> --write    (writes it)
//
// <labour.json> is made from "Labour salary account.xlsx": { workers: [{ name, dayWage, opening, sheetFinal, entries: [{ dayKey,
// kind, earned, paid, advance, note }] }] }, money in paise. Every worker and entry gets a fixed id (`import-<n>`), so running it
// again rewrites the same documents instead of adding more. For each worker it prints the balance the app will show beside the
// balance the sheet ended on, so a difference is seen before anything is trusted. The managing PIN is asked for without echo.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, writeBatch } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../shop/shared/src/core/roles.ts';
import { labourBalance } from '../shop/shared/src/core/labour.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node --env-file=shop/worker-app/.env scripts/import-labour.mjs <labour.json> [--write]');
  process.exit(1);
}
const write = flag === '--write';
const { workers } = JSON.parse(readFileSync(file, 'utf8'));

const rupees = (minor) => (minor / 100).toFixed(2).padStart(10);
console.log('worker        entries   app balance   sheet balance');
for (const w of workers) {
  const balance = labourBalance(w.opening, w.entries.map((e) => ({ earnedMinor: e.earned, paidMinor: e.paid, advanceMinor: e.advance })));
  console.log(`${w.name.padEnd(12)} ${String(w.entries.length).padStart(7)} ${rupees(balance)} ${rupees(w.sheetFinal)}  ${balance === w.sheetFinal ? 'same' : 'DIFFERENT'}`);
}
if (!write) {
  console.log('\nNothing written (add --write to write it).');
  process.exit(0);
}

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only

const pin = await askPin('Managing (owner) PIN', 'OWNER_PIN');
try {
  await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(pin));
  let written = 0;
  for (const [n, w] of workers.entries()) {
    const labourerId = `import-${n + 1}`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'labourers', labourerId), { name: w.name, dayWageMinor: w.dayWage, openingMinor: w.opening, active: true });
    w.entries.forEach((e, i) => {
      batch.set(doc(db, 'labourEntries', `${labourerId}-${String(i + 1).padStart(3, '0')}`), {
        labourerId,
        dayKey: e.dayKey,
        kind: e.kind,
        earnedMinor: e.earned,
        paidMinor: e.paid,
        advanceMinor: e.advance,
        ...(e.note && { note: e.note.slice(0, 120) }),
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
    written += 1 + w.entries.length;
  }
  console.log(`\nWritten: ${written} documents.`);
  await signOut(auth);
} catch (e) {
  console.error(`Not written: ${e.code ?? e.message}`);
  process.exitCode = 1;
}
setTimeout(() => process.exit(), 3000).unref();
