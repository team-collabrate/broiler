// Creates the two accounts the apps sign in with: the owner and the counter. Each account's
// password is its PIN. Run it once, in your own terminal, and choose the PINs yourself:
//
//   npm run seed:users
//
// The PINs are typed at a hidden prompt (4 to 6 digits; a 6-digit owner PIN is recommended). Nothing
// is saved anywhere except as the Firebase accounts' passwords. Needs Email/Password sign-in turned
// on in the Firebase project (firebase deploy --only auth does that).
//
// To change a PIN later: delete that user in the Firebase console (Authentication > Users) and
// run this again. The script skips an account that already exists and never overwrites it.
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { isValidPin, pinPassword, ROLE_EMAILS } from '../packages/shared/src/roles.ts';
import { askPin, firebaseConfig } from './lib/pins.mjs';

const app = initializeApp(firebaseConfig());
const auth = getAuth(app);

const roles = [
  { role: 'owner', label: 'Owner PIN (4-6 digits)', env: 'OWNER_PIN' },
  { role: 'counter', label: 'Counter PIN (4-6 digits)', env: 'COUNTER_PIN' },
];

let failed = false;
for (const { role, label, env } of roles) {
  const pin = await askPin(label, env);
  if (!isValidPin(pin)) {
    console.error(`${role}: the PIN must be 4 to 6 digits. Skipped.`);
    failed = true;
    continue;
  }
  try {
    await createUserWithEmailAndPassword(auth, ROLE_EMAILS[role], pinPassword(pin));
    await signOut(auth);
    console.log(`${role}: account created (${ROLE_EMAILS[role]})`);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log(`${role}: already exists, left unchanged. To change its PIN, delete the user in the Firebase console and run this again.`);
    } else {
      console.error(`${role}: failed (${e.code ?? e.message})`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
