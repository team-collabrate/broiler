/**
 * Generates the worker app's Android launcher icon (legacy square/round +
 * adaptive-icon foreground layer, every density) from a source PNG at the
 * repo root — the same trim-to-ink approach as prepare-receipt-logo.mjs,
 * reusing scripts/lib/png.mjs rather than adding an image-processing
 * dependency for a one-off asset job. Unlike that script, this one keeps
 * full colour (RGBA) throughout — a receipt has to go out 1-bit for the
 * thermal head, but a launcher icon renders on a colour screen and should
 * stay whatever colour the source actually is (this has run against both a
 * black-and-white line-art mark and a full-colour gold/brown badge; neither
 * should come out grayscale).
 *
 * Two things an app icon needs that a receipt print doesn't:
 *
 * - Adaptive icons (Android 8+) are two layers — a background colour
 *   (ic_launcher_background, already #FFFFFF here — see
 *   android/app/src/main/res/values/ic_launcher_background.xml) and a
 *   foreground bitmap, which different launchers clip to a circle, squircle,
 *   or rounded square. Only the inner ~66% of the foreground canvas is safe
 *   from every mask shape; this uses 58% to stay clear with margin instead
 *   of hugging that line exactly. The foreground layer is composited onto a
 *   *transparent* canvas (not white) so the background colour shows through
 *   around the art rather than boxing it in a white square of its own.
 * - The legacy square/round PNGs (still what pre-8 devices and a few
 *   launchers use) get more of the canvas (80%) and go on an *opaque white*
 *   canvas instead, since nothing masks them except the "round" variant's
 *   own circle (Android reuses the exact same file for both — no separate
 *   ic_launcher_round source is drawn), and a launcher that shows them
 *   square needs real pixels behind the art, not transparency.
 *
 * Usage: node scripts/prepare-app-icon.mjs [source.png]
 * Defaults to app-icon.png at the repo root (the current launcher icon,
 * as of 2026-09-01 — a full-colour circular badge; logo-b-w.png, the earlier
 * black-and-white mark, is still there for the receipt print, which needs
 * that grayscale version specifically — see prepare-receipt-logo.mjs).
 * Overwrites every ic_launcher PNG under
 * worker-app/android/app/src/main/res/mipmap-<density>.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, contentBounds, resampleRgba, encodePng } from "./lib/png.mjs";

const RES_DIR = "worker-app/android/app/src/main/res";

// {density: [legacy icon px, adaptive foreground px]} — Android's own fixed
// set for mipmap-*dpi; see android/app/src/main/res/mipmap-*/ic_launcher*.png
// for the sizes this replaces.
const DENSITIES = {
  mdpi: [48, 108],
  hdpi: [72, 162],
  xhdpi: [96, 216],
  xxhdpi: [144, 324],
  xxxhdpi: [192, 432],
};

const INK_CUTOFF = 180;
const inkLevel = (r, g, b, a) => {
  const alpha = a / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
};

/** Resamples the cropped content into a `safeFraction`-sized box centred on
 *  a `canvasSize`² canvas — `onWhite` picks opaque-white (legacy icon) vs
 *  transparent (adaptive foreground); see this file's header comment for
 *  which each needs. Full colour throughout, alpha preserved. */
function composeIcon(rgba, srcW, srcH, box, canvasSize, safeFraction, onWhite) {
  const canvas = new Uint8Array(canvasSize * canvasSize * 4);
  if (onWhite) canvas.fill(255); // opaque white; else stays all-zero (transparent)

  const scale = (canvasSize * safeFraction) / Math.max(box.width, box.height);
  const dstW = Math.max(1, Math.round(box.width * scale));
  const dstH = Math.max(1, Math.round(box.height * scale));
  const content = resampleRgba(rgba, srcW, srcH, box, dstW, dstH);

  const offX = Math.round((canvasSize - dstW) / 2);
  const offY = Math.round((canvasSize - dstH) / 2);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const si = (y * dstW + x) * 4;
      const srcAlpha = content[si + 3] / 255;
      if (srcAlpha <= 0) continue;
      const di = ((offY + y) * canvasSize + (offX + x)) * 4;
      if (onWhite) {
        // Alpha-over opaque white — content came out of resampleRgba
        // already unmultiplied, so this is a plain per-channel blend.
        canvas[di] = Math.round(content[si] * srcAlpha + canvas[di] * (1 - srcAlpha));
        canvas[di + 1] = Math.round(content[si + 1] * srcAlpha + canvas[di + 1] * (1 - srcAlpha));
        canvas[di + 2] = Math.round(content[si + 2] * srcAlpha + canvas[di + 2] * (1 - srcAlpha));
        canvas[di + 3] = 255;
      } else {
        // Alpha-over transparent — the canvas starts empty, so this is just
        // a straight copy of the (unmultiplied) resampled pixel.
        canvas[di] = content[si];
        canvas[di + 1] = content[si + 1];
        canvas[di + 2] = content[si + 2];
        canvas[di + 3] = content[si + 3];
      }
    }
  }
  return canvas; // RGBA
}

const source = process.argv[2] || "app-icon.png";
const input = readFileSync(source);
const { width, height, rgba } = decodePng(input);
console.log(`source      ${width}x${height}`);

const ink = contentBounds(rgba, width, height, (r, g, b, a) => inkLevel(r, g, b, a) < INK_CUTOFF);
const pad = Math.round(ink.width * 0.02);
const box = {
  minX: Math.max(0, ink.minX - pad),
  minY: Math.max(0, ink.minY - pad),
  maxX: Math.min(width - 1, ink.maxX + pad),
  maxY: Math.min(height - 1, ink.maxY + pad),
};
box.width = box.maxX - box.minX + 1;
box.height = box.maxY - box.minY + 1;
console.log(`ink bounds  ${box.width}x${box.height} (aspect ${(box.width / box.height).toFixed(2)}:1)`);

for (const [density, [iconSize, fgSize]] of Object.entries(DENSITIES)) {
  const dir = `${RES_DIR}/mipmap-${density}`;

  const icon = composeIcon(rgba, width, height, box, iconSize, 0.8, true);
  const iconPng = encodePng(icon, iconSize, iconSize, 6);
  writeFileSync(`${dir}/ic_launcher.png`, iconPng);
  writeFileSync(`${dir}/ic_launcher_round.png`, iconPng); // same art — Android clips this one to a circle itself
  console.log(`${density.padEnd(8)} icon       ${iconSize}x${iconSize}  (${(iconPng.length / 1024).toFixed(1)} KB)`);

  const fg = composeIcon(rgba, width, height, box, fgSize, 0.58, false);
  const fgPng = encodePng(fg, fgSize, fgSize, 6);
  writeFileSync(`${dir}/ic_launcher_foreground.png`, fgPng);
  console.log(`${density.padEnd(8)} foreground ${fgSize}x${fgSize}  (${(fgPng.length / 1024).toFixed(1)} KB)`);
}

console.log("Done.");
