// One-time admin script (Engineering Plan Phase 6) — creates the initial
// `users` docs. Requires a service account key (Project Settings > Service
// accounts > Generate new private key), which bypasses Firestore rules via
// the Admin SDK. Never commit the key file.
//
// Usage: node scripts/seed-users.mjs <path-to-service-account.json>

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error("Usage: node scripts/seed-users.mjs <path-to-service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Beta seed data — PIN hashes are SHA-256 of the plaintext PIN, matching
// shared/src/auth/pinHash.ts. Add more entries here for future seeding.
const users = [
  { name: "worker", role: "worker", pinHash: "a388f562e286fdf28986f9253579f4d096446e01dd0c771996a51ff11b390fa2" },
  { name: "owner1", role: "owner", pinHash: "ec4136f96f2fa9dd52def83fe3a2097dd0cd657c37aa8096a4033e1a77a57a32" },
  { name: "owner2", role: "owner", pinHash: "7ad3866ca9ab8880b6d411a396548f4094a1e20714471ccc00f98d2248191b5f" },
];

for (const user of users) {
  const ref = await db.collection("users").add({
    ...user,
    active: true,
    createdAt: Timestamp.now(),
  });
  console.log(`Created ${user.name} (${user.role}) -> ${ref.id}`);
}

console.log("Done.");
process.exit(0);
