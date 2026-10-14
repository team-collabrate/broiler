// One-time migration: gives every existing `menu` doc a `sortOrder` field.
//
// Required before menu.service.ts's orderBy("sortOrder") change goes live —
// Firestore's orderBy silently excludes any document missing the ordered
// field, so an un-backfilled item would just vanish from both apps' menu
// screens rather than error. Safe to re-run: any doc that already has
// sortOrder is left untouched, so a partial prior run just resumes.
//
// Groups items by category (declared categories first in their usual
// display order, then any leftover/undeclared category alphabetically —
// same precedence useMenuCategories.ts uses), sorted alphabetically by
// name *within* each group — i.e. today's existing alphabetical order, so
// nothing visually reshuffles the moment this switches over. Numbers are
// spaced by 10 per item, continuing across category boundaries; the actual
// values never matter, only relative order within a category (see
// MenuItem.sortOrder's own doc comment) — swapping two items later just
// exchanges their two numbers.
//
// Uses the client SDK + anonymous auth, same non-destructive write path as
// add-menu-items.mjs — no service account key needed.
//
// Usage: node scripts/backfill-menu-sort-order.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, getFirestore, writeBatch } from "firebase/firestore";

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

// Mirrors shared/src/i18n/categoryLabels.ts — kept as a plain literal here
// rather than importing across the workspace boundary into a throwaway
// Node script.
const DECLARED_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Tea", "Vadai"];

async function run() {
  await signInAnonymously(auth);
  const snap = await getDocs(collection(db, "menu"));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const toBackfill = docs.filter((d) => typeof d.sortOrder !== "number");
  if (toBackfill.length === 0) {
    console.log("Every item already has a sortOrder. Nothing to do.");
    process.exit(0);
  }
  console.log(`${toBackfill.length} of ${docs.length} item(s) need a sortOrder.`);

  const categories = [
    ...DECLARED_CATEGORIES,
    ...Array.from(new Set(docs.map((d) => d.category).filter((c) => c && !DECLARED_CATEGORIES.includes(c)))).sort(),
    undefined, // items with no category at all, last
  ];

  let counter = 10;
  const updates = [];
  for (const category of categories) {
    const group = toBackfill
      .filter((d) => d.category === category)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    for (const item of group) {
      updates.push({ id: item.id, sortOrder: counter });
      counter += 10;
    }
  }

  for (let i = 0; i < updates.length; i += 400) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + 400)) {
      batch.update(doc(db, "menu", u.id), { sortOrder: u.sortOrder });
    }
    await batch.commit();
    console.log(`Committed ${Math.min(i + 400, updates.length)}/${updates.length}`);
  }

  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
