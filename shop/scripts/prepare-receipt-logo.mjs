/**
 * Prepares a source logo for printing at the top of the receipt.
 *
 * A camera-ready logo is the wrong shape for a till roll: it arrives large,
 * in colour, and floating in a sea of whitespace. Dropped in as-is, the
 * receipt renderer scales the whole canvas — whitespace included — down to
 * fit its box, so the artwork itself ends up a smudge in the middle of an
 * empty rectangle.
 *
 * This trims to the ink, resamples to the exact width the receipt draws at
 * (so the canvas never resamples it again), and writes an 8-bit greyscale
 * PNG. Greyscale rather than pre-thresholded 1-bit: the print path already
 * thresholds when it packs the raster, and keeping the soft edges makes the
 * on-screen bill look like paper instead of a fax.
 *
 * Usage:
 *   node scripts/prepare-receipt-logo.mjs <source.png> [targetWidth]
 *
 * Writes worker-app/public/receipt-logo.png.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, contentBounds, resampleRgba, encodePng, toGrayOverWhite } from "./lib/png.mjs";

/** 80mm paper is 576 printable dots; this leaves a clear margin either side.
 *  Keep in step with LOGO_MAX_W in worker-app/src/printing/receiptCanvas.ts. */
const DEFAULT_TARGET_WIDTH = 480;

/** Anything darker than this counts as ink when finding the crop box. Set
 *  well below mid-grey so scanner speckle and off-white paper don't widen
 *  the box back out to the full frame. */
const INK_CUTOFF = 180;

/** Breathing room around the trimmed artwork, as a fraction of its width. */
const PAD_RATIO = 0.02;

/** Luminance of a pixel composited over white paper. */
const inkLevel = (r, g, b, a) => {
  const alpha = a / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
};

const [source, widthArg] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/prepare-receipt-logo.mjs <source.png> [targetWidth]");
  process.exit(1);
}
const targetWidth = Number(widthArg) || DEFAULT_TARGET_WIDTH;

const input = readFileSync(source);
const { width, height, rgba } = decodePng(input);
console.log(`source      ${width}x${height}, ${(input.length / 1024 / 1024).toFixed(2)} MB`);

const ink = contentBounds(rgba, width, height, (r, g, b, a) => inkLevel(r, g, b, a) < INK_CUTOFF);
console.log(`ink bounds  x ${ink.minX}-${ink.maxX}, y ${ink.minY}-${ink.maxY}`);

// Pad outward from the ink, clamped to the frame.
const pad = Math.round(ink.width * PAD_RATIO);
const minX = Math.max(0, ink.minX - pad);
const minY = Math.max(0, ink.minY - pad);
const maxX = Math.min(width - 1, ink.maxX + pad);
const maxY = Math.min(height - 1, ink.maxY + pad);
const box = { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };

console.log(`cropped     ${box.width}x${box.height} (aspect ${(box.width / box.height).toFixed(2)}:1)`);
console.log(`discarded   ${(100 - (box.width * box.height * 100) / (width * height)).toFixed(1)}% of the frame as whitespace`);

const dstW = Math.min(targetWidth, box.width);
const dstH = Math.max(1, Math.round((box.height / box.width) * dstW));

const resampled = resampleRgba(rgba, width, height, box, dstW, dstH);
const gray = toGrayOverWhite(resampled, dstW, dstH);

let inked = 0;
for (const v of gray) if (v < 160) inked++;

const png = encodePng(gray, dstW, dstH, 0);
writeFileSync("worker-app/public/receipt-logo.png", png);

console.log(`output      ${dstW}x${dstH}, ${(png.length / 1024).toFixed(1)} KB`);
console.log(`ink cover   ${((inked * 100) / gray.length).toFixed(1)}% of pixels print black`);
console.log("written     worker-app/public/receipt-logo.png");
