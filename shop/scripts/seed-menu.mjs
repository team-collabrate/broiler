// One-time admin script (Engineering Plan Phase 6) — seeds the menu.
// Requires a service account key (same as seed-users.mjs).
// Never commit the key file.
//
// Re-runnable: clears the existing `menu` collection first, so running
// this again after an edit to the list below replaces it cleanly instead
// of creating duplicates.
//
// Usage: node scripts/seed-menu.mjs <path-to-service-account.json>

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error("Usage: node scripts/seed-menu.mjs <path-to-service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Full tiffin/meals menu, sourced verbatim from pos_menu_by_timing.md —
// name and price match that file exactly. No `icon` field: photos are
// coming later, so items fall back to a letter avatar (see ProductIcon)
// rather than carrying a placeholder emoji that would need replacing.
//
// Dosa, Kal Dosa, Masala Dosa, Onion Dosa, Podi Dosa, Ghee Roast and Onion
// Podi Dosa are intentionally listed under both Breakfast and Dinner, per
// the source file's own note — two separate menu docs, same name and price,
// so the item is reachable from whichever tab a worker has open at the time.
const items = [
  // Breakfast
  { name: "Idli", nameTa: "இட்லி", price: 12, category: "Breakfast" },
  { name: "Pongal", nameTa: "பொங்கல்", price: 50, category: "Breakfast" },
  { name: "Poori (Single)", nameTa: "பூரி (ஒன்று)", price: 20, category: "Breakfast" },
  { name: "Poori Set", nameTa: "பூரி செட்", price: 40, category: "Breakfast" },
  { name: "Chapathi (Single)", nameTa: "சப்பாத்தி (ஒன்று)", price: 20, category: "Breakfast" },
  { name: "Chapathi Set", nameTa: "சப்பாத்தி செட்", price: 40, category: "Breakfast" },
  { name: "Dosa / Nice Dosa", nameTa: "தோசை", price: 30, category: "Breakfast" },
  { name: "Uthappam / Onion Uthappam", nameTa: "உத்தப்பம் / வெங்காய உத்தப்பம்", price: 50, category: "Breakfast" },
  { name: "Idiyappam 1 Set", nameTa: "இடியாப்பம் (1 செட்)", price: 25, category: "Breakfast" },
  { name: "Kal Dosa", nameTa: "கல் தோசை", price: 25, category: "Breakfast" },
  { name: "Masala Dosa", nameTa: "மசாலா தோசை", price: 65, category: "Breakfast" },
  { name: "Onion Dosa", nameTa: "வெங்காய தோசை", price: 60, category: "Breakfast" },
  { name: "Podi Dosa", nameTa: "பொடி தோசை", price: 70, category: "Breakfast" },
  { name: "Ghee Roast", nameTa: "நெய் ரோஸ்ட்", price: 70, category: "Breakfast" },
  { name: "Onion Podi Dosa", nameTa: "வெங்காய பொடி தோசை", price: 65, category: "Breakfast" },

  // Lunch
  { name: "Meals", nameTa: "மீல்ஸ்", price: 90, category: "Lunch" },
  { name: "Parcel Meals", nameTa: "பார்சல் மீல்ஸ்", price: 100, category: "Lunch" },
  { name: "Veg Biryani", nameTa: "வெஜ் பிரியாணி", price: 60, category: "Lunch" },
  { name: "Tomato Rice", nameTa: "தக்காளி சாதம்", price: 50, category: "Lunch" },
  { name: "Lemon Rice", nameTa: "எலுமிச்சை சாதம்", price: 50, category: "Lunch" },
  { name: "Tamarind Rice", nameTa: "புளியோதரை", price: 50, category: "Lunch" },
  { name: "Curd Rice", nameTa: "தயிர் சாதம்", price: 50, category: "Lunch" },
  { name: "Sambar Rice", nameTa: "சாம்பார் சாதம்", price: 50, category: "Lunch" },

  // Dinner
  { name: "Veg Rice", nameTa: "வெஜ் ரைஸ்", price: 80, category: "Dinner" },
  { name: "Mushroom Rice", nameTa: "காளான் ரைஸ்", price: 90, category: "Dinner" },
  { name: "Paneer Rice", nameTa: "பன்னீர் ரைஸ்", price: 100, category: "Dinner" },
  { name: "Mushroom Noodles", nameTa: "காளான் நூடுல்ஸ்", price: 90, category: "Dinner" },
  { name: "Paneer Noodles", nameTa: "பன்னீர் நூடுல்ஸ்", price: 100, category: "Dinner" },
  { name: "Parotta", nameTa: "பரோட்டா", price: 15, category: "Dinner" },
  { name: "Kothu Parotta", nameTa: "கொத்து பரோட்டா", price: 70, category: "Dinner" },
  { name: "Chilli Parotta", nameTa: "சில்லி பரோட்டா", price: 80, category: "Dinner" },
  { name: "Dosa / Nice Dosa", nameTa: "தோசை", price: 30, category: "Dinner" },
  { name: "Kal Dosa", nameTa: "கல் தோசை", price: 25, category: "Dinner" },
  { name: "Masala Dosa", nameTa: "மசாலா தோசை", price: 65, category: "Dinner" },
  { name: "Onion Dosa", nameTa: "வெங்காய தோசை", price: 60, category: "Dinner" },
  { name: "Podi Dosa", nameTa: "பொடி தோசை", price: 70, category: "Dinner" },
  { name: "Ghee Roast", nameTa: "நெய் ரோஸ்ட்", price: 70, category: "Dinner" },
  { name: "Onion Podi Dosa", nameTa: "வெங்காய பொடி தோசை", price: 65, category: "Dinner" },

  // Tea
  { name: "Tea", nameTa: "தேநீர்", price: 15, category: "Tea" },
  { name: "Coffee", nameTa: "காபி", price: 20, category: "Tea" },
  { name: "Sukku Coffee", nameTa: "சுக்கு காபி", price: 20, category: "Tea" },
  { name: "Lemon Tea", nameTa: "எலுமிச்சை தேநீர்", price: 15, category: "Tea" },
  { name: "Black Tea", nameTa: "கருப்பு தேநீர்", price: 10, category: "Tea" },
  { name: "1/2 Parcel Tea", nameTa: "1/2 பார்சல் தேநீர்", price: 30, category: "Tea" },
  { name: "1 Parcel Tea", nameTa: "1 பார்சல் தேநீர்", price: 35, category: "Tea" },
  { name: "1-1/2 Parcel Tea", nameTa: "1-1/2 பார்சல் தேநீர்", price: 60, category: "Tea" },
  { name: "Parcel Coffee", nameTa: "பார்சல் காபி", price: 40, category: "Tea" },
  { name: "1/2 Parcel Coffee", nameTa: "1/2 பார்சல் காபி", price: 35, category: "Tea" },
  { name: "1 Parcel Coffee", nameTa: "1 பார்சல் காபி", price: 40, category: "Tea" },
  { name: "1-1/2 Parcel Coffee", nameTa: "1-1/2 பார்சல் காபி", price: 70, category: "Tea" },
  { name: "Milk", nameTa: "பால்", price: 20, category: "Tea" },
  { name: "1 Milk", nameTa: "1 பால்", price: 40, category: "Tea" },
  { name: "Badam Milk", nameTa: "பாதாம் பால்", price: 30, category: "Tea" },
  { name: "Badam Milk Parcel", nameTa: "பாதாம் பால் பார்சல்", price: 50, category: "Tea" },
  { name: "Horlicks", nameTa: "ஹார்லிக்ஸ்", price: 20, category: "Tea" },
  { name: "Boost", nameTa: "பூஸ்ட்", price: 20, category: "Tea" },
  { name: "Water", nameTa: "தண்ணீர்", price: 20, category: "Tea" },
  { name: "Water Can", nameTa: "தண்ணீர் கேன்", price: 20, category: "Tea" },

  // Vadai
  { name: "Vadai", nameTa: "வடை", price: 10, category: "Vadai" },
  { name: "Samosa", nameTa: "சமோசா", price: 10, category: "Vadai" },
  { name: "Bonda", nameTa: "போண்டா", price: 20, category: "Vadai" },
  { name: "Kesari", nameTa: "கேசரி", price: 20, category: "Vadai" },
  { name: "Neyi Poli", nameTa: "நெய் போளி", price: 20, category: "Vadai" },
  { name: "Paniyaram", nameTa: "பணியாரம்", price: 20, category: "Vadai" },
  { name: "Other Snacks", nameTa: "மற்ற தின்பண்டங்கள்", price: 1, category: "Vadai" },
];

async function seed() {
  const menuRef = db.collection("menu");

  // Clear whatever is there now, in batches (Firestore caps a batch at 500
  // writes) — the collection is small, but this stays correct if it grows.
  const existing = await menuRef.get();
  console.log(`Clearing ${existing.size} existing menu item(s)...`);
  const docs = existing.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
  }

  console.log(`Adding ${items.length} menu item(s)...`);
  const now = Timestamp.now();
  for (let i = 0; i < items.length; i += 400) {
    const batch = db.batch();
    for (const item of items.slice(i, i + 400)) {
      const ref = menuRef.doc();
      batch.set(ref, { ...item, active: true, createdAt: now, updatedAt: now });
    }
    await batch.commit();
  }

  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
