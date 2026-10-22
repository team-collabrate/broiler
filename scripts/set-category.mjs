// Moves a menu item to another tab (category): for example quail from Chicken to Others.
//
//   node --env-file=shop/worker-app/.env scripts/set-category.mjs kadai other
//
// Categories: chicken, other, mutton. The managing PIN is asked for without echo (or read from OWNER_PIN when there is
// no terminal). Only that one field of that one item changes; rates and everything else stay as they are.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../shop/shared/src/core/roles.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const [itemId, category] = process.argv.slice(2);
if (!itemId || !['chicken', 'other', 'mutton'].includes(category)) {
  console.error('Usage: node --env-file=shop/worker-app/.env scripts/set-category.mjs <item id> <chicken|other|mutton>');
  process.exit(1);
}

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only

const pin = await askPin('Managing (owner) PIN', 'OWNER_PIN');
try {
  await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(pin));
  const ref = doc(db, 'menu', itemId);
  const before = await getDoc(ref);
  if (!before.exists()) throw new Error(`There is no menu item "${itemId}".`);
  await updateDoc(ref, { category });
  console.log(`${itemId}: category ${before.data().category ?? '(none)'} -> ${category}. Reopen the counter to see it.`);
  await signOut(auth);
} catch (e) {
  console.error(`Not changed: ${e.code ?? e.message}`);
  process.exitCode = 1;
}
// Let open connections close by themselves: exiting at once can trip a libuv assertion on Windows.
setTimeout(() => process.exit(), 3000).unref();
