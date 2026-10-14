// One-time asset prep — turns the photos in food-images/ into the small,
// consistently-cropped PNGs MenuItemCard.tsx serves from
// worker-app/public/items/.
//
// Unlike the category tab photos (natural-shape cutouts against a
// transparent background), these are full-bleed CARD photos: the card
// already renders them with object-fit:cover and a dark gradient scrim
// on top (see MenuItemCard.css), so there's no background to remove —
// the photo's own background *is* the card's background. All this script
// does is centre-crop each source to the card's own 4:3 aspect ratio (so
// the browser doesn't have to throw away pixels that were downloaded for
// nothing) and resize down to a sane delivery size.
//
// Usage: node scripts/prepare-item-images.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { decodePng, resampleRgba, encodePng } from "./lib/png.mjs";

const SRC_DIR = "food-images";
const OUT_DIR = "worker-app/public/items";
// 2x a ~320px-wide card in the 4-column grid — sharp on tablets without
// shipping a full 1536px source photo down the wire for a card this size.
// Photographic content and a lossless-only encoder (see lib/png.mjs) don't
// mix well at high resolution — 640x480 came out to ~800KB *per card*,
// which is not a reasonable download for a cafe's wifi. Tried 640/480,
// 400/300 and 320/240 side by side; 400x300 was the smallest size that
// still looked sharp scaled up to a ~320px-wide card on a tablet's 2x
// display, at roughly a third of the 640x480 file weight.
const TARGET_W = 400;
const TARGET_H = 300; // 4:3, matching .menu-item-card's aspect-ratio

// source file (in food-images/) -> output slug (written as {slug}.png)
const SOURCE_SLUG = {
  "badam-milk.png": "badam-milk",
  "boli.png": "boli",
  "bonda.png": "bonda",
  "boost.png": "boost",
  "chappathi.png": "chappathi",
  "chilli-porotta.png": "chilli-porotta",
  "coffee.png": "coffee",
  "curd-rice.png": "curd-rice",
  "idiyappam.png": "idiyappam",
  "idly.png": "idly",
  "kal-dosa.png": "kal-dosa",
  "kali.png": "kali",
  "kesari.png": "kesari",
  "kothu-porotta.png": "kothu-porotta",
  "lemon-rice.png": "lemon-rice",
  "lemon-tea.png": "lemon-tea",
  "masala-dosa.png": "masala-dosa",
  "meals.png": "meals",
  "milk.png": "milk",
  "mochai.png": "mochai",
  "noodles.png": "noodles",
  "onion-dosa.png": "onion-dosa",
  "onion-podi-dosa.png": "onion-podi-dosa",
  "paasi-payiru.png": "paasi-payiru",
  "paniyaram.png": "paniyaram",
  "podi-dosa.png": "podi-dosa",
  "pongal.png": "pongal",
  "poori.png": "poori",
  "poratta.png": "poratta",
  "rice.png": "rice",
  "sambar-rice.png": "sambar-rice",
  "samosa.png": "samosa",
  "sukku-coffee.png": "sukku-coffee",
  "tea.png": "tea",
  "tomato-rice.png": "tomato-rice",
  "vada.png": "vada",
  "veg-briyani.png": "veg-briyani",
  "water-bottle.png": "water-bottle",
  // "chilli-porotta - Copy.png" / "curd-rice - Copy.png" are exact
  // duplicates of the non-"Copy" file — skipped, not a second dish.
};

mkdirSync(OUT_DIR, { recursive: true });

let totalBytes = 0;
for (const [file, slug] of Object.entries(SOURCE_SLUG)) {
  const buf = readFileSync(`${SRC_DIR}/${file}`);
  const { width, height, rgba } = decodePng(buf);

  // Centre-crop to 4:3 — the sources are 3:2 (1536x1024-ish), a bit wider
  // than the card. Cropping equally off both sides keeps the dish centred,
  // matching what object-fit:cover would do in the browser anyway.
  const cropH = height;
  const cropW = Math.round((height * 4) / 3);
  const minX = Math.max(0, Math.round((width - cropW) / 2));
  const box = { minX, minY: 0, width: Math.min(cropW, width), height: cropH };

  const resized = resampleRgba(rgba, width, height, box, TARGET_W, TARGET_H);
  const png = encodePng(resized, TARGET_W, TARGET_H, 6);
  writeFileSync(`${OUT_DIR}/${slug}.png`, png);
  totalBytes += png.length;
  console.log(`${file} -> ${OUT_DIR}/${slug}.png (${(png.length / 1024).toFixed(0)}KB)`);
}

console.log(`\nDone. ${Object.keys(SOURCE_SLUG).length} images, ${(totalBytes / 1024 / 1024).toFixed(2)}MB total.`);
