// Changes the PIN of the owner (managing) or counter (billing) account. The current PIN is needed: it signs in, then the new
// PIN replaces it.
//
//   node --env-file=shop/worker-app/.env scripts/change-pin.mjs owner
//   node --env-file=shop/worker-app/.env scripts/change-pin.mjs counter
//
// Both PINs are asked for without echo (or read from OLD_PIN and NEW_PIN when there is no terminal). The PIN is the
// account's password ("broiler-<PIN>", see shop/shared/src/core/roles.ts), so this changes it in Firebase Authentication.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { isValidPin, pinPassword, ROLE_EMAILS } from '../shop/shared/src/core/roles.ts';
import { connectEmulators, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const role = process.argv[2];
if (role !== 'owner' && role !== 'counter') {
  console.error('Say which account: owner or counter.');
  process.exit(1);
}

const app = initializeApp(withEmulatorConfig(firebaseConfig()));
const auth = getAuth(app);
connectEmulators(auth); // USE_EMULATOR=1 only

const oldPin = await askPin(`Current ${role} PIN`, 'OLD_PIN');
const newPin = await askPin(`New ${role} PIN (4-6 digits)`, 'NEW_PIN');
if (!isValidPin(newPin)) {
  console.error('The new PIN must be 4 to 6 digits.');
  process.exit(1);
}

try {
  const { user } = await signInWithEmailAndPassword(auth, ROLE_EMAILS[role], pinPassword(oldPin));
  await updatePassword(user, pinPassword(newPin));
  await signOut(auth);
  // The new PIN signs in; the old one no longer does.
  await signInWithEmailAndPassword(auth, ROLE_EMAILS[role], pinPassword(newPin));
  await signOut(auth);
  console.log(`${role}: PIN changed (${ROLE_EMAILS[role]}). The new PIN signs in.`);
} catch (e) {
  console.error(`${role}: could not change the PIN (${e.code ?? e.message}). Nothing was changed if the current PIN was wrong.`);
  process.exitCode = 1;
}
// Let open connections close by themselves: exiting at once can trip a libuv assertion on Windows.
setTimeout(() => process.exit(), 3000).unref();
