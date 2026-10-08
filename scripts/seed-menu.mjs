// Adds a starter menu to Firestore. Items that already exist keep their prices and other
// edits; the only thing added to an existing item is a default weight it doesn't have yet.
//
//   node --env-file=apps/pos/.env scripts/seed-menu.mjs
//
// Needs Anonymous sign-in enabled in the Firebase console and rules that allow
// signed-in menu writes (see firestore.rules). Prices below are sample values.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';

const env = process.env;
const config = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId || !config.appId) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_* values. Copy apps/pos/.env.example to apps/pos/.env and fill it in.');
  process.exit(1);
}

// pricePerKgMinor is in paise: 24000 = ₹240.00 per kg.
// defaultGrams is the usual sale weight, where the POS sale panel starts: 1000 = 1 kg.
const MENU = [
  { id: 'broiler-with-skin', name: 'Broiler chicken (with skin)', pricePerKgMinor: 24000, defaultGrams: 1000 },
  { id: 'broiler-skinless', name: 'Broiler chicken (skinless)', pricePerKgMinor: 26000, defaultGrams: 500 },
  { id: 'chicken-boneless', name: 'Chicken boneless', pricePerKgMinor: 32000, defaultGrams: 500 },
  { id: 'country-chicken', name: 'Country chicken', pricePerKgMinor: 45000, defaultGrams: 1000 },
  { id: 'chicken-liver', name: 'Chicken liver', pricePerKgMinor: 20000, defaultGrams: 100 },
];

const app = initializeApp(config);
await signInAnonymously(getAuth(app));
const db = getFirestore(app);

for (const [index, { id, ...item }] of MENU.entries()) {
  const ref = doc(db, 'menu', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    if (existing.data().defaultGrams === undefined) {
      await updateDoc(ref, { defaultGrams: item.defaultGrams });
      console.log(`update ${id} (added default weight ${item.defaultGrams} g)`);
    } else {
      console.log(`skip   ${id} (already exists)`);
    }
    continue;
  }
  await setDoc(ref, { ...item, active: true, sortOrder: index });
  console.log(`added  ${id}`);
}

process.exit(0);
