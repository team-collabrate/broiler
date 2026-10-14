// One-time admin script — updates pinHash on existing `users` docs by name,
// in place (preserves doc IDs, unlike re-seeding). Requires a service
// account key (same as seed-users.mjs). Never commit the key file.
//
// Usage: node scripts/update-user-pins.mjs <path-to-service-account.json>

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error("Usage: node scripts/update-user-pins.mjs <path-to-service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const updates = [
  { name: "worker", pinHash: "1bea20e1df19b12013976de2b5e0e3d1fb4ba088b59fe53642c324298b21ffd9" },
  { name: "owner1", pinHash: "85a915d17097bdeb601dedc2e72ce795cd1c4f480e1b34005a8046dbf6d68fec" },
  { name: "owner2", pinHash: "775988758f13f17d20e083ed112c78ad3b62be322f501d4a61ca174a704be1a7" },
];

for (const { name, pinHash } of updates) {
  const snap = await db.collection("users").where("name", "==", name).get();
  if (snap.empty) {
    console.error(`No user found with name "${name}" — skipped.`);
    continue;
  }
  for (const doc of snap.docs) {
    await doc.ref.update({ pinHash });
    console.log(`Updated ${name} (${doc.id})`);
  }
}

console.log("Done.");
process.exit(0);
