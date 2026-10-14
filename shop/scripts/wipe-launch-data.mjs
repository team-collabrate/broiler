// Run this yourself when you're ready — it is NOT run automatically by
// Claude, and deletion here is permanent (no undo, no trash).
//
// Clears transaction data ahead of launch: orders, expenses, customers,
// and the daily bill-number counters. Leaves `users` (staff accounts/PINs)
// and `menu` (the items you've built up) untouched — those aren't
// "data to zero out", they're the setup launch depends on.
//
// Usage:
//   node scripts/wipe-launch-data.mjs           # dry run — counts only, deletes nothing
//   node scripts/wipe-launch-data.mjs --confirm # actually deletes
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { collection, getDocs, getFirestore, writeBatch } from "firebase/firestore";

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

const COLLECTIONS = ["orders", "expenses", "customers", "counters"];
const confirmed = process.argv.includes("--confirm");

async function run() {
  await signInAnonymously(auth);

  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    console.log(`${name}: ${snap.size} document(s)${confirmed ? "" : " (dry run — not deleted)"}`);
    if (!confirmed || snap.size === 0) continue;

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    console.log(`  -> deleted`);
  }

  if (!confirmed) {
    console.log("\nDry run only. Re-run with --confirm to actually delete.");
  } else {
    console.log("\nDone. orders/expenses/customers/counters are now empty.");
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
