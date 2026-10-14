// One-time admin script — clears orders/expenses/customers/customerPayments
// and replaces them with synthetic sample orders, for testing Reports and
// the Dashboard without real transaction data in the way.
//
// Requires a service account key (same as seed-menu.mjs). Never commit the
// key file.
//
// Deliberately does NOT touch `menu` or `users` — those are the shop's real
// configuration, not transaction history, and weren't asked for.
//
// Backs up every document it's about to delete to a local JSON file first
// (path printed at the end) — this only ever gets run once knowingly, but
// there's no "undo" on a Firestore delete, so the backup is not optional.
//
// Usage: node scripts/reset-transactions.mjs <path-to-service-account.json> [--backup-dir <dir>]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const serviceAccountPath = args[0];
if (!serviceAccountPath) {
  console.error("Usage: node scripts/reset-transactions.mjs <path-to-service-account.json> [--backup-dir <dir>]");
  process.exit(1);
}
const backupDirIdx = args.indexOf("--backup-dir");
const backupDir = backupDirIdx >= 0 ? args[backupDirIdx + 1] : ".";

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const RESET_COLLECTIONS = ["orders", "expenses", "customers", "customerPayments"];

// Sample generation is built from the real, currently active menu — so the
// synthetic bills read as plausible orders from this shop, not placeholder
// junk from an unrelated one.
const PAYMENT_WEIGHTS = [
  ["cash", 55],
  ["upi", 30],
  ["split", 15],
  // No "credit" — customers are being cleared, not reseeded, and a credit
  // order with no matching customer record would show as a broken
  // reference in the owner app's Outstanding Credit list.
];

function weightedPick(weights) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of weights) {
    if ((r -= w) <= 0) return value;
  }
  return weights[0][0];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Rough traffic shape across a day — more orders at meal times than at 4am. */
function randomHourWeighted() {
  const bands = [
    [7, 10, 25], // breakfast
    [12, 14, 30], // lunch
    [16, 18, 15], // tea
    [19, 21, 25], // dinner
    [10, 12, 5],
    [14, 16, 5],
    [21, 23, 5],
  ];
  const hour = weightedPick(bands.map(([s, e, w]) => [[s, e], w]));
  return randomInt(hour[0], hour[1] - 1);
}

function pickOrderLines(menuItems, count) {
  const chosen = [];
  const pool = [...menuItems];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = randomInt(0, pool.length - 1);
    const item = pool.splice(idx, 1)[0];
    chosen.push({
      itemId: item.itemId,
      name: item.name,
      ...(item.nameTa ? { nameTa: item.nameTa } : {}),
      price: item.price,
      qty: randomInt(1, 3),
    });
  }
  return chosen;
}

async function backupAndClear(name) {
  const ref = db.collection(name);
  const snap = await ref.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/${name}-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(docs, null, 2));
  console.log(`  ${name}: backed up ${docs.length} doc(s) -> ${backupPath}`);

  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
  console.log(`  ${name}: deleted ${docs.length} doc(s)`);
}

async function seedSampleOrders(count) {
  const menuSnap = await db.collection("menu").where("active", "==", true).get();
  const menuItems = menuSnap.docs.map((d) => ({ itemId: d.id, ...d.data() }));
  if (menuItems.length === 0) throw new Error("No active menu items found — nothing to build sample orders from.");

  const usersSnap = await db.collection("users").where("role", "==", "worker").where("active", "==", true).get();
  if (usersSnap.empty) throw new Error("No active worker user found to attribute sample orders to.");
  const workerId = usersSnap.docs[0].id;

  const now = new Date();
  const orders = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = randomInt(0, 13); // spread across the last two weeks
    const created = new Date(now);
    created.setDate(created.getDate() - daysAgo);
    created.setHours(randomHourWeighted(), randomInt(0, 59), randomInt(0, 59), 0);

    const lines = pickOrderLines(menuItems, randomInt(1, 4));
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const paymentMethod = weightedPick(PAYMENT_WEIGHTS);

    const order = {
      items: lines,
      subtotal,
      discount: 0,
      total: subtotal,
      paymentMethod,
      workerId,
      createdAt: Timestamp.fromDate(created),
      syncedAt: Timestamp.fromDate(created),
      status: "completed",
    };

    if (paymentMethod === "split") {
      const upiAmount = Math.round(subtotal * (0.3 + Math.random() * 0.4));
      order.upiAmount = upiAmount;
      order.cashAmount = subtotal - upiAmount;
    }

    orders.push(order);
  }

  const ref = db.collection("orders");
  for (let i = 0; i < orders.length; i += 400) {
    const batch = db.batch();
    for (const order of orders.slice(i, i + 400)) batch.set(ref.doc(), order);
    await batch.commit();
  }
  console.log(`  orders: inserted ${orders.length} sample order(s)`);
  console.log(`  sample sales total: ₹${orders.reduce((s, o) => s + o.total, 0)}`);
}

async function main() {
  console.log("Backing up and clearing transaction data...");
  for (const name of RESET_COLLECTIONS) await backupAndClear(name);

  console.log("\nSeeding sample orders...");
  await seedSampleOrders(60);

  console.log("\nDone. menu and users were not touched.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
