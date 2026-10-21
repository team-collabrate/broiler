/**
 * Prepares product photos for the counter's image grid.
 *
 * Drop the photos in `shop/product-photos/`, named by product id (the id from the menu, for example
 * `naatukoli-kari.jpg`, `mutton-bone.png`, `kadai.webp`) and run:
 *
 *   npm run images
 *
 * Each photo is turned upright (phone photos carry a rotation flag), cropped from the centre to 4:3 (the shape of a
 * product card, so the tablet never downloads pixels the card cuts off), shrunk to 800 x 600 and written as a
 * progressive JPEG to `worker-app/public/items/<id>.jpg`, which is the file the counter looks for.
 *
 * Optional: category tab pictures go in `shop/product-photos/categories/` named by category key (`chicken`, `mutton`,
 * `others`); they are written square to `worker-app/public/categories/<key>.jpg`.
 *
 * Options (for testing): --in=<folder>  --out=<folder>  (the categories folder follows --out as `../categories`)
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const shopRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const option = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? resolve(hit.slice(name.length + 3)) : fallback;
};

const inDir = option("in", join(shopRoot, "product-photos"));
const itemsOut = option("out", join(shopRoot, "worker-app", "public", "items"));
const categoriesIn = join(inDir, "categories");
const categoriesOut = option("out", null) ? join(itemsOut, "..", "categories") : join(shopRoot, "worker-app", "public", "categories");

const ITEM_SIZE = { width: 800, height: 600 }; // 4:3, the product card's shape
const CATEGORY_SIZE = { width: 240, height: 240 };
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

/** The photo files directly inside a folder, skipping sub-folders and anything that is not a picture. */
function photosIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => SOURCE_EXTENSIONS.has(extname(name).toLowerCase()) && statSync(join(dir, name)).isFile())
    .sort();
}

/** Converts every photo in `from` to `<id>.jpg` in `to`; returns how many were written. */
async function convert(from, to, size, label) {
  const files = photosIn(from);
  if (files.length === 0) return 0;
  mkdirSync(to, { recursive: true });
  let bytes = 0;
  for (const file of files) {
    const id = basename(file, extname(file));
    const target = join(to, `${id}.jpg`);
    const image = sharp(join(from, file), { failOn: "none" }).rotate(); // .rotate() applies the EXIF orientation
    const { width = 0, height = 0 } = await image.metadata();
    const info = await image
      .resize({ ...size, fit: "cover", position: "centre" })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toFile(target);
    bytes += info.size;
    const small = width < size.width || height < size.height;
    console.log(
      `${label} ${file} -> ${id}.jpg  ${(info.size / 1024).toFixed(0)} KB${small ? `  (source ${width}x${height} is smaller than ${size.width}x${size.height}: it will look soft)` : ""}`,
    );
  }
  console.log(`  ${files.length} ${label} picture(s), ${(bytes / 1024).toFixed(0)} KB in total\n`);
  return files.length;
}

if (!existsSync(inDir)) {
  console.error(`No photo folder at ${inDir}.`);
  console.error("Create it and put one photo per product in it, named by product id (for example naatukoli-kari.jpg).");
  process.exit(1);
}

const items = await convert(inDir, itemsOut, ITEM_SIZE, "item");
const categories = await convert(categoriesIn, categoriesOut, CATEGORY_SIZE, "category");

if (items + categories === 0) {
  console.error(`No pictures found in ${inDir}. Supported: ${[...SOURCE_EXTENSIONS].join(" ")}`);
  process.exit(1);
}
console.log(`Done. Cards use these files from ${itemsOut}.`);
