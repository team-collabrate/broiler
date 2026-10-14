// One-off / reusable admin script: adds menu items WITHOUT touching any
// existing ones (unlike seed-menu.mjs, which clears the whole collection
// first — do not use that one for incremental additions to a live menu).
//
// Uses the regular client SDK + anonymous auth, the same write path the
// Owner app's "Add item" form uses (createMenuItem in menu.service.ts) —
// no service account key needed, since Firestore rules allow any signed-in
// session to write to `menu` (see firestore.rules).
//
// Usage: node scripts/add-menu-items.mjs
// Edit the `items` list below before running.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Reads worker-app/.env directly rather than depending on Vite's import.meta.env,
// since this runs under plain Node.
function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(join(__dirname, "..", "worker-app", ".env"));

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

// 2026-09-01, second batch (already added — kept for history, not re-run):
// all parcel sizes. "1 + 1/2 Parcel" is a bundle of one full + one half
// parcel sold together at one price (Horlicks/Boost/Tea/Naatu Sakarai Tea);
// Sukku Coffee instead got two separate sizes, matching the existing
// Black Tea 1 Parcel / Black Tea 1/2 Parcel pattern rather than a bundle.
//   { name: "Horlicks 1 + 1/2 Parcel", nameTa: "ஹார்லிக்ஸ் 1 + 1/2 பார்சல்", price: 85, category: "Tea" },
//   { name: "Boost 1 + 1/2 Parcel", nameTa: "பூஸ்ட் 1 + 1/2 பார்சல்", price: 85, category: "Tea" },
//   { name: "Tea 1 + 1/2 Parcel", nameTa: "தேநீர் 1 + 1/2 பார்சல்", price: 75, category: "Tea" },
//   { name: "Naatu Sakarai Tea 1 + 1/2 Parcel", nameTa: "நாட்டு சர்க்கரை 1 + 1/2 பார்சல் டீ", price: 90, category: "Tea" },
//   { name: "Sukku Coffee 1 Parcel", nameTa: "சுக்கு காபி 1 பார்சல்", price: 40, category: "Tea" },
//   { name: "Sukku Coffee 1/2 Parcel", nameTa: "சுக்கு காபி 1/2 பார்சல்", price: 35, category: "Tea" },

// 2026-09-01, third batch (already added — kept for history, not re-run):
//   { name: "Cauliflower", nameTa: "காலிஃபிளவர்", price: 40, category: "Vadai" },
//   { name: "Kaalan (Mushroom)", nameTa: "காளான்", price: 60, category: "Vadai" },
//   { name: "Kepai Rotti", nameTa: "கேபை ரொட்டி", price: 10, category: "Vadai" },

// 2026-09-01, fourth batch (already added — kept for history, not re-run):
//   { name: "Meals Oru Padi", nameTa: "மீல்ஸ் ஒரு படி", price: 1500, category: "Lunch" },
//   { name: "Briyani Oru Padi", nameTa: "பிரியாணி ஒரு படி", price: 1800, category: "Lunch" },

// Requested 2026-09-01, fifth batch — parcel sizes for Naatu Sakarai
// Coffee, matching the Naatu Sakarai Tea 1 Parcel / 1/2 Parcel naming
// already on the menu. The plain glass "Naatu Sakarai Coffee" (₹22) stays.
const items = [
  { name: "Naatu Sakarai Coffee 1 Parcel", nameTa: "நாட்டு சர்க்கரை 1 பார்சல் காபி", price: 50, category: "Tea" },
  {
    name: "Naatu Sakarai Coffee 1/2 Parcel",
    nameTa: "நாட்டு சர்க்கரை 1/2 பார்சல் காபி",
    price: 45,
    category: "Tea",
  },
];

async function run() {
  await signInAnonymously(auth);
  const menuRef = collection(db, "menu");
  for (const item of items) {
    const ref = await addDoc(menuRef, {
      ...item,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`Added "${item.name}" (${ref.id})`);
  }
  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
