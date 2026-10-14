// One-off admin script: updates existing menu items in place (by doc ID) —
// unlike add-menu-items.mjs, this never creates a new document. Used here
// to tighten Tea's item names/nameTa so they fit the real tablet's card
// width without wrapping to an ellipsis. Uses the regular client SDK +
// anonymous auth, same as add-menu-items.mjs.
//
// Usage: node scripts/update-menu-names.mjs
// Edit the `updates` list below before running.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { doc, getFirestore, serverTimestamp, updateDoc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Requested 2026-09-01 — "tune all the names as they look clean in TEA and
// full name should be visible in tablet". Two changes: apply the நா. ச.
// abbreviation (already used on the two plain Naatu Sakarai Tea parcels)
// consistently to the Naatu Sakarai Coffee parcels and the 1+1/2 combos
// too; and drop the spaces around "+" in every combo name, which bought
// back real width on cards this narrow without losing meaning. Also
// unified Black Tea's two parcel sizes onto "பிளாக்" (matching the plain
// Black Tea item's own Tamil) instead of "கருப்பு" — the same word
// rendered two different ways across otherwise-identical items.
const updates = [
  { id: "sH7Pb5rlQrAqAQsLGNhD", nameTa: "பிளாக் தேநீர் 1 பார்சல்" }, // Black Tea 1 Parcel
  { id: "VhZAWnTVytjPEFE5ikaw", nameTa: "பிளாக் தேநீர் 1/2 பார்சல்" }, // Black Tea 1/2 Parcel
  { id: "rzVyasvCkJ76KPmpSWsD", name: "Boost 1+1/2 Parcel", nameTa: "பூஸ்ட் 1+1/2 பார்சல்" }, // Boost 1 + 1/2 Parcel
  { id: "2v3W5qRhJqNRd9oL19zH", name: "Horlicks 1+1/2 Parcel", nameTa: "ஹார்லிக்ஸ் 1+1/2 பார்சல்" }, // Horlicks 1 + 1/2 Parcel
  { id: "fi4ZHfg57lt6MgYKiTnW", nameTa: "நா. ச. 1 பார்சல் காபி" }, // Naatu Sakarai Coffee 1 Parcel
  { id: "pNDJG1f16m7GX7w1Qrb5", nameTa: "நா. ச. 1/2 பார்சல் காபி" }, // Naatu Sakarai Coffee 1/2 Parcel
  { id: "gkIJAkIDc0Zow4hkqgCN", name: "Naatu Sakarai Tea 1+1/2 Parcel", nameTa: "நா. ச. 1+1/2 பார்சல் டீ" }, // Naatu Sakarai Tea 1 + 1/2 Parcel
  { id: "NAm9odldkKI9Kt5TUizT", name: "Tea 1+1/2 Parcel", nameTa: "தேநீர் 1+1/2 பார்சல்" }, // Tea 1 + 1/2 Parcel
];

async function run() {
  await signInAnonymously(auth);
  for (const { id, ...fields } of updates) {
    await updateDoc(doc(db, "menu", id), { ...fields, updatedAt: serverTimestamp() });
    console.log(`Updated ${id}:`, fields);
  }
  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
