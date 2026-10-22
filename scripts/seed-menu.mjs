// Sets up the shop's catalog in Firestore. Safe to run again: an item that already exists keeps its
// rate and any edits the owner made; only fields it doesn't have yet are filled in.
//
//   npm run seed                          adds new items as inactive drafts
//   npm run seed -- --reset-structure     also re-applies each known DRAFT item's name, category, unit,
//                                         billing methods and order (items already live are left alone)
//   npm run seed -- --go-live             the cut-over: restructures live items too, switches the whole
//                                         catalog on, switches the old items off, drops the old per-kg field
//
// Items from earlier versions of this catalog (LEGACY_IDS) are switched off at --go-live, never deleted.
//
// It signs in as the owner (the PIN is typed at a hidden prompt), since only the owner may edit the
// menu. Before the access rules go live you can add --anonymous to sign in the old way.
//
// New items start inactive so the counter apps already in use don't show half-set-up items; set
// VITE_SHOW_DRAFT_MENU=1 in shop/worker-app/.env to see them while checking.
//
// Rates below are SAMPLE values except Kadai (₹60) and Podi (₹10): the owner sets the real ones
// with the Today's rate button.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { deleteField, doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { pinPassword, ROLE_EMAILS } from '../shop/shared/src/core/roles.ts';
import { connectEmulators, usingEmulator, withEmulatorConfig } from './lib/emulator.mjs';
import { askPin } from './lib/pins.mjs';

const goLive = process.argv.includes('--go-live');
const resetStructure = process.argv.includes('--reset-structure');
const anonymous = process.argv.includes('--anonymous');

const env = process.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!usingEmulator && (!config.apiKey || !config.projectId || !config.appId)) {
  console.error('Missing VITE_FIREBASE_* values. Copy shop/worker-app/.env.example to shop/worker-app/.env and fill it in.');
  process.exit(1);
}

// rateMinor is in paise: 24000 = ₹240.00 per kg (or per piece for unit 'piece').
// methods are the billing choices the product sheet offers, first is the default:
//   weight  pick a weight, the rate prices it      amount  type the money, the weight follows
//   qty     pick a count, the rate prices each
// defaultGrams is where a kg item's weight wheel starts; defaultQty where a piece item's count starts.
// category keys are the counter tabs (settings/categories); the picture is the item id in
// shop/worker-app/public/items.
const kg = (id, name, nameTa, category, group, variant, rateMinor, defaultGrams, methods = ['weight', 'amount']) => ({
  id, name, nameTa, category, group, variant, unit: 'kg', methods, rateMinor, defaultGrams,
});
const piece = (id, name, nameTa, category, group, variant, rateMinor, defaultQty = 1, methods = ['qty']) => ({
  id, name, nameTa, category, group, variant, unit: 'piece', methods, rateMinor, defaultQty,
});

const MENU = [
  // Chicken
  kg('naatukoli-kari', 'Naatukoli Kari', 'நாட்டுக்கோழி கறி', 'chicken', 'naatukoli', null, 45000, 1000),
  kg('broiler-with-skin', 'Broiler Chicken - With Skin', 'பிராய்லர் கோழி - தோலுடன்', 'chicken', 'broiler', 'skin', 24000, 1000),
  kg('broiler-skinless', 'Broiler Chicken - Without Skin', 'பிராய்லர் கோழி - தோலில்லா', 'chicken', 'broiler', 'skinless', 26000, 500),
  kg('broiler-live', 'Broiler Chicken - Uyir Ooda', 'பிராய்லர் கோழி - உயிரோடு', 'chicken', 'broiler', 'live', 14000, 1000),
  piece('kadai', 'Kadai', 'காடை', 'other', 'kadai', null, 6000, 2),
  // Mutton
  kg('mutton-bone', 'Mutton - With Bone', 'மட்டன் - எலும்புடன்', 'mutton', 'mutton', 'bone', 80000, 500),
  kg('mutton-boneless', 'Mutton - Without Bone', 'மட்டன் - எலும்பில்லா', 'mutton', 'mutton', 'boneless', 95000, 500),
  kg('kodal', 'Kodal', 'குடல்', 'mutton', 'kodal', null, 20000, 500),
  kg('eral', 'Eral', 'ஈரல்', 'mutton', 'eral', null, 90000, 250),
  piece('blood', 'Blood', 'இரத்தம்', 'mutton', 'blood', null, 2000),
  piece('excess', 'Excess', 'கூடுதல்', 'mutton', 'excess', null, 1000, 1, ['qty', 'amount']),
  // Others. Podi is masala: one item, sold by the packet (or by an amount).
  piece('masala', 'Masala', 'மசாலா', 'other', 'masala', null, 1000, 1, ['qty', 'amount']),
];

// Items from earlier versions of the catalog that are no longer sold: switched off, never deleted.
const LEGACY_IDS = ['podi', 'egg', 'lemon', 'broiler-bone', 'chicken-boneless', 'country-live', 'country-chicken', 'country-boneless', 'kadai-live', 'kadai-dressed', 'chicken-liver', 'mutton-liver', 'kodal-old'];

const CATEGORIES = [
  { key: 'chicken', name: 'Chicken', nameTa: 'கோழி' },
  { key: 'other', name: 'Others', nameTa: 'மற்றவை' },
  { key: 'mutton', name: 'Mutton', nameTa: 'மட்டன்' },
];

// What --reset-structure re-applies. The rate, the default weight or count and `active` are never reset.
const STRUCTURE = ['name', 'nameTa', 'category', 'group', 'variant', 'unit', 'methods'];

const app = initializeApp(withEmulatorConfig(config));
const auth = getAuth(app);
const db = getFirestore(app);
connectEmulators(auth, db); // USE_EMULATOR=1 only
if (anonymous) {
  await signInAnonymously(auth);
} else {
  const pin = await askPin('Owner PIN', 'OWNER_PIN');
  await signInWithEmailAndPassword(auth, ROLE_EMAILS.owner, pinPassword(pin));
}

for (const [index, { id, ...item }] of MENU.entries()) {
  const ref = doc(db, 'menu', id);
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    await setDoc(ref, { ...item, active: goLive, sortOrder: index });
    console.log(`added  ${id}${goLive ? '' : ' (draft, inactive)'}`);
    continue;
  }

  // An existing item keeps what it has. Fill in only what is missing; the rate comes from the old
  // per-kg field so the owner's current rate carries over.
  const data = existing.data();
  const changes = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === 'rateMinor') {
      if (data.rateMinor === undefined) changes.rateMinor = data.pricePerKgMinor ?? value;
    } else if (data[key] === undefined || ((goLive || (resetStructure && data.active === false)) && STRUCTURE.includes(key))) {
      if (JSON.stringify(data[key]) !== JSON.stringify(value)) changes[key] = value;
    }
  }
  if ((goLive || (resetStructure && data.active === false)) && data.sortOrder !== index) changes.sortOrder = index;
  if (data.sortOrder === undefined) changes.sortOrder = index;
  if (goLive) {
    if (data.active !== true) changes.active = true;
    if (data.pricePerKgMinor !== undefined) changes.pricePerKgMinor = deleteField();
  }
  if (Object.keys(changes).length > 0) {
    await updateDoc(ref, changes);
    console.log(`update ${id} (${Object.keys(changes).join(', ')})`);
  } else {
    console.log(`skip   ${id} (already set)`);
  }
}

if (goLive) {
  for (const id of LEGACY_IDS) {
    const ref = doc(db, 'menu', id);
    const existing = await getDoc(ref);
    if (existing.exists() && existing.data().active !== false) {
      await updateDoc(ref, { active: false });
      console.log(`off    ${id} (no longer in the catalog)`);
    }
  }
}

// The counter's tabs, and how far the counter may move a sale's rate (₹20 until the owner changes it).
// If the deployed rules predate settings, this is refused: say so and carry on, the apps use defaults.
async function ensureSetting(id, data, note) {
  try {
    const ref = doc(db, 'settings', id);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, data);
      console.log(`added  settings/${id} ${note}`);
    }
  } catch (e) {
    console.log(`skip   settings/${id}: ${e.code ?? e.message} (the apps use their defaults until the new rules are deployed)`);
  }
}
await ensureSetting('categories', { list: CATEGORIES }, '(Chicken, Others, Mutton)');
await ensureSetting('pricing', { maxAdjustMinor: 2000 }, '(counter may adjust a rate by up to ₹20)');

process.exit(0);
