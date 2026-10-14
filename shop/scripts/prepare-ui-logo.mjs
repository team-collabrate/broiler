/**
 * Prepares the colour logo for on-screen use in both apps.
 *
 * The brand master is 1254x1254 and 1.7 MB — fine as artwork, far too heavy
 * for an app that has to load over cafe wifi and be usable offline. This
 * trims the transparent margin, resamples, and writes a small RGBA PNG into
 * each app's public/ directory.
 *
 * Usage:
 *   node scripts/prepare-ui-logo.mjs <source.png> [size]
 *
 * Writes worker-app/public/logo.png and owner-app/public/logo.png.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { decodePng, contentBounds, resampleRgba, encodePng } from "./lib/png.mjs";

/** Longest edge of the output. The lock screen shows it around 132 CSS px,
 *  so this covers a 2x display with room to spare and still costs little. */
const DEFAULT_SIZE = 320;

/** Alpha above this counts as content when trimming. Low, so the soft outer
 *  glow on the emblem isn't clipped off. */
const ALPHA_CUTOFF = 8;

const TARGETS = ["worker-app/public/logo.png", "owner-app/public/logo.png"];

const [source, sizeArg] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/prepare-ui-logo.mjs <source.png> [size]");
  process.exit(1);
}
const size = Number(sizeArg) || DEFAULT_SIZE;

const input = readFileSync(source);
const { width, height, rgba } = decodePng(input);
console.log(`source     ${width}x${height}, ${(input.length / 1024 / 1024).toFixed(2)} MB`);

const box = contentBounds(rgba, width, height, (_r, _g, _b, a) => a > ALPHA_CUTOFF);
console.log(`content    x ${box.minX}-${box.maxX}, y ${box.minY}-${box.maxY} (${box.width}x${box.height})`);
console.log(`trimmed    ${(100 - (box.width * box.height * 100) / (width * height)).toFixed(1)}% of the frame`);

// Fit the longest edge to `size`; the emblem is not square once trimmed, and
// letterboxing it into a square would just ship transparent padding again.
const scale = size / Math.max(box.width, box.height);
const dstW = Math.max(1, Math.round(box.width * scale));
const dstH = Math.max(1, Math.round(box.height * scale));

const out = resampleRgba(rgba, width, height, box, dstW, dstH);
const png = encodePng(out, dstW, dstH, 6);

for (const target of TARGETS) {
  mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  writeFileSync(target, png);
  console.log(`written    ${target}`);
}

let opaque = 0;
for (let p = 0; p < dstW * dstH; p++) if (out[p * 4 + 3] > 200) opaque++;

console.log(`output     ${dstW}x${dstH}, ${(png.length / 1024).toFixed(1)} KB each`);
console.log(`           ${((opaque * 100) / (dstW * dstH)).toFixed(1)}% of pixels are solid, rest is transparency`);
console.log(`saved      ${(((input.length - png.length) * 100) / input.length).toFixed(1)}% versus the master`);
