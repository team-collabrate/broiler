// Fills the LOCAL emulator with a week or so of made-up bills, credit customers and payments, so the owner's app can be
// tried with real-looking numbers:
//
//   npm run emulators          (in one terminal)
//   npm run emulators:seed     (the catalog and the test accounts)
//   node scripts/seed-emulator-sales.mjs
//
// It writes with the rules switched off, to the emulator only (project demo-broiler on 127.0.0.1:8080), so it cannot
// touch the live project. The bills are a repeatable pseudo-random mix. Days 5 to 8 back are older than the 4 days of full
// bills, so opening the owner's app rolls them up into daily totals, which is part of what this lets you check.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rules = readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'firestore.rules'), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-broiler', firestore: { rules, host: '127.0.0.1', port: 8080 } });

// A small repeatable random number generator (mulberry32).
let seedState = 20261022;
const random = () => {
  seedState += 0x6d2b79f5;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (a, b) => a + Math.floor(random() * (b - a + 1));

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const menu = (await getDocs(collection(db, 'menu'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.active !== false && m.rateMinor > 0);
  if (menu.length === 0) throw new Error('The menu is empty: run `npm run emulators:seed` first.');

  // Rates counted as set today for most items, so the dashboard's warning can be seen on the rest.
  await Promise.all(menu.filter((_, i) => i % 4 !== 3).map((m) => setDoc(doc(db, 'menu', m.id), { rateUpdatedAt: Timestamp.now() }, { merge: true })));

  const now = new Date();
  const customers = { 'ravi%20stores': { name: 'Ravi Stores', balance: 0 }, murugan: { name: 'Murugan', balance: 0 } };
  const lineFor = (item) => {
    const rate = item.rateMinor;
    if (item.unit === 'piece') {
      const qty = between(1, 6);
      return { itemId: item.id, name: item.nameTa || item.name, category: item.category, unit: 'piece', rateMinor: rate, listRateMinor: rate, grams: 0, qty, lineTotalMinor: rate * qty };
    }
    const grams = pick([250, 500, 750, 1000, 1000, 1500, 2000, 2500]);
    return { itemId: item.id, name: item.nameTa || item.name, category: item.category, unit: 'kg', rateMinor: rate, listRateMinor: rate, grams, qty: 0, lineTotalMinor: Math.round((rate * grams) / 1000) };
  };

  let written = 0;
  const writes = [];
  for (let back = 0; back <= 8; back++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const count = back === 0 ? between(7, 11) : between(14, 24);
    const lastHour = back === 0 ? Math.max(8, now.getHours()) : 20;
    for (let n = 1; n <= count; n++) {
      const soldAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), between(7, lastHour), between(0, 59));
      if (back === 0 && soldAt > now) soldAt.setHours(now.getHours(), Math.max(0, now.getMinutes() - 1));
      const lines = Array.from({ length: between(1, 4) }, () => lineFor(pick(menu)));
      const totalMinor = lines.reduce((s, l) => s + l.lineTotalMinor, 0);
      const method = pick(['cash', 'cash', 'cash', 'upi', 'upi', 'split', 'credit']);
      const order = {
        orderNo: n,
        dayKey: keyOf(day),
        device: 'A',
        soldAt: Timestamp.fromDate(soldAt),
        createdAt: Timestamp.fromDate(soldAt),
        staffName: pick(['Worker A', 'Worker B']),
        lines,
        totalMinor,
        totalGrams: lines.reduce((s, l) => s + l.grams, 0),
        totalPieces: lines.reduce((s, l) => s + l.qty, 0),
        paymentMethod: method,
      };
      if (method === 'split') {
        const upi = Math.max(100, Math.round(totalMinor / 3 / 100) * 100);
        order.upiAmountMinor = Math.min(upi, totalMinor - 100);
        order.cashAmountMinor = totalMinor - order.upiAmountMinor;
        if (order.cashAmountMinor < 1 || order.upiAmountMinor < 1) order.paymentMethod = 'cash', delete order.cashAmountMinor, delete order.upiAmountMinor;
      }
      if (method === 'credit') {
        const id = pick(Object.keys(customers));
        order.customerId = id;
        order.customerName = customers[id].name;
      }
      // One cash bill today and one credit bill yesterday were deleted.
      const deleted = (back === 0 && n === 2 && order.paymentMethod !== 'credit') || (back === 1 && n === 3 && order.paymentMethod === 'credit');
      if (deleted) Object.assign(order, { status: 'voided', voidedAt: Timestamp.fromDate(soldAt), voidedBy: 'uid-owner@broiler-pos.invalid' });
      if (order.paymentMethod === 'credit' && !deleted) customers[order.customerId].balance += totalMinor;
      writes.push(setDoc(doc(db, 'orders', `demo-${keyOf(day)}-${pad(n)}`), order));
      written++;
    }
  }
  await Promise.all(writes);

  // Credit customers (balances are what their live credit bills add up to, less what they paid) and payments.
  const paid = { 'ravi%20stores': 0, murugan: 0 };
  let p = 0;
  for (const [id, c] of Object.entries(customers)) {
    const payment = Math.min(c.balance, Math.round(c.balance / 4 / 100) * 100);
    if (payment > 0) {
      paid[id] = payment;
      p++;
      await setDoc(doc(db, 'customerPayments', `demo-pay-${p}`), {
        customerId: id,
        customerName: c.name,
        amountMinor: payment,
        method: p % 2 ? 'cash' : 'upi',
        dayKey: keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)),
        createdAt: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 5)),
      });
    }
    await setDoc(doc(db, 'customers', id), {
      name: c.name,
      nameKey: c.name.toLowerCase(),
      balanceMinor: c.balance - paid[id],
      lastOrderId: 'demo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`Wrote ${written} bills over 9 days, 2 credit customers (${Object.values(customers).map((c) => c.name).join(', ')}) and ${p} payments.`);
});
await env.cleanup();
